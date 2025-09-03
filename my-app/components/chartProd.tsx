"use client";

import { useEffect, useState } from "react";
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

const chartConfig = {
  occupancy: {
    label: "24 Hour Occupancy",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ChartBarLabel() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const json = await fetch("/api/chart-data");
        const data = await json.json();
        if (data.success) {
          const processedData = data.data.map(
            (data: { timestamp: string; occupancy: string }) => {
              // Simple parsing for format: "06:00:05 PM"
              const [timePart, ampm] = data.timestamp.split(" "); // ["06:00:05", "PM"]
              const [hours, minutes] = timePart.split(":"); // ["06", "00", "05"]
              const timeOnly = `${hours}:${minutes}`; // "06:00"

              return {
                time: `${timeOnly} ${ampm}`,
                occupancy: parseInt(data.occupancy), // Convert to number for proper max calculation
              };
            }
          );

          // Debug: Check the actual max value
          const maxOccupancy = Math.max(
            ...processedData.map((d: { occupancy: number }) => d.occupancy)
          );
          console.log("Max occupancy in data:", maxOccupancy);
          console.log(
            "All occupancy values:",
            processedData.map((d: { occupancy: number }) => d.occupancy)
          );

          setChartData(processedData.reverse());
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
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
              dataKey="time"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
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
          {loading ? "Loading data..." : `${chartData.length} data points`}{" "}
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing occupancy data for the last 24 hours
        </div>
      </CardFooter>
    </Card>
  );
}
