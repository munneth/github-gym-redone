import { ChartBarLabel } from "@/components/chartProd";
import Form from "@/components/form";
import { PacificTime } from "@/components/pacific-time";

export default function Home() {
  return (
    <>
      <div>
        <h1>Occupancy</h1>

        <p>Occupancy data is displayed from the database.</p>
        <p>West Coast Time: <PacificTime /></p>

        <p>Occupancy is sampled automatically every 30 minutes.</p>
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
        <div className="flex gap-6">
          <div className="flex-1">
            <ChartBarLabel />
          </div>
          <div className="w-80">
            <Form />
          </div>
        </div>
      </div>
    </>
  );
}
