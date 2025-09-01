import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

export async function GET() {
  try {
    const occupancy = await getOccupancyInterval(
      "https://rec.ucdavis.edu/facilityoccupancy"
    );
    return NextResponse.json({
      success: true,
      occupancy,
      time: getWestCoastTime(),
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
