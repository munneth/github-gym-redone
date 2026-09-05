import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

type OccupancyRecord = {
  occupancy: string;
  timestamp: string;
  date: string;
  recorded_at: string;
};

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not found");
    }

    const sql = neon(process.env.DATABASE_URL);
    const chartData = (await sql`
      WITH latest_samples AS (
        SELECT occupancy, timestamp, date, recorded_at, ctid
        FROM occupancy_data
        ORDER BY recorded_at DESC NULLS LAST, ctid DESC
        LIMIT 48
      )
      SELECT occupancy, timestamp, date, recorded_at
      FROM latest_samples
      ORDER BY recorded_at ASC NULLS FIRST, ctid ASC
    `) as OccupancyRecord[];

    const bestTime = [...chartData]
      .sort((a, b) => Number(a.occupancy) - Number(b.occupancy))
      .map(({ occupancy, timestamp, date }) => ({ occupancy, timestamp, date }));

    return NextResponse.json({
      success: true,
      data: chartData,
      bestTime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
