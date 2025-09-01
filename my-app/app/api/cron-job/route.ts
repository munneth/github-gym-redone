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
      await sql`CREATE TABLE IF NOT EXISTS occupancy_data ( occupancy TEXT, timestamp TEXT, date DATE)`;
      await sql`INSERT INTO occupancy_data (occupancy, timestamp, date) VALUES (${occupancy}, ${
        getWestCoastTime().split(" ")[1]
      }, ${new Date().toISOString().split("T")[0]})`;
      console.log("Occupancy data saved to database");
    }

    console.log("Job completed - Occupancy:", occupancy, "Time:", time);
  } catch (error) {
    console.error("Job error:", error);
  }
}

export async function GET() {
  try {
    // Process occupancy data (this will be called by cron-job.org every minute)
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
