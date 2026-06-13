import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const userId = "dd49d396-763b-42e0-af6f-1b465d9532dc";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const journalPath = path.resolve(process.cwd(), "docs/brian-wine-journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const martinRay = journal.entries?.[0];

  if (!martinRay) {
    throw new Error("No seed entry found in brian-wine-journal.json");
  }

  await supabase.from("brian_taste_profiles").upsert({
    user_id: userId,
    preferred_smoothness: 5,
    preferred_boldness: 4,
    preferred_earthiness: 4,
    preferred_spiciness: 4,
    preferred_fruit_forward: 3,
    preferred_dryness: 3,
    preferred_tannin_strength: 3,
    preferred_acidity_level: 3,
    preferred_finish_length: 3,
    preferred_richness: 3,
    confidence_score: 68,
    profile_summary: journal.current_profile_hypothesis?.working_theory || martinRay.summary,
    favorite_descriptors: ["very smooth", "bold", "earthy", "spicy"],
    avoid_descriptors: ["too thin"],
  }, { onConflict: "user_id" });

  const { data: rating } = await supabase
    .from("ratings")
    .select("id")
    .eq("user_id", userId)
    .eq("score", martinRay.rating.score_100)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rating) {
    console.log("No matching rating found yet for Martin Ray. Profile seeded, rating_signals skipped.");
    return;
  }

  await supabase.from("rating_signals").upsert({
    rating_id: rating.id,
    user_id: userId,
    smoothness: martinRay.palate_signals.smoothness,
    boldness: martinRay.palate_signals.boldness,
    earthiness: martinRay.palate_signals.earthiness,
    spiciness: martinRay.palate_signals.spiciness,
    fruit_forward: martinRay.palate_signals.fruit_forward,
    dryness: martinRay.palate_signals.dryness,
    tannin_strength: martinRay.palate_signals.tannin_strength,
    acidity_level: martinRay.palate_signals.acidity_level,
    finish_length: martinRay.palate_signals.finish_length,
    richness: martinRay.palate_signals.richness,
    buy_again: martinRay.buy_signals.buy_again,
    decision_tags: martinRay.decision_tags,
    occasion_tags: [],
    brian_phrases: martinRay.brian_phrases,
    extracted_from_text: {
      source: martinRay.source,
      summary: martinRay.summary,
    },
  }, { onConflict: "rating_id" });

  console.log("Brian-fit seed applied for existing user account.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
