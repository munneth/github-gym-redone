import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not found");
    }
    const sql = neon(process.env.DATABASE_URL);

    const chartData =
      await sql`SELECT occupancy, timestamp, date FROM occupancy_data WHERE date >= CURRENT_DATE - INTERVAL '1 day' ORDER BY date DESC, timestamp DESC`;

    return NextResponse.json({ success: true, data: chartData });
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
