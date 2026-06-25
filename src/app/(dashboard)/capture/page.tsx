import { FieldCaptureExperience } from "@/components/wine/field-capture-experience";

export const metadata = {
  title: "Field Capture | Pourfolio",
};

type CapturePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams;
  const demoParam = params?.demo;
  const inventoryParam = params?.inventory_id;
  const initialDemo = Array.isArray(demoParam) ? demoParam.includes("tapiz") : demoParam === "tapiz";
  const inventoryId = Array.isArray(inventoryParam) ? inventoryParam[0] : inventoryParam ?? null;

  return <FieldCaptureExperience initialDemo={initialDemo} inventoryId={inventoryId} />;
}
