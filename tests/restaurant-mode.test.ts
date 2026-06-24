import assert from "node:assert/strict";
import {
  buildRestaurantMode,
  parseRestaurantWineText,
  type RestaurantModeInput,
} from "../src/lib/restaurant-mode";

const pastedList = `
2021 Tapiz Alta Collection Cabernet Sauvignon, Mendoza 92
2020 Lewis Cellars Reserve Cabernet, Napa Valley 175
2022 Willamette Fixture Pinot Noir, Willamette Valley 74
2021 Miss Merlot, Bordeaux 45
`;

const profile: RestaurantModeInput["profile"] = {
  lovedDescriptors: ["smooth", "rich", "long finish", "black fruit"],
  preferredRegions: ["Mendoza", "Napa Valley"],
  preferredVarietals: ["Cabernet Sauvignon"],
  preferredProducers: ["Tapiz", "Lewis Cellars"],
  priceBand: { low: 60, typical: 100, high: 150 },
  avoidList: ["Miss Merlot"],
  benchmarkWineIds: ["tapiz-2021"],
  refreshedAt: "2026-06-24T00:00:00.000Z",
};

function testParserExtractsRestaurantCandidates() {
  const items = parseRestaurantWineText(pastedList);

  assert.equal(items.length, 4);
  assert.deepEqual(items[0], {
    producer: "Tapiz",
    label: "Alta Collection Cabernet Sauvignon",
    vintage: 2021,
    varietal: "Cabernet Sauvignon",
    region: "Mendoza",
    price: 92,
    descriptors: ["black fruit", "structured", "smooth", "rich"],
    readiness: "drink_now",
    valueFlag: "fair",
  });
  assert.equal(items[2].varietal, "Pinot Noir");
  assert.equal(items[3].producer, "Miss");
}

function testRestaurantModeBuildsDecisionReadyPicks() {
  const result = buildRestaurantMode({
    restaurant: "Fixture Steakhouse",
    cuisine: "steakhouse dinner",
    context: "impressive but not silly",
    profile,
    items: parseRestaurantWineText(pastedList),
  });

  assert.equal(result.headline, "Pour the 2021 Tapiz Alta Collection Cabernet Sauvignon.");
  assert.equal(result.picks.bestBottleTonight?.item.producer, "Tapiz");
  assert.equal(result.picks.bestValue?.item.producer, "Tapiz");
  assert.equal(result.picks.splurgePick?.item.producer, "Lewis Cellars");
  assert.equal(result.picks.skip?.item.producer, "Miss");
  assert.equal(result.picks.bestBottleTonight?.decision, "Pour");
  assert.equal(result.recommendations[0].confidence.label, "High");
  assert.match(result.picks.bestBottleTonight?.why.join(" ") ?? "", /Tapiz|benchmark|Mendoza|Cabernet/i);
}

function testRestaurantModeAsksUsefulSommQuestion() {
  const result = buildRestaurantMode({
    restaurant: "Fixture Steakhouse",
    cuisine: "steakhouse dinner",
    context: "impressive but not silly",
    profile,
    items: parseRestaurantWineText(pastedList),
  });

  assert.match(result.sommQuestion, /Tapiz|Mendoza|Cabernet|2021/i);
  assert.equal(result.summary.total, 4);
  assert.equal(result.summary.pour, 2);
  assert.equal(result.summary.skip, 1);
}

function testEmptyRestaurantModeIsHonest() {
  const result = buildRestaurantMode({ cuisine: "dinner", profile, items: [] });

  assert.equal(result.headline, "Upload or paste a wine list to get a Pourfolio read.");
  assert.equal(result.summary.total, 0);
  assert.equal(result.recommendations.length, 0);
  assert.equal(result.picks.bestBottleTonight, null);
  assert.match(result.sommQuestion, /photo|list/i);
}

testParserExtractsRestaurantCandidates();
testRestaurantModeBuildsDecisionReadyPicks();
testRestaurantModeAsksUsefulSommQuestion();
testEmptyRestaurantModeIsHonest();

console.log("restaurant-mode tests passed");
