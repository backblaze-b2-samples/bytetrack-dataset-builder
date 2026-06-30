"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSources, useCreateDataset, useUpdateDataset } from "@/lib/queries";
import { classLabel } from "@/lib/dataset-format";
import type { Dataset } from "@bytetrack-dataset-builder/shared";
import { COCO_TRACK_CLASSES } from "@bytetrack-dataset-builder/shared";

// Finite set of detection models the create form offers (Select, not free
// text). The default `rfdetr-base` is keyless COCO.
const DETECTION_MODELS = ["rfdetr-base", "rfdetr-large", "yolov8n-640"];

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().max(280).optional(),
  source_key: z.string().min(1, "Pick a source video"),
  detection_model: z.string().min(1),
  track_classes: z.array(z.string()).min(1, "Select at least one class to track"),
  detection_confidence: z.coerce.number().min(0).max(1),
  track_activation_threshold: z.coerce.number().min(0).max(1),
  min_track_length: z.coerce.number().int().min(1).max(10000),
  track_buffer: z.coerce.number().int().min(1).max(10000),
  max_frames: z.coerce.number().int().min(1).max(100000),
});

type FormValues = z.infer<typeof schema>;

const CREATE_DEFAULTS: FormValues = {
  name: "",
  description: "",
  source_key: "",
  detection_model: "rfdetr-base",
  track_classes: ["person", "car", "truck", "bus", "bicycle", "motorcycle"],
  detection_confidence: 0.25,
  track_activation_threshold: 0.25,
  min_track_length: 30,
  track_buffer: 30,
  max_frames: 300,
};

function fromDataset(ds: Dataset): FormValues {
  return {
    name: ds.name,
    description: ds.description,
    source_key: ds.config.source_key,
    detection_model: ds.config.detection_model,
    track_classes: ds.config.track_classes,
    detection_confidence: ds.config.detection_confidence,
    track_activation_threshold: ds.config.track_activation_threshold,
    min_track_length: ds.config.min_track_length,
    track_buffer: ds.config.track_buffer,
    max_frames: ds.config.max_frames,
  };
}

export function DatasetForm({ dataset }: { dataset?: Dataset }) {
  const router = useRouter();
  const isEdit = !!dataset;
  // Config is locked once a build has materialized tracks.
  const configLocked = isEdit && dataset.status !== "draft";
  const { data: sources = [] } = useSources();
  const create = useCreateDataset();
  const update = useUpdateDataset(dataset?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit ? fromDataset(dataset) : CREATE_DEFAULTS,
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const config = {
      source_key: values.source_key,
      detection_model: values.detection_model,
      track_classes: values.track_classes,
      detection_confidence: values.detection_confidence,
      track_activation_threshold: values.track_activation_threshold,
      min_track_length: values.min_track_length,
      track_buffer: values.track_buffer,
      max_frames: values.max_frames,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({
          name: values.name,
          description: values.description ?? "",
          // Don't send config once it's locked (server would 409).
          ...(configLocked ? {} : { config }),
        });
        toast.success("Dataset updated");
        router.push(`/datasets/${dataset.id}`);
      } else {
        const created = await create.mutateAsync({
          name: values.name,
          description: values.description ?? "",
          config,
        });
        toast.success("Dataset created — run a build to extract tracks");
        router.push(`/datasets/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Highway dashcam — MOT v1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What this tracking dataset is for (optional)"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Build configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            {configLocked && (
              <p className="text-sm text-[var(--attention)]">
                Build config is locked because this dataset has already produced
                tracks. Create a new dataset to use different settings.
              </p>
            )}

            <FormField
              control={form.control}
              name="source_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source video</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={configLocked}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Select an uploaded raw video…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sources.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No videos — upload one first
                        </SelectItem>
                      ) : (
                        sources.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.filename} ({s.size_human})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Videos you uploaded land under the <code>raw/</code> prefix on
                    B2.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="detection_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detection model</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={configLocked}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DETECTION_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Default <strong>rfdetr-base</strong> — keyless COCO, runs on
                    CPU.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="track_classes"
              render={() => (
                <FormItem>
                  <FormLabel>Classes to track</FormLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COCO_TRACK_CLASSES.map((cls) => (
                      <FormField
                        key={cls}
                        control={form.control}
                        name="track_classes"
                        render={({ field }) => {
                          const checked = field.value?.includes(cls);
                          return (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={checked}
                                disabled={configLocked}
                                onCheckedChange={(v) => {
                                  if (v) field.onChange([...field.value, cls]);
                                  else
                                    field.onChange(
                                      field.value.filter((c: string) => c !== cls),
                                    );
                                }}
                              />
                              {classLabel(cls)}
                            </label>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormDescription>
                    Default = the surveillance / dashcam set (person, car, truck,
                    bus, bicycle, motorcycle).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="detection_confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detection confidence</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" min={0} max={1} disabled={configLocked} {...field} />
                    </FormControl>
                    <FormDescription>Default 0.25</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="track_activation_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track activation</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" min={0} max={1} disabled={configLocked} {...field} />
                    </FormControl>
                    <FormDescription>Default 0.25 (ByteTrack)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_track_length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min track length (frames)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min={1} disabled={configLocked} {...field} />
                    </FormControl>
                    <FormDescription>Default 30</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="track_buffer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track buffer (frames)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min={1} disabled={configLocked} {...field} />
                    </FormControl>
                    <FormDescription>Default 30</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_frames"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max frames</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min={1} disabled={configLocked} {...field} />
                    </FormControl>
                    <FormDescription>
                      Default 300 — caps a CPU demo at a few hundred frames so a
                      build finishes fast. Raise it for a full video.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create dataset"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
