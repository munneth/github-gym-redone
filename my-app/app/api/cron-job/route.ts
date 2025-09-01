import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import cron from "node-cron";

// Initialize cron job when the module loads
let cronInitialized = false;

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
    hour12: false,
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

// Initialize cron job to run every minute
function initializeCron() {
  if (cronInitialized) return;

  cron.schedule("* * * * *", async () => {
    console.log("Running cron job at:", new Date().toISOString());
    try {
      const occupancy = await getOccupancyInterval(
        "https://rec.ucdavis.edu/facilityoccupancy"
      );
      const time = getWestCoastTime();

      // TODO: Save to database here
      // await db.occupancy.create({
      //   data: {
      //     occupancy,
      //     timestamp: new Date(),
      //     westCoastTime: time
      //   }
      // });

      console.log("Cron job completed - Occupancy:", occupancy, "Time:", time);
    } catch (error) {
      console.error("Cron job error:", error);
    }
  });

  cronInitialized = true;
  console.log("Cron job initialized to run every minute");
}

// Initialize cron when this route is first accessed
initializeCron();

export async function GET() {
  try {
    const occupancy = await getOccupancy(
      "https://rec.ucdavis.edu/facilityoccupancy"
    );
    const time = getWestCoastTime();

    return NextResponse.json({
      success: true,
      occupancy,
      time,
      message: "Cron job is running every minute",
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
