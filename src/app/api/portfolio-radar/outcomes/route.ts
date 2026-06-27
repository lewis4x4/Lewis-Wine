import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  portfolioRadarOutcomeFromRecord,
  portfolioRadarOutcomeInsertRow,
  type PortfolioRadarOutcomeRequest,
} from "@/lib/portfolio-radar-outcomes";

const actionTypes = [
  "drink_now",
  "at_risk_past_peak",
  "missing_drink_window",
  "review_price_evidence",
  "refresh_valuation",
  "sell_watch",
  "replenish",
  "acquisition_buy",
  "acquisition_watch",
  "close_receipt",
  "capture_tasting_memory",
  "investigate_missing_evidence",
] as const;

const subjectTypes = ["cellar_item", "acquisition_target", "receipt", "tasting_memory"] as const;
const sourceSurfaces = [
  "cellar_command_center",
  "portfolio_truth",
  "replenishment_automation",
  "acquisition_engine",
  "acquisition_receipt",
  "tasting_memory",
] as const;

const requestSchema = z.object({
  actionDedupeKey: z.string().min(1).max(240),
  actionType: z.enum(actionTypes),
  subjectType: z.enum(subjectTypes),
  subjectId: z.string().min(1).max(160),
  resultType: z.enum(["opened", "dismissed", "skipped"]),
  sourceSurface: z.enum(sourceSurfaces).nullable().optional(),
  maturityFeedback: z.enum(["too_young", "ideal", "fading", "dead"]).nullable().optional(),
  suppressUntil: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
});

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = any;
type DbError = { code?: string; message?: string };

type SubjectOwnership = { ok: true } | { ok: false; reason: string };

const outcomeSelect = "id,owner_id,action_dedupe_key,action_type,subject_type,subject_id,result_type,source_surface,maturity_feedback,suppress_until,notes,raw_payload,created_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function db(supabase: SupabaseClient): SupabaseAnyClient {
  return supabase as unknown as SupabaseAnyClient;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function isMissingOutcomeTable(error: DbError) {
  const message = error.message ?? "";
  return error.code === "42P01" || (/cellar_action_outcomes/i.test(message) && /does not exist|schema cache/i.test(message));
}

function isUniqueOutcome(error: DbError) {
  return error.code === "23505";
}

function uuidLike(value: string) {
  return uuidPattern.test(value);
}

async function verifyCellarItem(client: SupabaseAnyClient, userId: string, subjectId: string): Promise<SubjectOwnership> {
  if (!uuidLike(subjectId)) return { ok: false, reason: "Invalid cellar item id" };
  const { data: inventory, error: inventoryError } = await client
    .from("cellar_inventory")
    .select("id,cellar_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (inventoryError) throw inventoryError;
  if (!inventory?.cellar_id) return { ok: false, reason: "Cellar item not found" };

  const { data: cellar, error: cellarError } = await client
    .from("cellars")
    .select("id")
    .eq("id", inventory.cellar_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (cellarError) throw cellarError;
  return cellar ? { ok: true } : { ok: false, reason: "Cellar item not found" };
}

async function verifyAcquisitionTarget(client: SupabaseAnyClient, userId: string, subjectId: string): Promise<SubjectOwnership> {
  if (!uuidLike(subjectId)) return { ok: false, reason: "Invalid acquisition target id" };
  const { data, error } = await client
    .from("acquisition_watchlist")
    .select("id")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true } : { ok: false, reason: "Acquisition target not found" };
}

async function verifySubjectOwnership(
  client: SupabaseAnyClient,
  userId: string,
  subjectType: PortfolioRadarOutcomeRequest["subjectType"],
  subjectId: string,
  rawPayload: Record<string, unknown>
): Promise<SubjectOwnership> {
  if (subjectType === "cellar_item") return verifyCellarItem(client, userId, subjectId);
  if (subjectType === "acquisition_target") return verifyAcquisitionTarget(client, userId, subjectId);

  const inventoryId = typeof rawPayload.inventoryId === "string" ? rawPayload.inventoryId : null;
  if (subjectType === "tasting_memory" && inventoryId) {
    return verifyCellarItem(client, userId, inventoryId);
  }

  // Receipt and legacy tasting-memory actions are derived in-session rather than backed
  // by a durable subject table. The outcome row remains owner-scoped and cannot affect
  // another user or rewrite trusted cellar evidence.
  return { ok: true };
}

async function selectExistingOutcome(
  client: SupabaseAnyClient,
  ownerId: string,
  actionDedupeKey: string,
  resultType: PortfolioRadarOutcomeRequest["resultType"]
) {
  const { data, error } = await client
    .from("cellar_action_outcomes")
    .select(outcomeSelect)
    .eq("owner_id", ownerId)
    .eq("action_dedupe_key", actionDedupeKey)
    .eq("result_type", resultType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? portfolioRadarOutcomeFromRecord(data) : null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = requestSchema.parse(await request.json().catch(() => ({})));
    const rawPayload = {
      ...parsed.rawPayload,
      evidencePolicy: "outcome_only_no_source_truth_overwrite",
    };
    const client = db(auth.supabase);
    const ownership = await verifySubjectOwnership(client, auth.user.id, parsed.subjectType, parsed.subjectId, rawPayload);
    if (!ownership.ok) {
      return NextResponse.json({ success: false, error: ownership.reason }, { status: 404 });
    }

    const outcomeInput: PortfolioRadarOutcomeRequest = {
      ...parsed,
      rawPayload,
    };
    const insertRow = portfolioRadarOutcomeInsertRow(outcomeInput, auth.user.id);
    const { data, error } = await client
      .from("cellar_action_outcomes")
      .insert(insertRow)
      .select(outcomeSelect)
      .single();

    if (error) {
      if (isMissingOutcomeTable(error)) {
        return NextResponse.json({ success: false, error: "Portfolio Radar outcome ledger is not migrated yet" }, { status: 503 });
      }
      if (isUniqueOutcome(error)) {
        const existing = await selectExistingOutcome(client, auth.user.id, parsed.actionDedupeKey, parsed.resultType);
        return NextResponse.json({ success: true, replayed: true, outcome: existing });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      replayed: false,
      outcome: portfolioRadarOutcomeFromRecord(data),
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      : error instanceof Error ? error.message : "Failed to record Portfolio Radar outcome";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
