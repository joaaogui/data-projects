import { MoradiaPortal } from "@/components/moradia-portal";
import { loadMoradiaDataset } from "@/lib/dataset-store";

export const dynamic = "force-dynamic";

export default async function MoradiaHomePage() {
  const dataset = await loadMoradiaDataset("ALL");
  return (
    <MoradiaPortal
      initialDataset={dataset}
      initialPreferences={dataset.preferences}
    />
  );
}
