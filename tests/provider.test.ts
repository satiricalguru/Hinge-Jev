import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJevRequest,
  evaluateProvider,
  parseJevResponse,
} from "../server/provider";
import { scenarios } from "../src/core/scenarios";
const s = scenarios[0];
const valid = () => ({
  model: "jev-1.13.0",
  answers: {
    intent: {
      type: "choice",
      choice: "archive_staging",
      confidence: 0.2,
      probabilities: { ...s.fixture },
    },
  },
  usage: { input_tokens: 350, output_tokens: 30 },
});
test("Jev uses documented systemone Choice contract and includes unknown intent", () => {
  const request = buildJevRequest(s, "custom text", "jev-1.13.0");
  assert.equal(request.state.user_request, "custom text");
  assert.equal(request.questions.intent.type, "choice");
  assert.ok(request.questions.intent.criteria.other);
  assert.equal(Object.keys(request.questions).length, 1);
});
test("provider contract validates response, model, probabilities, confidence, and usage", () => {
  const result = parseJevResponse(valid(), s, 240);
  assert.equal(result.source, "jev");
  assert.equal(result.latencyMs, 240);
  for (const bad of [
    null,
    {},
    { ...valid(), model: null },
    { ...valid(), usage: { input_tokens: -3, output_tokens: 0 } },
  ])
    assert.throws(() => parseJevResponse(bad, s, 0));
  const p = valid();
  p.answers.intent.probabilities.other = 0.8;
  assert.throws(() => parseJevResponse(p, s, 0));
  const c = valid();
  c.answers.intent.choice = "delete_production";
  assert.throws(() => parseJevResponse(c, s, 0));
});
test("live transport uses fixed origin and server-side authorization", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(input, "https://api.typesafe.ai/v1/systemone");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-key",
    );
    assert.equal(JSON.parse(init?.body as string).model, "jev-1.13.0");
    return Response.json(valid());
  };
  const result = await evaluateProvider(s, s.request, "jev", {
    apiKey: "test-key",
    fetcher,
    model: "jev-1.13.0",
  });
  assert.equal(result.source, "jev");
});
test("authentication, timeout, and malformed responses never become fixtures", async () => {
  await assert.rejects(
    evaluateProvider(s, s.request, "jev", {
      apiKey: "test",
      fetcher: async () => new Response("", { status: 401 }),
    }),
    /HTTP 401/,
  );
  await assert.rejects(
    evaluateProvider(s, s.request, "jev", {
      apiKey: "test",
      fetcher: async () => {
        throw new Error("timeout");
      },
    }),
    /timeout/,
  );
  await assert.rejects(
    evaluateProvider(s, s.request, "jev", {
      apiKey: "test",
      fetcher: async () => Response.json({}),
    }),
    /invalid/,
  );
});
test("fixtures cannot masquerade as inference on edited text", async () => {
  await assert.rejects(
    evaluateProvider(s, "changed request", "fixture"),
    /original example/,
  );
  const result = await evaluateProvider(s, s.request, "fixture");
  assert.equal(result.confidence, null);
  assert.equal(result.usage, null);
  assert.equal(result.source, "fixture");
});
