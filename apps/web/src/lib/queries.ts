"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  ApiError,
  buildDataset,
  createDataset,
  deleteDataset,
  deleteFile,
  getBuildJobs,
  getDataset,
  getDatasets,
  getDatasetSnippet,
  getDatasetStats,
  getFiles,
  getFileStats,
  getPreviewUrl,
  getSources,
  getTrackClipUrl,
  getUploadActivity,
  updateDataset,
  type DatasetInput,
} from "@/lib/api-client";
import type {
  BuildJob,
  Dataset,
  DatasetStatsSummary,
  DatasetSummary,
  FileMetadata,
  SourceVideo,
} from "@bytetrack-dataset-builder/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  datasets: () => [...qk.all, "datasets"] as const,
  dataset: (id: string) => [...qk.all, "datasets", id] as const,
  datasetStats: () => [...qk.all, "datasets", "stats"] as const,
  sources: () => [...qk.all, "datasets", "sources"] as const,
  snippet: (id: string) => [...qk.all, "datasets", id, "snippet"] as const,
  jobs: () => [...qk.all, "datasets", "jobs"] as const,
  trackClip: (datasetId: string, trackId: number) =>
    [...qk.all, "datasets", datasetId, "track", trackId] as const,
};

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Tracking-dataset builder ---

export function useSources() {
  return useQuery<SourceVideo[], ApiError>({
    queryKey: qk.sources(),
    queryFn: getSources,
  });
}

export function useDatasetStats() {
  return useQuery<DatasetStatsSummary, ApiError>({
    queryKey: qk.datasetStats(),
    queryFn: getDatasetStats,
  });
}

export function useDatasets() {
  return useQuery<DatasetSummary[], ApiError>({
    queryKey: qk.datasets(),
    queryFn: getDatasets,
  });
}

export function useDataset(id: string | undefined, enabled = true) {
  return useQuery<Dataset, ApiError>({
    queryKey: qk.dataset(id ?? ""),
    queryFn: () => getDataset(id as string),
    enabled: enabled && !!id,
  });
}

export function useDatasetSnippet(id: string | undefined, enabled = true) {
  return useQuery<{ snippet: string }, ApiError>({
    queryKey: qk.snippet(id ?? ""),
    queryFn: () => getDatasetSnippet(id as string),
    enabled: enabled && !!id,
    staleTime: 60_000,
  });
}

export function useTrackClipUrl(
  datasetId: string,
  trackId: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: qk.trackClip(datasetId, trackId ?? -1),
    queryFn: () => getTrackClipUrl(datasetId, trackId as number),
    enabled: enabled && trackId !== undefined,
    staleTime: 60_000,
  });
}

// Polls while any build is still running so progress badges + the detail page
// refresh live as the background pipeline advances.
//
// The job registry is ephemeral and learns a build finished (done/error) one
// poll before the authoritative dataset manifest query would notice — and with
// the 30s global staleTime, `dataset(id)` won't auto-refetch on its own. So
// when a job crosses into a terminal state we invalidate the dataset queries
// here, pulling the freshly-built tracks/releases without a manual page refresh.
export function useBuildJobs(poll = false) {
  const qc = useQueryClient();
  // Job ids already reconciled to their terminal state. Seeded on the first
  // poll so we react only to jobs that *transition* to done/error while this
  // hook is mounted, not to builds that finished before we started watching.
  const reconciled = useRef<Set<string> | null>(null);

  const query = useQuery<BuildJob[], ApiError>({
    queryKey: qk.jobs(),
    queryFn: getBuildJobs,
    refetchInterval: poll ? 2000 : false,
  });

  const jobs = query.data;
  useEffect(() => {
    if (!jobs) return;
    const isTerminal = (j: BuildJob) => j.status === "done" || j.status === "error";
    if (reconciled.current === null) {
      reconciled.current = new Set(jobs.filter(isTerminal).map((j) => j.id));
      return;
    }
    for (const job of jobs) {
      if (isTerminal(job) && !reconciled.current.has(job.id)) {
        reconciled.current.add(job.id);
        qc.invalidateQueries({ queryKey: qk.dataset(job.dataset_id) });
        qc.invalidateQueries({ queryKey: qk.datasets() });
        qc.invalidateQueries({ queryKey: qk.datasetStats() });
      }
    }
  }, [jobs, qc]);

  return query;
}

export function useCreateDataset() {
  const qc = useQueryClient();
  return useMutation<Dataset, ApiError, DatasetInput>({
    mutationFn: (input) => createDataset(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.datasets() });
      qc.invalidateQueries({ queryKey: qk.datasetStats() });
    },
  });
}

export function useUpdateDataset(id: string) {
  const qc = useQueryClient();
  return useMutation<Dataset, ApiError, Partial<DatasetInput>>({
    mutationFn: (input) => updateDataset(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.datasets() });
      qc.invalidateQueries({ queryKey: qk.dataset(id) });
    },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean; id: string }, ApiError, string>({
    mutationFn: (id) => deleteDataset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

export function useBuildDataset() {
  const qc = useQueryClient();
  return useMutation<BuildJob, ApiError, string>({
    mutationFn: (id) => buildDataset(id),
    onSuccess: (_job, id) => {
      qc.invalidateQueries({ queryKey: qk.jobs() });
      qc.invalidateQueries({ queryKey: qk.dataset(id) });
      qc.invalidateQueries({ queryKey: qk.datasets() });
    },
  });
}
