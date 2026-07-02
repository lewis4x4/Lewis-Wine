import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function source(path: string) {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label}: expected source to include: ${needle}`);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert.equal(haystack.includes(needle), false, `${label}: expected source not to include: ${needle}`);
}

// Guard: demo/fixture content must never be the default state of a component
// that can POST to a real write endpoint. Samples are opt-in via explicit
// "load sample" affordances only.
function testAcquisitionReceiptPanelStartsEmpty() {
  const path = "src/components/wine/acquisition-receipt-panel.tsx";
  const panel = source(path);
  assertExcludes(panel, "useState(demoReceipt)", path);
  assertExcludes(panel, "useState(sampleReceipt)", path);
  assertExcludes(panel, 'useState("Benchmark Wine Shop")', path);
  assertIncludes(panel, 'const [vendor, setVendor] = useState("")', path);
  assertIncludes(panel, 'const [receiptText, setReceiptText] = useState("")', path);
  assertIncludes(panel, "Load sample receipt", path);
}

function testFieldCaptureTastingFieldsStartEmpty() {
  const path = "src/components/wine/field-capture-experience.tsx";
  const experience = source(path);
  assertIncludes(experience, 'useState(initialDemo ? initialDescriptors : "")', path);
  assertIncludes(experience, 'useState(initialDemo ? initialNotes : "")', path);
  assertExcludes(experience, "|| initialDescriptors", path);
  assertExcludes(experience, "|| initialNotes", path);
}

function testWineListAdvisorStartsEmpty() {
  const path = "src/components/wine/wine-list-advisor.tsx";
  const advisor = source(path);
  assertExcludes(advisor, "useState(sampleText)", path);
  assertExcludes(advisor, 'useState("Fixture Steakhouse")', path);
  assertIncludes(advisor, 'const [pastedText, setPastedText] = useState("")', path);
}

function testShoppingModePanelStartsEmpty() {
  const path = "src/components/wine/shopping-mode-panel.tsx";
  const panel = source(path);
  assertExcludes(panel, "useState(demoText)", path);
  assertIncludes(panel, 'const [text, setText] = useState("")', path);
}

function testGreatWineCaptureStaysDeleted() {
  assert.equal(
    existsSync("src/components/wine/great-wine-capture.tsx"),
    false,
    "great-wine-capture.tsx was dead demo-ware (broken endpoint, no-op save); do not resurrect it"
  );
}

testAcquisitionReceiptPanelStartsEmpty();
testFieldCaptureTastingFieldsStartEmpty();
testWineListAdvisorStartsEmpty();
testShoppingModePanelStartsEmpty();
testGreatWineCaptureStaysDeleted();

console.log("demo-fixture-guard tests passed");
