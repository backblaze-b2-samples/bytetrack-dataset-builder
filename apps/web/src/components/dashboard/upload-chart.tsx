"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useDatasets } from "@/lib/queries";

const chartConfig = {
  tracks: {
    label: "Tracks",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function UploadChart() {
  const { data: datasets, error, refetch } = useDatasets();

  // Tracks extracted per dataset (the write-amplification story, per build).
  const data = useMemo(
    () =>
      (datasets ?? [])
        .filter((d) => d.status === "ready")
        .slice(0, 8)
        .map((d) => ({
          name: d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name,
          tracks: d.tracks_total,
        })),
    [datasets],
  );

  const total = data.reduce((sum, d) => sum + d.tracks, 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Tracks per dataset</CardTitle>
        <CardDescription className="text-xs">Most recent builds</CardDescription>
        <CardAction className="text-right self-center">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total
          </div>
          <div className="text-lg font-semibold tabular-nums tracking-tight leading-tight">
            {total}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No builds yet"
            description="Build a tracking dataset to see tracks-per-dataset here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="tracks-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-tracks)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-tracks)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={28}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="tracks"
                fill="url(#tracks-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
