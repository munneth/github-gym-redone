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
  console.log("=== PROCESSING OCCUPANCY DATA ===");
  console.log("Running job at:", new Date().toISOString());
  try {
    console.log("Calling getOccupancyInterval...");
    const occupancy = await getOccupancyInterval(
      "https://rec.ucdavis.edu/facilityoccupancy"
    );
    console.log("getOccupancyInterval returned:", occupancy);
    const time = getWestCoastTime();
    console.log("Current time:", time);
    if (occupancy) {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL not found");
      }
      const sql = neon(process.env.DATABASE_URL);
      const exists = await sql`SELECT * FROM occupancy_data WHERE timestamp = ${
        getWestCoastTime().split(" ")[1] +
        " " +
        getWestCoastTime().split(" ")[2]
      } AND date = ${
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
  let hours = parseInt(timeParts.split(":")[0]);
  const minutes = parseInt(timeParts.split(":")[1]);
  const AMPM = time.split(" ")[2]; // Fix: get AMPM from the full time string, not timeParts

  // Convert 12-hour format to 24-hour format for PM times
  if (AMPM === "PM" && hours !== 12) {
    hours += 12;
  }

  // Temporary debugging
  console.log("DEBUG isOpen():", {
    day,
    time,
    timeParts,
    hours,
    minutes,
    AMPM,
  });

  // Monday - Friday: 6am-10pm (Summer Hours)
  if (
    day === "Monday" ||
    day === "Tuesday" ||
    day === "Wednesday" ||
    day === "Thursday" ||
    day === "Friday"
  ) {
    console.log("  Weekday detected");
    if (AMPM === "AM") {
      // 6am-11:59am
      if (hours >= 6 && hours <= 11) {
        console.log("  AM hours check passed: hours >= 6 && hours <= 11");
        return true;
      } else {
        console.log("  AM hours check failed: hours =", hours);
      }
    } else if (AMPM === "PM") {
      // 12pm-10pm (12:00-22:00 in 24-hour)
      if (hours >= 12 && hours <= 22) {
        console.log("  PM hours check passed: hours >= 12 && hours <= 22");
        return true;
      } else {
        console.log("  PM hours check failed: hours =", hours);
      }
    }
  }

  // Saturday - Sunday: 9am-9pm (Summer Hours)
  if (day === "Saturday" || day === "Sunday") {
    console.log("  Weekend detected");
    if (AMPM === "AM") {
      // 9am-11:59am
      if (hours >= 9 && hours <= 11) {
        console.log(
          "  Weekend AM hours check passed: hours >= 9 && hours <= 11"
        );
        return true;
      } else {
        console.log("  Weekend AM hours check failed: hours =", hours);
      }
    } else if (AMPM === "PM") {
      // 12pm-9pm (12:00-21:00 in 24-hour)
      if (hours >= 12 && hours <= 21) {
        console.log(
          "  Weekend PM hours check passed: hours >= 12 && hours <= 21"
        );
        return true;
      } else {
        console.log("  Weekend PM hours check failed: hours =", hours);
      }
    }
  }

  console.log("  Facility is CLOSED - no conditions met");
  return false;
}
export async function GET() {
  console.log("=== CRON ENDPOINT HIT ===", new Date().toISOString());
  console.log("Request received at:", getWestCoastTime());

  try {
    // Process occupancy data (this will be called by cron-job.org every minute)
    console.log("Checking if facility is open...");
    const openStatus = isOpen();

    if (!openStatus) {
      console.log("Facility is CLOSED - returning early");
      return NextResponse.json({
        success: true,
        occupancy: null,
        time: getWestCoastTime(),
        message: "Facility is closed",
      });
    }
    console.log("Facility is OPEN - processing occupancy data...");
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
