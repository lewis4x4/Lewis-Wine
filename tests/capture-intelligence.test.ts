import assert from "node:assert/strict";
import {
  buildCaptureIntelligenceNotes,
  deriveCaptureQuality,
  normalizeDescriptorList,
  parseCaptureSignalParams,
} from "../src/lib/capture-intelligence";

function testNormalizeDescriptorList() {
  assert.deepEqual(
    normalizeDescriptorList([" dark fruit ", "Oak", "dark fruit", "", "black cherry"]),
    ["dark fruit", "oak", "black cherry"]
  );
}

function testDeriveCaptureQuality() {
  assert.equal(deriveCaptureQuality({ confidence: 91, descriptorCount: 3 }), "strong");
  assert.equal(deriveCaptureQuality({ confidence: 72, descriptorCount: 1 }), "useful");
  assert.equal(deriveCaptureQuality({ confidence: 41, descriptorCount: 4 }), "thin");
}

function testBuildCaptureIntelligenceNotes() {
  const notes = buildCaptureIntelligenceNotes({
    source: "label_scan",
    rawText: "Estate Cabernet Sauvignon Napa Valley 2021",
    confidence: 88,
    descriptors: ["dark fruit", "cedar", "structured tannin"],
    brianFitHint: "Likely aligns with Brian's preference for dark-fruited, structured reds.",
    suggestedTastingNote: "Dark fruit and cedar profile; confirm tannin and finish after tasting.",
  });

  assert.match(notes, /Capture Intelligence/);
  assert.match(notes, /Source: Label scan/);
  assert.match(notes, /Capture quality: Strong/);
  assert.match(notes, /Descriptors: dark fruit, cedar, structured tannin/);
  assert.match(notes, /Brian-Fit hint: Likely aligns/);
  assert.match(notes, /Raw capture: Estate Cabernet Sauvignon Napa Valley 2021/);
}

function testParseCaptureSignalParams() {
  const params = new URLSearchParams({
    capture_source: "label_scan",
    capture_confidence: "86",
    capture_descriptors: "dark fruit, cedar, dark fruit",
    capture_brian_fit_hint: "Strong Brian-Fit candidate.",
    capture_tasting_note: "Dark fruit and cedar; verify after drinking.",
    notes: "Front label text",
  });

  assert.deepEqual(parseCaptureSignalParams(params), {
    source: "label_scan",
    confidence: 86,
    descriptors: ["dark fruit", "cedar"],
    brianFitHint: "Strong Brian-Fit candidate.",
    suggestedTastingNote: "Dark fruit and cedar; verify after drinking.",
    rawText: "Front label text",
  });
}

testNormalizeDescriptorList();
testDeriveCaptureQuality();
testBuildCaptureIntelligenceNotes();
testParseCaptureSignalParams();

console.log("capture-intelligence tests passed");
