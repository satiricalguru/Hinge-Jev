import test from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  validateDistribution,
  validateScenario,
  worstCaseLoss,
} from "../src/core/engine";
import { defaultSettings, scenarios } from "../src/core/scenarios";
import { createReceipt, verifyReceipt } from "../server/receipt";
import { evaluateProvider } from "../server/provider";

test("all scenario questions form exhaustive, disjoint partitions", () => {
  for (const scenario of scenarios) {
    validateScenario(scenario);
    validateDistribution(
      scenario.fixture,
      scenario.worlds.map((w) => w.id),
    );
  }
});
test("total-variation optimizer matches exhaustive grid optimization", () => {
  for (let a = 0; a <= 4; a++)
    for (let b = 0; b <= 4 - a; b++) {
      const p = { a: a / 4, b: b / 4, c: (4 - a - b) / 4 };
      for (const radius of [0, 0.25, 0.5, 1]) {
        let max = 0;
        for (let qa = 0; qa <= 4; qa++)
          for (let qb = 0; qb <= 4 - qa; qb++) {
            const q = { a: qa / 4, b: qb / 4, c: (4 - qa - qb) / 4 };
            const tv =
              (Math.abs(q.a - p.a) +
                Math.abs(q.b - p.b) +
                Math.abs(q.c - p.c)) /
              2;
            if (tv <= radius + 1e-10)
              max = Math.max(max, q.a * 1 + q.b * 5 + q.c * 12);
          }
        assert.ok(
          Math.abs(worstCaseLoss(p, { a: 1, b: 5, c: 12 }, radius) - max) <
            1e-9,
        );
      }
    }
});
test("probability stress never improves the best-action risk", () => {
  for (const scenario of scenarios) {
    const risks = [0, 0.03, 0.1, 0.4, 1].map(
      (ambiguity) =>
        decide(scenario, scenario.fixture, { ...defaultSettings, ambiguity })
          .risk,
    );
    assert.ok(risks.every((risk, i) => !i || risk >= risks[i - 1] - 1e-9));
  }
});
test("ambiguous cleanup asks an environment question, then resolves through truthful answers", () => {
  const s = scenarios[0];
  const initial = decide(s, s.fixture, defaultSettings);
  assert.equal(initial.kind, "ask");
  assert.equal(initial.nextQuestion, "environment");
  const first = { questionId: "environment", answerId: "staging" };
  const conditioned = decide(s, s.fixture, defaultSettings, [first]);
  assert.equal(conditioned.probabilities.archive_production, 0);
  assert.ok(
    Math.abs(conditioned.probabilities.archive_staging - 0.38 / 0.68) < 1e-9,
  );
  const resolved = decide(s, s.fixture, defaultSettings, [
    first,
    { questionId: "retention", answerId: "archive" },
  ]);
  assert.equal(resolved.kind, "act");
  assert.equal(resolved.bestAction, "archive_staging");
  assert.equal(resolved.risk, 0);
});
test("a high interruption cost does not permit over-budget proposals", () => {
  const s = scenarios[0];
  const d = decide(s, s.fixture, { ...defaultSettings, questionCost: 100 });
  assert.equal(d.kind, "defer");
  assert.equal(d.nextQuestion, null);
});
test("outside-model mass and contradictory confirmations defer", () => {
  const s = scenarios[0];
  assert.equal(
    decide(
      s,
      {
        archive_staging: 0,
        delete_staging: 0,
        archive_production: 0,
        delete_production: 0,
        other: 1,
      },
      defaultSettings,
    ).kind,
    "defer",
  );
  assert.equal(
    decide(s, s.fixture, defaultSettings, [
      { questionId: "environment", answerId: "other" },
      { questionId: "retention", answerId: "archive" },
    ]).kind,
    "defer",
  );
  assert.equal(
    decide(
      s,
      {
        archive_staging: 1,
        delete_staging: 0,
        archive_production: 0,
        delete_production: 0,
        other: 0,
      },
      defaultSettings,
      [{ questionId: "environment", answerId: "production" }],
    ).kind,
    "defer",
  );
});
test("rejects invalid distributions, matrices, partitions, settings, and answers", () => {
  assert.throws(() => validateDistribution({ a: 0.9 }, ["a", "b"]));
  assert.throws(() => validateDistribution({ a: NaN, b: 0 }, ["a", "b"]));
  assert.throws(() => validateDistribution({ a: 0.1, b: 0.1 }, ["a", "b"]));
  assert.throws(() => validateDistribution({ a: -1, b: 2 }, ["a", "b"]));
  const s = scenarios[0];
  assert.throws(() =>
    decide(s, s.fixture, { ...defaultSettings, ambiguity: -1 }),
  );
  assert.throws(() =>
    decide(s, s.fixture, defaultSettings, [
      { questionId: "environment", answerId: "fake" },
    ]),
  );
  assert.throws(() =>
    decide(s, s.fixture, defaultSettings, [
      { questionId: "environment", answerId: "staging" },
      { questionId: "environment", answerId: "production" },
    ]),
  );
  const invalid = structuredClone(s);
  delete invalid.actions[0].losses.other;
  assert.throws(() => validateScenario(invalid));
  const overlap = structuredClone(s);
  overlap.questions[0].answers[0].worlds.push("other");
  assert.throws(() => validateScenario(overlap));
});
test("receipt replays and detects modified policy or decision", async () => {
  const s = scenarios[0];
  const provider = await evaluateProvider(s, s.request, "fixture");
  const receipt = createReceipt(s, s.request, defaultSettings, [], provider);
  assert.ok(verifyReceipt(receipt));
  assert.equal(
    verifyReceipt({
      ...receipt,
      settings: { ...receipt.settings, ambiguity: 0.8 },
    }),
    false,
  );
  const changed = structuredClone(receipt);
  changed.decision.kind = "act";
  assert.equal(verifyReceipt(changed), false);
});
