import { DatasetEdit } from "@/components/datasets/dataset-edit";

export default async function EditDatasetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DatasetEdit datasetId={id} />;
}
