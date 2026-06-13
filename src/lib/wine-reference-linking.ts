export type WineReferenceLinkRecord = {
  wine_reference_id?: string | null;
  custom_name?: string | null;
  custom_producer?: string | null;
  custom_region?: string | null;
  vintage?: number | null;
};

export type WineReferenceLinkCandidate = {
  id: string;
  name: string;
  producer: string | null;
  region: string | null;
  country: string | null;
  wineType: string | null;
  grapeVariety: string | null;
  rating: number | null;
};

function compact(parts: (string | number | null | undefined)[]) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function shouldShowReferenceLinkAction(record: WineReferenceLinkRecord) {
  return !record.wine_reference_id;
}

export function buildReferenceSearchQuery(record: WineReferenceLinkRecord) {
  return compact([
    record.custom_producer,
    record.custom_name,
    record.custom_region,
    record.vintage,
  ]);
}

export function getReferenceMatchLabel(candidate: WineReferenceLinkCandidate) {
  const producer = candidate.producer?.trim() || "Producer unknown";
  const name = candidate.name.trim();
  const place = [candidate.region, candidate.country].filter(Boolean).join(", ");
  const details = [place, candidate.wineType, candidate.rating != null ? `${candidate.rating} pts` : null]
    .filter(Boolean)
    .join(" • ");

  return details ? `${producer} — ${name} • ${details}` : `${producer} — ${name}`;
}
