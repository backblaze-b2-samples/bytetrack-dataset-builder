"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Download,
  Layers,
  Loader2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useDataset,
  useBuildJobs,
  useBuildDataset,
  useDeleteDataset,
  useDatasetSnippet,
} from "@/lib/queries";
import { getReleaseDownloadUrl } from "@/lib/api-client";
import { classLabel } from "@/lib/dataset-format";
import { TrackRow } from "./track-row";

export function DatasetDetail({ datasetId }: { datasetId: string }) {
  const router = useRouter();
  const { data: ds, isLoading, error, refetch } = useDataset(datasetId);
  const { data: jobs = [] } = useBuildJobs(true);
  const buildMutation = useBuildDataset();
  const deleteMutation = useDeleteDataset();
  const { data: snippetData } = useDatasetSnippet(
    datasetId,
    ds?.status === "ready",
  );
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const job = jobs.find((j) => j.dataset_id === datasetId);
  const busy =
    ds?.status === "building" ||
    (!!job && job.status !== "done" && job.status !== "error");

  const handleBuild = () => {
    buildMutation.mutate(datasetId, {
      onSuccess: () => toast.success("Build started"),
      onError: (err) => toast.error(err.message || "Failed to start build"),
    });
  };

  const handleDelete = () => {
    setConfirmingDelete(false);
    deleteMutation.mutate(datasetId, {
      onSuccess: () => {
        toast.success("Dataset deleted");
        router.push("/datasets");
      },
      onError: (err) => toast.error(err.message || "Delete failed"),
    });
  };

  const handleDownloadRelease = async (version: string) => {
    try {
      const { url } = await getReleaseDownloadUrl(datasetId, version);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !ds) {
    return <ErrorState error={error ?? new Error("Not found")} onRetry={() => refetch()} />;
  }

  const stats = ds.stats;
  const latestRelease = ds.releases[ds.releases.length - 1];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in border-b border-border pb-5">
        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 mb-2 text-xs">
          <Link href="/datasets">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Datasets
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Boxes className="h-5 w-5 text-muted-foreground" />
              {ds.name}
            </h1>
            {ds.description && (
              <p className="text-sm text-muted-foreground mt-1.5">{ds.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="capitalize">{ds.status}</Badge>
              {ds.stats.classes_seen.map((c) => (
                <Badge key={c} variant="outline">{classLabel(c)}</Badge>
              ))}
              {busy && job && (
                <Badge variant="secondary" className="gap-1 capitalize">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {job.status} {Math.round(job.progress * 100)}%
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/datasets/${ds.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button size="sm" className="h-8" disabled={busy} onClick={handleBuild}>
              <Play className="h-3.5 w-3.5" />
              {ds.status === "ready" ? "Rebuild" : "Build"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {ds.status === "error" && ds.error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Build failed: {ds.error}
          </CardContent>
        </Card>
      )}

      {/* Stats — the tracks-per-video headline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tracks", value: stats.tracks_total },
          { label: "Tracks / video", value: `${stats.tracks_per_video.toFixed(0)}×` },
          { label: "Clips", value: stats.clips_generated },
          { label: "Frames", value: stats.frames_processed },
        ].map((s) => (
          <Card key={s.label} className="card-hover">
            <CardHeader className="pt-4 pb-2 px-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 px-4">
              <div className="stat-value">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MOT release download */}
      {latestRelease && (
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              MOT releases
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-2">
            {ds.releases.map((r) => (
              <div
                key={r.version}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{r.version}</span>{" "}
                  <span className="text-muted-foreground">
                    · {r.track_count} tracks · MOTChallenge
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDownloadRelease(r.version)}
                >
                  <Download className="h-3 w-3" />
                  labels.zip
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {snippetData?.snippet && (
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Load directly from B2</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono">
              {snippetData.snippet}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Per-track clip players + annotation links (the scoped asset explorer) */}
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">
            Object tracks ({ds.tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ds.tracks.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No tracks yet"
              description={
                ds.status === "draft"
                  ? "Run a build to detect objects and associate them into persistent ByteTrack tracks."
                  : "This build produced no tracks long enough to keep (try lowering the min track length)."
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {ds.tracks.map((track) => (
                <TrackRow
                  key={track.track_id}
                  datasetId={ds.id}
                  track={track}
                  playing={playingId === track.track_id}
                  onPlay={() => setPlayingId(track.track_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{ds.name}</strong> and every
              annotation, clip, and release under its{" "}
              <code>dataset/{ds.id}/</code> prefix on B2. This cannot be undone.
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
    </div>
  );
}
