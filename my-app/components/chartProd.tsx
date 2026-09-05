"use client";

import { useEffect, useState } from "react";
import { getSampleKey } from "@/lib/arc-hours";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "A bar chart showing gym occupancy data";

type OccupancySample = {
  timestamp: string;
  occupancy: string;
  date: string;
};

type OpenHour = {
  key: string;
  label: string;
};

type ChartDatum = {
  key: string;
  time: string;
  date: string;
  fullDateTime: string;
  occupancy: number | null;
};

type ChartResponse = {
  success: boolean;
  data: OccupancySample[];
  openHours: OpenHour[];
  error?: string;
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatStoredDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

function chartOrder(key: string) {
  const [date, time] = key.split("|");
  const match = time.match(/(\d{1,2}):(\d{2}) (AM|PM)/);
  if (!match) return 0;

  const hour = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return Date.parse(`${date}T${String(hour).padStart(2, "0")}:${match[2]}:00Z`);
}

const chartConfig = {
  occupancy: {
    label: "24 Hour Occupancy",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ChartBarLabel() {
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch data from the last 24 hours only
        setError(null);
        const response = await fetch("/api/chart-data", { cache: "no-store" });
        const data: ChartResponse = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Could not load occupancy data");
        }

        const samplesByHour = new Map<string, ChartDatum>();

        data.data.forEach((sample) => {
          const key = getSampleKey(sample.date, sample.timestamp);
          if (!key) return;

          const [timePart, ampm] = sample.timestamp.split(" ");
          const [hours, minutes] = timePart.split(":");
          const time = `${hours}:${minutes} ${ampm}`;
          const formattedDate = formatStoredDate(sample.date);

          samplesByHour.set(key, {
            key,
            time,
            date: formattedDate,
            fullDateTime: `${formattedDate} ${time}`,
            occupancy: Number(sample.occupancy),
          });
        });

        // Empty entries provide an hourly x-axis mark without inventing occupancy data.
        data.openHours.forEach(({ key, label }) => {
          if (!samplesByHour.has(key)) {
            const [storedDate] = key.split("|");
            samplesByHour.set(key, {
              key,
              time: label,
              date: formatStoredDate(storedDate),
              fullDateTime: `${formatStoredDate(storedDate)} ${label}`,
              occupancy: null,
            });
          }
        });

        const processedData = [...samplesByHour.values()].sort(
          (a, b) => chartOrder(a.key) - chartOrder(b.key)
        );
        setChartData(processedData);
        setSampleCount(data.data.length);
        console.log(
          `Chart updated with ${data.data.length} open data points from the last 24 hours`
        );
      } catch (error) {
        console.error("Error fetching chart data:", error);
        setError(
          error instanceof Error ? error.message : "Could not load occupancy data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gym Occupancy - Last 24 Hours</CardTitle>
        <CardDescription>
          Real-time occupancy data from UC Davis Recreation Center
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="bg-[#FFBF00]">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="key"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const time = String(value).split("|")[1];
                return time ? time.replace(/^0/, "").replace(":00", "") : "";
              }}
            />
            <ChartTooltip
              cursor={true}
              content={
                <ChartTooltipContent
                  hideLabel={false}
                  labelFormatter={(value, payload) => {
                    if (payload && payload[0]) {
                      return `Date & Time: ${payload[0].payload.fullDateTime}`;
                    }
                    return value;
                  }}
                  formatter={(value) => [`${value} people`, "Occupancy"]}
                />
              }
            />
            <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={8}>
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          {loading
            ? "Loading data..."
            : error
              ? `Unable to load data: ${error}`
              : sampleCount > 0
                ? `${sampleCount} data points`
                : "No open-hour samples recorded yet"}{" "}
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing only open ARC hours from the last 24 hours
        </div>
      </CardFooter>
    </Card>
  );
}
