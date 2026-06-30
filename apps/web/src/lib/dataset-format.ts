/** Compact frame-span label for a track (e.g. "frames 12–148"). */
export function frameSpan(start: number, end: number): string {
  return `frames ${start}–${end}`;
}

/** Title-case a COCO class name for display (e.g. "traffic light"). */
export function classLabel(name: string): string {
  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
