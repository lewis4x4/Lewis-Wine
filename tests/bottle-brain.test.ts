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
  {
    id: "market-pinot",
    displayName: "2020 Market Pinot Noir",
    producer: "Example Vineyard",
    region: "Willamette Valley",
    wineType: "red",
    quantity: 1,
    drink_after: "2023",
    drink_before: "2027",
    brian_fit_score: 93,
    brian_fit_reason: "bright cherry, savoury spice, and silky texture match Brian's pinot lane",
    ratings_count: 1,
    latest_rating_score: 95,
    notes: "Market value: $85. Great dinner wine with salmon or mushrooms.",
    tags: ["market-value", "pinot"],
    href: "/cellar/market-pinot",
  },
];

function testRetrievalFindsDrinkNowAndBrianFit() {
  const result = retrieveBottleBrainContext("What should I open tonight with high Brian-Fit?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 2,
  });

  assert.equal(result.intent, "drink_now");
  assert.equal(result.decisionMode, "tonight");
  assert.equal(result.citations[0].id, "cab-ready");
  assert.match(result.citations[0].whyRetrieved, /Brian-Fit/);
}

function testRetrievalFindsLearningGaps() {
  const result = retrieveBottleBrainContext("Which bottles need more tasting memory?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
  });

  assert.equal(result.intent, "learn");
  assert.equal(result.decisionMode, "learning");
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

function testTrustLayerBuildsEvidencePacketsForEveryCitation() {
  const retrieval = retrieveBottleBrainContext("What should I open tonight with high Brian-Fit?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 2,
  });

  assert.ok(retrieval.evidencePackets.length >= 1);
  assert.equal(retrieval.evidencePackets[0].id, retrieval.citations[0].id);
  assert.equal(retrieval.evidencePackets[0].readiness.state, "ready");
  assert.equal(retrieval.evidencePackets[0].recommendedAction, "open");
  assert.equal(retrieval.evidencePackets[0].evidenceStrength, "strong");
  assert.ok(retrieval.evidencePackets[0].knownFromCellar.some((claim) => claim.citationId === "cab-ready"));
  assert.ok(retrieval.evidencePackets[0].inferredFromBrianFit.some((claim) => claim.text.includes("96 Brian-Fit")));
  assert.ok(retrieval.evidencePackets[0].nextSignal.text.includes("Capture"));
}

function testAnswerIsCitationConstrainedAndSeparatesEvidenceTypes() {
  const retrieval = retrieveBottleBrainContext("What should I open tonight with high Brian-Fit?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 2,
  });
  const answer = buildBottleBrainAnswer("What should I open tonight with high Brian-Fit?", retrieval);

  assert.equal(answer.decisionMode, "tonight");
  assert.ok(answer.evidencePackets.length > 0);
  assert.ok(answer.groundedClaims.length > 0);
  assert.ok(answer.groundedClaims.every((claim) => claim.citationId));
  assert.ok(answer.knownFromCellar.length > 0);
  assert.ok(answer.inferredFromBrianFit.length > 0);
  assert.ok(answer.needsMoreSignal.length > 0);
  assert.ok(answer.nextSignals.length > 0);
}

function testAuditModeShowsSystemKnowledgeAndGapsWithoutInventingBottles() {
  const retrieval = retrieveBottleBrainContext("Audit what Bottle Brain knows and where it is guessing", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 5,
  });
  const answer = buildBottleBrainAnswer("Audit what Bottle Brain knows and where it is guessing", retrieval);

  assert.equal(retrieval.decisionMode, "audit");
  assert.equal(answer.decisionMode, "audit");
  assert.ok(answer.answer.includes("I can prove"));
  assert.ok(answer.answer.includes("thin"));
  assert.equal(answer.citations.length, docs.length);
  assert.ok(answer.groundedClaims.every((claim) => docs.some((doc) => doc.id === claim.citationId)));
}

function testGuestAndComparisonModesProduceTradeoffLanguage() {
  const retrieval = retrieveBottleBrainContext("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 3,
  });
  const answer = buildBottleBrainAnswer("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", retrieval);

  assert.equal(retrieval.decisionMode, "guest");
  assert.ok(answer.answer.includes("Tradeoff"));
  assert.ok(answer.answer.includes("safe pick"));
  assert.ok(answer.citations.length >= 2);
}

function testEmptyRetrievalReturnsNoUncitedClaims() {
  const retrieval = retrieveBottleBrainContext("Tell me about orange wine", [], {
    asOf: new Date("2026-06-12T12:00:00Z"),
  });
  const answer = buildBottleBrainAnswer("Tell me about orange wine", retrieval);

  assert.deepEqual(answer.groundedClaims, []);
  assert.deepEqual(answer.evidencePackets, []);
  assert.match(answer.answer, /do not have enough cellar context/i);
}

function testModeProfileExplainsStrategyAndPriorities() {
  const retrieval = retrieveBottleBrainContext("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 3,
  });
  const answer = buildBottleBrainAnswer("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", retrieval);

  assert.equal(retrieval.modeProfile.id, "guest");
  assert.match(retrieval.modeProfile.promise, /serve/i);
  assert.ok(retrieval.modeProfile.priorities.includes("crowd_confidence"));
  assert.ok(retrieval.modeProfile.guardrails.some((guardrail) => guardrail.includes("thin")));
  assert.equal(answer.modeProfile.id, retrieval.modeProfile.id);
}

function testDecisionModeAssignsBottleRolesAndTradeoffs() {
  const retrieval = retrieveBottleBrainContext("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 3,
  });
  const answer = buildBottleBrainAnswer("For guests at dinner, compare the Cabernet vs Pinot and give me the safe pick", retrieval);

  assert.equal(retrieval.evidencePackets[0].modeRole, "safe_pick");
  assert.ok(retrieval.evidencePackets.some((packet) => packet.modeRole === "interesting_pick"));
  assert.ok(answer.tradeoffs.length >= 1);
  assert.ok(answer.tradeoffs[0].winnerCitationId);
  assert.ok(answer.tradeoffs[0].reason.includes("because"));
}

function testOccasionModeExtractsScenarioSignals() {
  const retrieval = retrieveBottleBrainContext("Steak dinner celebration tonight — give me a safe pick and an interesting alternate", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 3,
  });
  const answer = buildBottleBrainAnswer("Steak dinner celebration tonight — give me a safe pick and an interesting alternate", retrieval);

  assert.equal(retrieval.decisionMode, "occasion");
  assert.ok(retrieval.occasionSignals.includes("steak"));
  assert.ok(retrieval.occasionSignals.includes("celebration"));
  assert.match(answer.answer, /occasion/i);
  assert.ok(answer.modeProfile.priorities.includes("occasion_fit"));
}

function testRiskModeHasTriageRolesAndDoesNotRecommendOpeningReadyBottleFirst() {
  const retrieval = retrieveBottleBrainContext("What is drifting or past peak and needs triage?", docs, {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 3,
  });

  assert.equal(retrieval.decisionMode, "cellar_risk");
  assert.equal(retrieval.evidencePackets[0].id, "old-bordeaux");
  assert.equal(retrieval.evidencePackets[0].modeRole, "triage_now");
  assert.equal(retrieval.evidencePackets[0].recommendedAction, "update_window");
}

function testDrinkNowDoesNotOpenHoldBottleEvenWithHighBrianFit() {
  const retrieval = retrieveBottleBrainContext("What should I open tonight with high Brian-Fit?", [
    {
      ...docs[1],
      id: "future-cab",
      displayName: "2030 Future Cabernet",
      producer: "Patience Estate",
      region: "Napa Valley",
      brian_fit_score: 99,
      ratings_count: 2,
      drink_after: "2030",
      drink_before: "2038",
      notes: "Great Cabernet, but not in window yet.",
    },
    docs[0],
  ], {
    asOf: new Date("2026-06-12T12:00:00Z"),
    limit: 2,
  });
  const answer = buildBottleBrainAnswer("What should I open tonight with high Brian-Fit?", retrieval);

  assert.equal(retrieval.citations[0].id, "cab-ready");
  assert.equal(retrieval.evidencePackets[0].recommendedAction, "open");
  assert.doesNotMatch(answer.answer, /Open 2030 Future Cabernet/i);
}

testRetrievalFindsDrinkNowAndBrianFit();
testRetrievalFindsLearningGaps();
testAnswerUsesCitationsAndUncertainty();
testTrustLayerBuildsEvidencePacketsForEveryCitation();
testAnswerIsCitationConstrainedAndSeparatesEvidenceTypes();
testAuditModeShowsSystemKnowledgeAndGapsWithoutInventingBottles();
testGuestAndComparisonModesProduceTradeoffLanguage();
testEmptyRetrievalReturnsNoUncitedClaims();
testModeProfileExplainsStrategyAndPriorities();
testDecisionModeAssignsBottleRolesAndTradeoffs();
testOccasionModeExtractsScenarioSignals();
testRiskModeHasTriageRolesAndDoesNotRecommendOpeningReadyBottleFirst();
testDrinkNowDoesNotOpenHoldBottleEvenWithHighBrianFit();

console.log("bottle-brain tests passed");
