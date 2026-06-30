"use client";

import { FileJson, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTrackClipUrl } from "@/lib/queries";
import { API_BASE } from "@/lib/api-client";
import { classLabel, frameSpan } from "@/lib/dataset-format";
import type { Track } from "@bytetrack-dataset-builder/shared";

export function TrackRow({
  datasetId,
  track,
  playing,
  onPlay,
}: {
  datasetId: string;
  track: Track;
  playing: boolean;
  onPlay: () => void;
}) {
  // Fetch the presigned clip URL once the user expands this track for playback.
  const { data, isLoading } = useTrackClipUrl(datasetId, track.track_id, playing && !!track.clip_key);
  const clipUrl = data?.url;

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 flex-col gap-1 sm:w-52">
        <span className="font-mono text-xs text-muted-foreground">
          track #{track.track_id}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {frameSpan(track.start_frame, track.end_frame)}
        </span>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {classLabel(track.class_name)}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {track.frame_count} frames
          </Badge>
        </div>
        <a
          href={`${API_BASE}/files/${track.annotation_key}/download`}
          className="mt-1 inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
        >
          <FileJson className="h-3 w-3" />
          annotation.json
        </a>
      </div>

      <div className="flex-1">
        {!track.clip_key ? (
          <p className="text-xs text-muted-foreground">
            No clip for this track (too short to crop).
          </p>
        ) : playing ? (
          isLoading || !clipUrl ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading clip…
            </span>
          ) : (
            // Native player paints once the presigned URL resolves.
            <video
              controls
              autoPlay
              loop
              muted
              playsInline
              src={clipUrl}
              className="w-full max-w-xs rounded-md border border-border bg-black"
            />
          )
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="text-xs font-medium text-primary hover:underline"
          >
            ▶ Play track clip
          </button>
        )}
      </div>
    </div>
  );
}
