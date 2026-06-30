"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { COCO_TRACK_CLASSES } from "@bytetrack-dataset-builder/shared";
import { classLabel } from "@/lib/dataset-format";
import { DangerZone } from "./danger-zone";

// These are the defaults the dataset create form pre-selects. They mirror the
// backend pipeline knobs in services/api/app/config/settings.py. The form is
// the exemplar for the dataset create/edit forms: selectors for finite fields,
// number inputs for bounds.
const settingsSchema = z.object({
  detectionModel: z.string().min(1),
  device: z.enum(["auto", "cpu", "cuda", "mps"]),
  trackClasses: z.array(z.string()).min(1, "Select at least one class"),
  detectionConfidence: z.string().regex(/^\d+(\.\d+)?$/, "Must be a number"),
  trackActivation: z.string().regex(/^\d+(\.\d+)?$/, "Must be a number"),
  maxFrames: z.string().regex(/^\d+$/, "Must be an integer"),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const DETECTION_MODELS = ["rfdetr-base", "rfdetr-large", "yolov8n-640"];

const defaultValues: SettingsValues = {
  detectionModel: "rfdetr-base",
  device: "auto",
  trackClasses: ["person", "car", "truck", "bus", "bicycle", "motorcycle"],
  detectionConfidence: "0.25",
  trackActivation: "0.25",
  maxFrames: "300",
};

export function SettingsForm() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const onSubmit = async (values: SettingsValues) => {
    setSubmitting(true);
    // Demo-only — these defaults live in .env on the server. Wire to a real
    // settings endpoint when you add one.
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    toast.success("Pipeline defaults saved", {
      description: `${values.detectionModel} · device ${values.device}`,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Pipeline defaults</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="detectionModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detection model</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                      Default rfdetr-base runs keyless on CPU.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="device"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="auto">auto</SelectItem>
                        <SelectItem value="cpu">cpu</SelectItem>
                        <SelectItem value="cuda">cuda</SelectItem>
                        <SelectItem value="mps">mps</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      auto picks CUDA → Apple MPS → CPU, defaulting to CPU. No GPU
                      is ever required.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="trackClasses"
              render={() => (
                <FormItem>
                  <FormLabel>Default classes to track</FormLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {COCO_TRACK_CLASSES.map((cls) => (
                      <FormField
                        key={cls}
                        control={form.control}
                        name="trackClasses"
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value?.includes(cls)}
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
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="detectionConfidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detection confidence</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" className="font-mono tabular-nums" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trackActivation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track activation</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" className="font-mono tabular-nums" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxFrames"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max frames</FormLabel>
                    <FormControl>
                      <Input type="number" step="50" className="font-mono tabular-nums" {...field} />
                    </FormControl>
                    <FormDescription>CPU-demo cap.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <DangerZone />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset(defaultValues)}
          >
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
