import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

function get24HourWindow() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Format for database comparison
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentTime = now.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }); // HH:MM:SS AM/PM

  const previousDate = twentyFourHoursAgo.toISOString().split("T")[0]; // YYYY-MM-DD
  const previousTime = twentyFourHoursAgo.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }); // HH:MM:SS AM/PM

  return {
    currentDate,
    currentTime,
    previousDate,
    previousTime,
    isPreviousDayIncluded: currentDate !== previousDate,
  };
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not found");
    }
    const sql = neon(process.env.DATABASE_URL);

    const window = get24HourWindow();

    // Debug: Log the 24-hour window calculation
    console.log("=== 24-HOUR WINDOW DEBUG ===");
    console.log("Current time:", new Date().toISOString());
    console.log("24-hour window:", window);
    console.log("Is previous day included:", window.isPreviousDayIncluded);

    let chartData = [];

    if (window.isPreviousDayIncluded) {
      // Fetch data from previous day (from the calculated time onwards)
      const previousDayData = await sql`
        SELECT *
        FROM occupancy_data
        WHERE date::date = ${window.previousDate}
        AND to_timestamp(timestamp, 'HH12:MI:SS AM')::time >= to_timestamp(${window.previousTime}, 'HH12:MI:SS AM')::time
        ORDER BY to_timestamp(timestamp, 'HH12:MI:SS AM')::time;
      `;

      // Fetch data from current day (all data)
      const currentDayData = await sql`
        SELECT *
        FROM occupancy_data
        WHERE date::date = ${window.currentDate}
        ORDER BY to_timestamp(timestamp, 'HH12:MI:SS AM')::time;
      `;

      chartData = [...previousDayData, ...currentDayData];
      console.log(
        `Fetched ${previousDayData.length} records from previous day and ${currentDayData.length} from current day`
      );
    } else {
      // All data is from the same day, just filter by time
      const sameDayData = await sql`
        SELECT *
        FROM occupancy_data
        WHERE date::date = ${window.currentDate}
        AND to_timestamp(timestamp, 'HH12:MI:SS AM')::time >= to_timestamp(${window.previousTime}, 'HH12:MI:SS AM')::time
        ORDER BY to_timestamp(timestamp, 'HH12:MI:SS AM')::time;
      `;

      chartData = sameDayData;
      console.log(
        `Fetched ${sameDayData.length} records from current day (24-hour window)`
      );
    }

    console.log(`Total records in 24-hour window: ${chartData.length}`);

    function getBestTime(chartData: Record<string, unknown>[]) {
      const allOccupancy = chartData.map((item) => ({
        occupancy: item.occupancy,
        timestamp: item.timestamp,
      }));

      const sortedAllOccupancy = allOccupancy.sort(
        (a, b) =>
          parseInt(a.occupancy as string) - parseInt(b.occupancy as string)
      );
      console.log(sortedAllOccupancy);

      return sortedAllOccupancy;
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      bestTime: getBestTime(chartData),
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
