import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoUserId = process.env.JARVIS_DEMO_USER_ID;

if (!supabaseUrl || !serviceRoleKey || !demoUserId) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or JARVIS_DEMO_USER_ID.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedJarvisDemo() {
  console.log("Resetting JARVIS demo data for user:", demoUserId);

  await supabase.from("timeline_events").delete().eq("owner_id", demoUserId);
  await supabase.from("daily_briefs").delete().eq("owner_id", demoUserId);
  await supabase.from("commitments").delete().eq("owner_id", demoUserId);
  await supabase.from("decisions").delete().eq("owner_id", demoUserId);
  await supabase.from("artifacts").delete().eq("owner_id", demoUserId);
  await supabase.from("capture_events").delete().eq("owner_id", demoUserId);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const { data: captures, error: captureError } = await supabase
    .from("capture_events")
    .insert([
      {
        owner_id: demoUserId,
        source_type: "manual",
        business_lane: "executive",
        title: "Board pricing posture follow-up",
        content_preview:
          "Board wants a concise read on pricing power, churn exposure, and which enterprise accounts would tolerate a faster expansion motion.",
        participants: ["CEO", "Board"],
        happened_at: now.toISOString(),
      },
      {
        owner_id: demoUserId,
        source_type: "transcript",
        business_lane: "product",
        title: "Customer transcript: workflow latency concern",
        content_preview:
          "Enterprise design partner confirmed the core workflow is valuable, but handoff latency is creating weekly trust erosion for operators.",
        participants: ["Design partner", "Product"],
        happened_at: yesterday.toISOString(),
      },
    ])
    .select("id, title, business_lane, happened_at");

  if (captureError || !captures) {
    throw captureError ?? new Error("Failed to create capture demo data.");
  }

  const { error: artifactError } = await supabase.from("artifacts").insert(
    captures.map((capture, index) => ({
      owner_id: demoUserId,
      capture_event_id: capture.id,
      artifact_type: "primary_text",
      title: capture.title,
      mime_type: "text/markdown",
      content_text:
        index === 0
          ? "Board asked for a sharper answer on whether pricing leverage is real or just hidden by contract structure. Need a one-page answer by Friday."
          : "Transcript excerpt: The product is becoming core to the team, but latency between approval and execution creates operator friction every single week.",
      is_primary: true,
    })),
  );

  if (artifactError) {
    throw artifactError;
  }

  const { data: decisions, error: decisionError } = await supabase
    .from("decisions")
    .insert([
      {
        owner_id: demoUserId,
        business_lane: "executive",
        title: "Run pricing analysis before expansion pitch",
        summary: "Do not take price until churn exposure is explicitly mapped at the account segment level.",
        rationale:
          "The board question is valid, but execution should stay evidence-backed instead of conviction-backed.",
        impact_level: "high",
        source_capture_event_id: captures[0].id,
      },
      {
        owner_id: demoUserId,
        business_lane: "product",
        title: "Prioritize workflow latency fix in the next sprint",
        summary: "Move the operator handoff latency issue into the top product queue for the next sprint.",
        rationale:
          "The customer transcript shows the product is valuable enough to retain, but trust is decaying on execution speed.",
        impact_level: "medium",
        source_capture_event_id: captures[1].id,
      },
    ])
    .select("id, title, business_lane, decided_at");

  if (decisionError || !decisions) {
    throw decisionError ?? new Error("Failed to create decision demo data.");
  }

  const { data: commitments, error: commitmentError } = await supabase
    .from("commitments")
    .insert([
      {
        owner_id: demoUserId,
        business_lane: "finance",
        title: "Deliver pricing sensitivity memo",
        description:
          "Build a one-page sensitivity read for expansion pricing, including churn risk by segment.",
        status: "in_progress",
        priority: "critical",
        commitment_type: "deliverable",
        counterparty: "Board",
        due_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        source_capture_event_id: captures[0].id,
        source_decision_id: decisions[0].id,
        participants: ["CEO", "Finance"],
      },
      {
        owner_id: demoUserId,
        business_lane: "product",
        title: "Scope latency fix with engineering",
        description:
          "Define the smallest credible latency fix and a customer-facing timeline before the next design partner review.",
        status: "open",
        priority: "high",
        commitment_type: "follow_up",
        counterparty: "Engineering",
        due_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        source_capture_event_id: captures[1].id,
        source_decision_id: decisions[1].id,
        participants: ["Product", "Engineering"],
      },
      {
        owner_id: demoUserId,
        business_lane: "relationships",
        title: "Call design partner with updated plan",
        description:
          "Close the loop with the customer after the latency plan is locked so the trust signal improves, not just the roadmap.",
        status: "blocked",
        priority: "normal",
        commitment_type: "relationship",
        counterparty: "Design partner",
        due_at: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        participants: ["CEO"],
      },
    ])
    .select("id, title, business_lane, due_at");

  if (commitmentError || !commitments) {
    throw commitmentError ?? new Error("Failed to create commitment demo data.");
  }

  const { data: brief, error: briefError } = await supabase
    .from("daily_briefs")
    .insert({
      owner_id: demoUserId,
      brief_date: now.toISOString().slice(0, 10),
      title: "Wednesday operator brief",
      summary:
        "Three things matter today: defend pricing logic with evidence, lock the latency fix, and close the loop with the customer before trust drifts further.",
      priorities: [
        "Finish pricing sensitivity memo draft.",
        "Approve latency fix scope with engineering.",
        "Prepare customer update before end of day.",
      ],
      blockers: [
        "Need segmented churn exposure pulled into the pricing memo.",
        "Latency fix estimate is still waiting on engineering confirmation.",
      ],
      watch_items: [
        "Board confidence on pricing discipline.",
        "Customer trust signal after roadmap response.",
      ],
    })
    .select("id, title");

  if (briefError || !brief || brief.length === 0) {
    throw briefError ?? new Error("Failed to create daily brief demo data.");
  }

  const timelineRows = [
    ...captures.map((capture) => ({
      owner_id: demoUserId,
      event_type: "capture" as const,
      business_lane: capture.business_lane,
      headline: capture.title,
      summary: "Capture entered through the JARVIS canonical intake path.",
      happened_at: capture.happened_at,
      source_table: "capture_events" as const,
      source_id: capture.id,
    })),
    ...decisions.map((decision, index) => ({
      owner_id: demoUserId,
      event_type: "decision" as const,
      business_lane: decision.business_lane,
      headline: decision.title,
      summary:
        index === 0
          ? "Pricing analysis must precede the next expansion motion."
          : "Workflow latency is now a top product execution item.",
      happened_at: index === 0 ? yesterday.toISOString() : twoDaysAgo.toISOString(),
      source_table: "decisions" as const,
      source_id: decision.id,
    })),
    ...commitments.map((commitment) => ({
      owner_id: demoUserId,
      event_type: "commitment" as const,
      business_lane: commitment.business_lane,
      headline: commitment.title,
      summary: "Commitment seeded for the JARVIS phase 1 execution slice.",
      happened_at: commitment.due_at,
      source_table: "commitments" as const,
      source_id: commitment.id,
    })),
    {
      owner_id: demoUserId,
      event_type: "brief" as const,
      business_lane: "executive" as const,
      headline: "Wednesday operator brief published",
      summary: "The latest morning read is now available in the JARVIS briefing surface.",
      happened_at: now.toISOString(),
      source_table: "daily_briefs" as const,
      source_id: brief[0].id,
    },
  ];

  const { error: timelineError } = await supabase.from("timeline_events").insert(timelineRows);
  if (timelineError) {
    throw timelineError;
  }

  console.log("Seeded JARVIS demo data:");
  console.log(`- ${captures.length} capture events`);
  console.log(`- ${decisions.length} decisions`);
  console.log(`- ${commitments.length} commitments`);
  console.log("- 1 daily brief");
  console.log(`- ${timelineRows.length} timeline events`);
}

seedJarvisDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed JARVIS demo data", error);
    process.exit(1);
  });
