import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatasetStatsCards } from "@/components/dashboard/dataset-stats-cards";
import { RecentBuildsTable } from "@/components/dashboard/recent-builds-table";
import { UploadChart } from "@/components/dashboard/upload-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Tracking-dataset activity on Backblaze B2 — footage ingested,
            datasets built, and how many object tracks, clips, and MOT releases
            each raw video fans out to.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/datasets/new">
            <Plus className="h-3.5 w-3.5" />
            New dataset
          </Link>
        </Button>
      </div>
      <DatasetStatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <UploadChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentBuildsTable />
        </div>
      </div>
    </div>
  );
}
