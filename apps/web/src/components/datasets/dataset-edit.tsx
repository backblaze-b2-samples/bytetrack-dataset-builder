"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useDataset } from "@/lib/queries";
import { DatasetForm } from "./dataset-form";

export function DatasetEdit({ datasetId }: { datasetId: string }) {
  const { data: ds, isLoading, error, refetch } = useDataset(datasetId);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in border-b border-border pb-5">
        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 mb-2 text-xs">
          <Link href={`/datasets/${datasetId}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dataset
          </Link>
        </Button>
        <h1 className="page-title">Edit dataset</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Rename or redescribe anytime. Build settings are editable only while
          the dataset is a draft (before it has produced tracks).
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error || !ds ? (
        <ErrorState error={error ?? new Error("Not found")} onRetry={() => refetch()} />
      ) : (
        <DatasetForm dataset={ds} />
      )}
    </div>
  );
}
