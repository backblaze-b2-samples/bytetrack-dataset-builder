import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatasetsList } from "@/components/datasets/datasets-list";

export default function DatasetsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Tracking datasets</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Training-ready MOT datasets built from your raw B2 footage. Each
            build fans one video out into many labeled object tracks, per-track
            clips, and a versioned MOT release under its own{" "}
            <code className="font-mono text-xs">dataset/&lt;id&gt;/</code> prefix.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/datasets/new">
            <Plus className="h-3.5 w-3.5" />
            New dataset
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <DatasetsList />
      </div>
    </div>
  );
}
