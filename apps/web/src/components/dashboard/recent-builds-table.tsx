"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useDatasets } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export function RecentBuildsTable() {
  const { data: datasets = [], isLoading, error, refetch } = useDatasets();
  const recent = datasets.slice(0, 8);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent builds</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/datasets"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No datasets yet"
            description="Create a dataset and run a build to see it here."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[34%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tracks
                </TableHead>
                <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clips
                </TableHead>
                <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Created
                </TableHead>
                <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((ds) => (
                <TableRow key={ds.id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <Link href={`/datasets/${ds.id}`} className="truncate hover:underline">
                      {ds.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {ds.tracks_total}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {ds.clips_generated}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(ds.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className="capitalize">
                      {ds.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
