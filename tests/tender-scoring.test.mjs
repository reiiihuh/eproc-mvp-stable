import assert from "node:assert/strict";
import test from "node:test";

import { calculateScorecard } from "../lib/tender-scoring.ts";

const vendor = (id, name, initialPrice, finalPrice, technicalScore) => ({
  id,
  name,
  initialPrice,
  finalPrice,
  technicalScore,
  notes: "",
});

test("matches the supplied 70/30 normalized scoring template", () => {
  const result = calculateScorecard({
    id: "reference",
    projectName: "AdHoc Pentest",
    requestId: "",
    scoringDate: "2026-09-03",
    evaluator: "",
    scheme: "normalized",
    technicalWeight: 70,
    commercialWeight: 30,
    technicalMaxScore: 100,
    commercialMaxScore: 100,
    vendors: [
      vendor("acsi", "ACSI", 30_000_000, 18_500_000, 95.3),
      vendor("q2", "Q2", 28_000_000, 28_000_000, 93.85),
    ],
  });

  assert.equal(result.ranking[0].name, "ACSI");
  assert.equal(result.ranking[0].finalScore, 96.71);
  assert.ok(Math.abs(result.ranking[1].commercialScore - 66.07142857) < 0.000001);
  assert.ok(Math.abs(result.ranking[1].finalScore - 85.51642857) < 0.000001);
});

test("keeps already-weighted 70/30 scores on their native scale", () => {
  const result = calculateScorecard({
    id: "weighted",
    projectName: "Weighted",
    requestId: "",
    scoringDate: "2026-09-03",
    evaluator: "",
    scheme: "weighted",
    technicalWeight: 70,
    commercialWeight: 30,
    technicalMaxScore: 100,
    commercialMaxScore: 100,
    vendors: [
      vendor("a", "Vendor A", 20_000_000, 20_000_000, 65),
      vendor("b", "Vendor B", 25_000_000, 25_000_000, 60),
    ],
  });

  assert.equal(result.ranking[0].weightedTechnical, 65);
  assert.equal(result.ranking[0].weightedCommercial, 30);
  assert.equal(result.ranking[0].finalScore, 95);
});
