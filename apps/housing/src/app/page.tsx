import { HousingPortal } from "@/components/housing-portal";
import { loadHousingDataset } from "@/lib/dataset-store";

export const dynamic = "force-dynamic";

export default async function HousingHomePage() {
  const dataset = await loadHousingDataset("ALL");
  return (
    <HousingPortal
      initialDataset={dataset}
      initialPreferences={dataset.preferences}
    />
  );
}
