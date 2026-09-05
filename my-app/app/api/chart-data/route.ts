import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOpenHoursInLast24Hours, isArcOpen } from "@/lib/arc-hours";

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
    const recentSamples = (await sql`
      SELECT occupancy, timestamp, date, recorded_at
      FROM occupancy_data
      WHERE recorded_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY recorded_at ASC NULLS FIRST, ctid ASC
    `) as OccupancyRecord[];

    // The collector may run while the ARC is closed. Do not expose those rows.
    const chartData = recentSamples.filter((sample) =>
      isArcOpen(sample.date, sample.timestamp)
    );

    const bestTime = [...chartData]
      .sort((a, b) => Number(a.occupancy) - Number(b.occupancy))
      .map(({ occupancy, timestamp, date }) => ({ occupancy, timestamp, date }));

    return NextResponse.json({
      success: true,
      data: chartData,
      bestTime,
      openHours: getOpenHoursInLast24Hours(),
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
