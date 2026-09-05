import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

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
      WITH samples AS (
        SELECT
          occupancy,
          timestamp,
          date,
          date::date + to_timestamp(timestamp, 'HH12:MI:SS AM')::time AS recorded_at
        FROM occupancy_data
      )
      SELECT occupancy, timestamp, date, recorded_at
      FROM samples
      WHERE recorded_at BETWEEN
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles') - INTERVAL '24 hours'
        AND CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles'
      ORDER BY recorded_at ASC
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
