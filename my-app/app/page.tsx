import Image from "next/image";
//import { load } from "cheerio";
import * as cheerio from "cheerio";

export async function getContent(url: string) {
  const response = await fetch(url);
  const content = await response.text();
  return cheerio.load(content);
}

export async function getOccupancy(url: string) {
  const $ = await getContent(url);
  // Get the first element with this class
  const occupancy = $("p.occupancy-count").first().text();
  console.log("occupancy:");
  console.log(occupancy);
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

export default function Home() {
  return (
    <>
      <div>
        <h1>Occupancy</h1>
        <p>West Coast Time: {getWestCoastTime()}</p>
        <p>{getOccupancy("https://rec.ucdavis.edu/facilityoccupancy")}</p>
      </div>
    </>
  );
}
