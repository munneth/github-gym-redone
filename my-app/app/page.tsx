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

export default function Home() {
  return (
    <>
      <div>
        <h1>Occupancy</h1>
        <p>{getOccupancy("https://rec.ucdavis.edu/facilityoccupancy")}</p>
      </div>
    </>
  );
}
