import assert from "node:assert/strict";
import { buildCellarCommandCenter } from "@/lib/cellar-command-center";

const center = buildCellarCommandCenter([
  {
    id: "review-me",
    custom_name: "Review Needed Cabernet",
    quantity: 2,
    current_market_value_cents: 12500,
    evidence_awaiting_review_count: 2,
    accepted_price_evidence_count: 1,
    stale_price_evidence_count: 0,
    ratings_count: 1,
  },
  {
    id: "stale-me",
    custom_name: "Stale Evidence Pinot",
    quantity: 1,
    current_market_value_cents: 9000,
    evidence_awaiting_review_count: 0,
    accepted_price_evidence_count: 3,
    stale_price_evidence_count: 2,
    ratings_count: 1,
  },
  {
    id: "clean",
    custom_name: "Clean Merlot",
    quantity: 1,
    current_market_value_cents: 5000,
    evidence_awaiting_review_count: 0,
    accepted_price_evidence_count: 2,
    stale_price_evidence_count: 0,
    ratings_count: 1,
  },
], { laneLimit: 4, asOf: new Date("2026-06-13T00:00:00Z") });

assert.equal(center.metrics.evidenceAwaitingReview, 2);
assert.equal(center.metrics.stalePriceEvidence, 2);
assert.equal(center.lanes.evidenceReview.length, 2);
assert.equal(center.lanes.evidenceReview[0].id, "review-me");
assert.match(center.executiveBrief, /2 price evidence items await review/);
assert.match(center.bestNextMove, /Review current intelligence/);

console.log("cellar-command-evidence tests passed");
