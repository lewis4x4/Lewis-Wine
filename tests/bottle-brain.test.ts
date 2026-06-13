import assert from "node:assert/strict";
import {
  buildBottleBrainAnswer,
  retrieveBottleBrainContext,
  type BottleBrainWineDoc,
} from "../src/lib/bottle-brain";

const docs: BottleBrainWineDoc[] = [
  {
    id: "cab-ready",
    displayName: "2021 Estate Cabernet",
    producer: "Lewis Cellars",
    region: "Napa Valley",
    wineType: "red",
    quantity: 2,
    drink_after: "2024",
    drink_before: "2028",
    brian_fit_score: 96,
    brian_fit_reason: "dark fruit and polished tannin align with Brian's profile",
    ratings_count: 2,
    latest_rating_score: 94,
    notes: "Capture Intelligence\nDescriptors: dark fruit, cedar, structured tannin",
    tags: ["capture-intelligence"],
    href: "/cellar/cab-ready",
  },
  {
    id: "mystery-burgundy",
    displayName: "Mystery Burgundy",
    producer: "Unknown",
    region: "Burgundy",
    wineType: "red",
    quantity: 1,
    drink_after: "2026",
    drink_before: "2030",
    brian_fit_score: null,
    brian_fit_reason: null,
    ratings_count: 0,
    latest_rating_score: null,
    notes: "Needs first tasting note.",
    tags: [],
    href: "/cellar/mystery-burgundy",
  },
  {
    id: "old-bordeaux",
    displayName: "2012 Old Bordeaux",
    producer: "Chateau Example",
    region: "Bordeaux",
    wineType: "red",
    quantity: 1,
    drink_after: "2018",
    drink_before: "2024",
    brian_fit_score: 88,
    brian_fit_reason: "classic structure, but fit is less certain",
    ratings_count: 1,
    latest_rating_score: 89,
    notes: "Past peak concern.",
    tags: [],
    href: "/cellar/old-bordeaux",
  },
];

function testRetrievalFindsDrinkNowAndBrianFit() {
  const result = retrieveBottleBrainContext("What should I open tonight with high Brian-Fit?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 2,
  });

  assert.equal(result.intent, "drink_now");
  assert.equal(result.citations[0].id, "cab-ready");
  assert.match(result.citations[0].whyRetrieved, /Brian-Fit/);
}

function testRetrievalFindsLearningGaps() {
  const result = retrieveBottleBrainContext("Which bottles need more tasting memory?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
  });

  assert.equal(result.intent, "learn");
  assert.equal(result.citations[0].id, "mystery-burgundy");
  assert.match(result.citations[0].whyRetrieved, /no first-party tasting memory/);
}

function testAnswerUsesCitationsAndUncertainty() {
  const retrieval = retrieveBottleBrainContext("What should I do about past peak bottles?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
  });
  const answer = buildBottleBrainAnswer("What should I do about past peak bottles?", retrieval);

  assert.match(answer.answer, /2012 Old Bordeaux/);
  assert.match(answer.answer, /past/i);
  assert.equal(answer.citations[0].id, "old-bordeaux");
  assert.match(answer.confidenceNote, /grounded in 1 cellar record/);
}

testRetrievalFindsDrinkNowAndBrianFit();
testRetrievalFindsLearningGaps();
testAnswerUsesCitationsAndUncertainty();

console.log("bottle-brain tests passed");
