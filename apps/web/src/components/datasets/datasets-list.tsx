"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Boxes, Inbox, Loader2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDatasets,
  useBuildJobs,
  useBuildDataset,
  useDeleteDataset,
} from "@/lib/queries";
import type { BuildJob, DatasetSummary } from "@bytetrack-dataset-builder/shared";

function StatusBadge({
  ds,
  job,
}: {
  ds: DatasetSummary;
  job: BuildJob | undefined;
}) {
  if (job && job.status !== "done" && job.status !== "error") {
    return (
      <Badge variant="secondary" className="gap-1 capitalize">
        <Loader2 className="h-3 w-3 animate-spin" />
        {job.status}
        {job.progress > 0 ? ` ${Math.round(job.progress * 100)}%` : ""}
      </Badge>
    );
  }
  if (ds.status === "ready") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-[var(--success)] text-[var(--success)]"
      >
        Ready
      </Badge>
    );
  }
  if (ds.status === "error") return <Badge variant="destructive">Error</Badge>;
  if (ds.status === "building")
    return <Badge variant="secondary">Building…</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

export function DatasetsList() {
  const { data: datasets = [], isLoading, error, refetch } = useDatasets();
  const anyBuilding = datasets.some((d) => d.status === "building");
  const { data: jobs = [] } = useBuildJobs(anyBuilding || datasets.length > 0);
  const buildMutation = useBuildDataset();
  const deleteMutation = useDeleteDataset();
  const [pendingDelete, setPendingDelete] = useState<DatasetSummary | null>(null);

  const jobByDataset = useMemo(() => {
    const map = new Map<string, BuildJob>();
    for (const j of jobs) if (!map.has(j.dataset_id)) map.set(j.dataset_id, j);
    return map;
  }, [jobs]);

  const handleBuild = (ds: DatasetSummary) => {
    buildMutation.mutate(ds.id, {
      onSuccess: () => toast.success(`Build started for ${ds.name}`),
      onError: (err) => toast.error(err.message || "Failed to start build"),
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const ds = pendingDelete;
    deleteMutation.mutate(ds.id, {
      onSuccess: () => toast.success(`Deleted ${ds.name}`),
      onError: (err) => toast.error(err.message || "Delete failed"),
    });
    setPendingDelete(null);
  };

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Tracking datasets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : datasets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No tracking datasets yet"
            description="Create a dataset from an uploaded raw video, then run a build to detect + ByteTrack it into labeled object tracks."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tracks
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clips
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Releases
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map((ds) => {
                const job = jobByDataset.get(ds.id);
                const busy =
                  ds.status === "building" ||
                  (!!job && job.status !== "done" && job.status !== "error");
                return (
                  <TableRow key={ds.id} className="table-row-hover">
                    <TableCell className="font-medium">
                      <Link
                        href={`/datasets/${ds.id}`}
                        className="flex items-center gap-2 truncate hover:underline"
                      >
                        <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{ds.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {ds.tracks_total}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {ds.clips_generated}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {ds.release_count}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusBadge ds={ds} job={job} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={busy || buildMutation.isPending}
                          onClick={() => handleBuild(ds)}
                        >
                          <Play className="h-3 w-3" />
                          {ds.status === "ready" ? "Rebuild" : "Build"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(ds)}
                          aria-label={`Delete ${ds.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{pendingDelete?.name}</strong> and
              every annotation, clip, and release under its{" "}
              <code>dataset/{pendingDelete?.id}/</code> prefix on B2. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
