import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";

export async function getContent(url: string) {
  const response = await fetch(url);
  const content = await response.text();
  return cheerio.load(content);
}

export async function getOccupancy(url: string) {
  const $ = await getContent(url);
  const occupancy = $("p.occupancy-count").first().text();
  console.log("occupancy:", occupancy);
  return occupancy;
}

export function getWestCoastTime() {
  const now = new Date();
  const westCoastTime = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return westCoastTime;
}
export function getWestCoastDay() {
  const now = new Date();
  return now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long", // Returns "Monday", "Tuesday", etc.
  });
}

export async function getOccupancyInterval(url: string) {
  const time = getWestCoastTime();
  const timeParts = time.split(" ")[1]; // Get time part (HH:MM:SS)
  const minutes = timeParts.split(":")[1]; // Get minutes part
  if (minutes === "00" || minutes === "30") {
    return await getOccupancy(url);
  }
  return null;
}

// This function will be called by cron-job.org every minute
async function processOccupancyData() {
  console.log("Running job at:", new Date().toISOString());
  try {
    const occupancy = await getOccupancyInterval(
      "https://rec.ucdavis.edu/facilityoccupancy"
    );
    const time = getWestCoastTime();
    if (occupancy) {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL not found");
      }
      const sql = neon(process.env.DATABASE_URL);
      const exists =
        await sql`SELECT * FROM occupancy_data WHERE timestamp = ${time} AND date = ${
          new Date().toISOString().split("T")[0]
        } AND occupancy = ${occupancy}`;
      if (!exists.length) {
        await sql`CREATE TABLE IF NOT EXISTS occupancy_data ( occupancy TEXT, timestamp TEXT, date DATE)`;
        await sql`INSERT INTO occupancy_data (occupancy, timestamp, date) VALUES (${occupancy}, ${
          getWestCoastTime().split(" ")[1] +
          " " +
          getWestCoastTime().split(" ")[2]
        }, ${new Date().toISOString().split("T")[0]})`;
        console.log("Occupancy data saved to database");
      } else {
        throw new Error("Occupancy data already exists");
      }
    }

    console.log("Job completed - Occupancy:", occupancy, "Time:", time);
  } catch (error) {
    console.error("Job error:", error);
  }
}
function isOpen() {
  const day = getWestCoastDay();
  const time = getWestCoastTime();
  const timeParts = time.split(" ")[1];
  const hours = parseInt(timeParts.split(":")[0]);
  const minutes = parseInt(timeParts.split(":")[1]);
  const AMPM = timeParts.split(" ")[2];

  // Monday - Friday: 6am-10pm
  if (
    day === "Monday" ||
    day === "Tuesday" ||
    day === "Wednesday" ||
    day === "Thursday" ||
    day === "Friday"
  ) {
    if (AMPM === "AM") {
      // 6am-11:59am
      if (hours >= 6 && hours <= 11) {
        return true;
      }
    } else if (AMPM === "PM") {
      // 12pm-10pm
      if (hours >= 12 && hours <= 10) {
        return true;
      }
    }
  }

  // Saturday - Sunday: 9am-9pm
  if (day === "Saturday" || day === "Sunday") {
    if (AMPM === "AM") {
      // 9am-11:59am
      if (hours >= 9 && hours <= 11) {
        return true;
      }
    } else if (AMPM === "PM") {
      // 12pm-9pm
      if (hours >= 12 && hours <= 9) {
        return true;
      }
    }
  }

  return false;
}
export async function GET() {
  try {
    // Process occupancy data (this will be called by cron-job.org every minute)
    if (!isOpen()) {
      return NextResponse.json({
        success: true,
        occupancy: null,
        time: getWestCoastTime(),
        message: "Facility is closed",
      });
    }
    await processOccupancyData();

    const occupancy = await getOccupancy(
      "https://rec.ucdavis.edu/facilityoccupancy"
    );
    const time = getWestCoastTime();

    return NextResponse.json({
      success: true,
      occupancy,
      time,
      message: "Endpoint ready for cron-job.org to call every minute",
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
