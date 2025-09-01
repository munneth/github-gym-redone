import Image from "next/image";
import { ChartBarLabel } from "@/components/chartProd";

export default function Home() {
  return (
    <>
      <div>
        <h1>Occupancy</h1>
        <p>Check the console for cron job logs</p>
        <p>
          West Coast Time:{" "}
          {new Date().toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </p>
        <ChartBarLabel />
      </div>
    </>
  );
}
