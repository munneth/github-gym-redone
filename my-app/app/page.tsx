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
