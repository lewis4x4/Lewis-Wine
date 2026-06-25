import { FieldCaptureExperience } from "@/components/wine/field-capture-experience";

export const metadata = {
  title: "Field Capture | Pourfolio",
};

type CapturePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams;
  const demoParam = params?.demo;
  const inventoryParam = params?.inventory_id;
  const saveModeParam = firstParam(params?.save_mode);
  const purchaseIntent = firstParam(params?.intent) === "purchase";
  const initialDemo = Array.isArray(demoParam) ? demoParam.includes("tapiz") : demoParam === "tapiz";
  const inventoryId = firstParam(inventoryParam) ?? null;
  const initialSaveMode = saveModeParam === "add_to_cellar" || purchaseIntent ? "add_to_cellar" : null;

  return <FieldCaptureExperience initialDemo={initialDemo} inventoryId={inventoryId} initialSaveMode={initialSaveMode} />;
}
