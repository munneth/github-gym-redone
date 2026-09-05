import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const FACILITY_OCCUPANCY_URL =
  process.env.OCCUPANCY_URL ?? "https://rec.ucdavis.edu/facilityoccupancy";
const MAX_OCCUPANCY_RECORDS = 48;

export const dynamic = "force-dynamic";

type PacificDateTime = {
  date: string;
  time: string;
};

function getPacificDateTime(now = new Date()): PacificDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second} ${values.dayPeriod}`,
  };
}

export function extractOccupancy(html: string): string {
  const occupancyElement = /<[^>]*class=["'][^"']*\boccupancy-count\b[^"']*["'][^>]*>([\s\S]*?)<\//i.exec(
    html
  );
  const occupancy = occupancyElement?.[1]?.replace(/<[^>]+>/g, "").trim();

  if (!occupancy || !/^\d+$/.test(occupancy)) {
    throw new Error("Could not find a numeric occupancy count on the facility page");
  }

  return occupancy;
}

async function getOccupancy(): Promise<string> {
  const response = await fetch(FACILITY_OCCUPANCY_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "github-gym-occupancy-cron/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Facility occupancy request failed with ${response.status}`);
  }

  return extractOccupancy(await response.text());
}

async function ensureTable() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not found");
  }

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS occupancy_data (
      occupancy TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      date DATE NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    ALTER TABLE occupancy_data
    ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS occupancy_data_recorded_at_idx
    ON occupancy_data (recorded_at DESC)
  `;

  return sql;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [occupancy, sql] = await Promise.all([getOccupancy(), ensureTable()]);
    const { date, time } = getPacificDateTime();

    await sql`
      INSERT INTO occupancy_data (occupancy, timestamp, date, recorded_at)
      VALUES (${occupancy}, ${time}, ${date}, CURRENT_TIMESTAMP)
    `;
    await sql`
      DELETE FROM occupancy_data
      WHERE ctid IN (
        SELECT ctid
        FROM occupancy_data
        ORDER BY recorded_at DESC NULLS LAST, ctid DESC
        OFFSET ${MAX_OCCUPANCY_RECORDS}
      )
    `;

    return NextResponse.json({
      success: true,
      occupancy: Number(occupancy),
      date,
      time,
      retainedRecords: MAX_OCCUPANCY_RECORDS,
    });
  } catch (error) {
    console.error("Occupancy cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
