import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  reviewStatus: z.enum(["accepted", "rejected", "superseded"]),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = reviewSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("wine_price_observations")
      .select("id, inventory_id, wine_price_observations_inventory:cellar_inventory!inner(cellar_id, cellars!inner(owner_id))")
      .eq("id", id)
      .single();

    if (!existing) return NextResponse.json({ success: false, error: "Observation not found" }, { status: 404 });
    // Keep the ownership check explicit because generated nested names vary across Supabase clients.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventory } = await (supabase as any).from("cellar_inventory").select("cellar_id").eq("id", existing.inventory_id).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cellar } = await (supabase as any).from("cellars").select("owner_id").eq("id", inventory?.cellar_id).single();
    if (!cellar || cellar.owner_id !== user.id) return NextResponse.json({ success: false, error: "Observation not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("wine_price_observations")
      .update({ review_status: input.reviewStatus, notes: input.notes ?? undefined, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, observation: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to review observation" }, { status: 400 });
  }
}
