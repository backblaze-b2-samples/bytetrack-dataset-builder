export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Tracking-dataset builder ---

export type JobStatus =
  | "queued"
  | "loading"
  | "detecting"
  | "tracking"
  | "clipping"
  | "packaging"
  | "done"
  | "error";

export type DatasetStatus = "draft" | "building" | "ready" | "error";

export interface DatasetConfig {
  source_key: string;
  detection_model: string;
  track_classes: string[];
  detection_confidence: number;
  track_activation_threshold: number;
  min_track_length: number;
  track_buffer: number;
  max_frames: number;
}

export interface TrackBox {
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface Track {
  track_id: number;
  class_name: string;
  video_id: string;
  frame_count: number;
  start_frame: number;
  end_frame: number;
  annotation_key: string;
  clip_key: string | null;
  sample_box: TrackBox | null;
}

export interface DatasetStats {
  frames_processed: number;
  detections_total: number;
  tracks_total: number;
  clips_generated: number;
  fps: number;
  tracks_per_video: number;
  classes_seen: string[];
}

export interface Release {
  version: string;
  manifest_key: string;
  labels_zip_key: string;
  track_count: number;
  video_count: number;
  created_at: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  status: DatasetStatus;
  config: DatasetConfig;
  stats: DatasetStats;
  tracks: Track[];
  releases: Release[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  description: string;
  status: DatasetStatus;
  source_key: string;
  tracks_total: number;
  clips_generated: number;
  release_count: number;
  created_at: string;
  updated_at: string;
}

export interface BuildJob {
  id: string;
  dataset_id: string;
  status: JobStatus;
  progress: number;
  message: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetStatsSummary {
  footage_ingested: number;
  datasets_built: number;
  total_tracks: number;
  total_clips: number;
  total_releases: number;
  storage_used_human: string;
}

export interface SourceVideo {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

// COCO classes the surveillance / dashcam default set draws from. Multi-select
// in the create form; the server lower-cases + de-dupes.
export const COCO_TRACK_CLASSES = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
  "train",
  "boat",
  "traffic light",
  "stop sign",
  "dog",
  "cat",
] as const;
