import type {
  ActionRisk,
  Confirmation,
  Decision,
  Distribution,
  Scenario,
  Settings,
} from "./types";

export function validateDistribution(
  probabilities: Distribution,
  ids: string[],
): void {
  if (
    !probabilities ||
    Object.keys(probabilities).length !== ids.length ||
    ids.some((id) => !Object.hasOwn(probabilities, id))
  )
    throw new Error("Probability support does not match the scenario.");
  const values = ids.map((id) => probabilities[id]);
  if (values.some((p) => !Number.isFinite(p) || p < 0 || p > 1))
    throw new Error("Invalid probability.");
  if (Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 1e-6)
    throw new Error("Probabilities must sum to one.");
}

/** Exact worst-case expectation inside a total-variation ball on the given support. */
export function worstCaseLoss(
  p: Distribution,
  losses: Distribution,
  radius: number,
  support = Object.keys(p),
): number {
  if (
    !Number.isFinite(radius) ||
    radius < 0 ||
    radius > 1 ||
    !support.length ||
    new Set(support).size !== support.length
  )
    throw new Error("Invalid ambiguity set.");
  const sorted = support
    .map((id) => ({ p: p[id], loss: losses[id] }))
    .sort((a, b) => a.loss - b.loss);
  if (
    sorted.some(
      (x) =>
        !Number.isFinite(x.loss) ||
        x.loss < 0 ||
        !Number.isFinite(x.p) ||
        x.p < 0 ||
        x.p > 1,
    ) ||
    Math.abs(sorted.reduce((sum, x) => sum + x.p, 0) - 1) > 1e-6
  )
    throw new Error("Invalid loss matrix or distribution.");
  let remaining = radius,
    lo = 0,
    hi = sorted.length - 1;
  while (remaining > 1e-12 && lo < hi) {
    const from = sorted[lo],
      to = sorted[hi];
    const transfer = Math.min(from.p, 1 - to.p, remaining);
    from.p -= transfer;
    to.p += transfer;
    remaining -= transfer;
    if (from.p < 1e-12) lo++;
    if (1 - to.p < 1e-12) hi--;
  }
  return sorted.reduce((sum, x) => sum + x.p * x.loss, 0);
}

function risks(
  scenario: Scenario,
  p: Distribution,
  settings: Settings,
  support: string[],
): ActionRisk[] {
  return scenario.actions
    .map((a) => ({
      id: a.id,
      expectedLoss: Object.entries(p).reduce(
        (sum, [id, probability]) => sum + probability * a.losses[id],
        0,
      ),
      robustLoss: worstCaseLoss(p, a.losses, settings.ambiguity, support),
    }))
    .sort(
      (a, b) =>
        a.robustLoss - b.robustLoss ||
        a.expectedLoss - b.expectedLoss ||
        a.id.localeCompare(b.id),
    );
}

export function validateScenario(s: Scenario) {
  const ids = s.worlds.map((w) => w.id);
  if (
    ids.length < 2 ||
    ids.length > 255 ||
    new Set(ids).size !== ids.length ||
    !ids.includes(s.unknownId)
  )
    throw new Error("Invalid worlds.");
  if (
    !s.actions.length ||
    new Set(s.actions.map((a) => a.id)).size !== s.actions.length
  )
    throw new Error("Invalid actions.");
  for (const action of s.actions) {
    if (
      Object.keys(action.losses).length !== ids.length ||
      ids.some(
        (id) => !Number.isFinite(action.losses[id]) || action.losses[id] < 0,
      )
    )
      throw new Error("Incomplete loss matrix.");
  }
  if (new Set(s.questions.map((q) => q.id)).size !== s.questions.length)
    throw new Error("Duplicate question.");
  for (const question of s.questions) {
    const partition = question.answers.flatMap((a) => a.worlds);
    if (
      !Number.isFinite(question.cost) ||
      question.cost < 0 ||
      new Set(question.answers.map((a) => a.id)).size !==
        question.answers.length ||
      question.answers.some((a) => !a.worlds.length) ||
      partition.length !== ids.length ||
      new Set(partition).size !== ids.length ||
      ids.some((id) => !partition.includes(id))
    )
      throw new Error("Answers must partition the worlds exactly.");
  }
}

export function decide(
  scenario: Scenario,
  prior: Distribution,
  settings: Settings,
  confirmations: Confirmation[] = [],
): Decision {
  validateScenario(scenario);
  const ids = scenario.worlds.map((w) => w.id);
  validateDistribution(prior, ids);
  if (
    !Number.isFinite(settings.riskBudget) ||
    settings.riskBudget < 0 ||
    !Number.isFinite(settings.questionCost) ||
    settings.questionCost < 0 ||
    !Number.isFinite(settings.ambiguity) ||
    settings.ambiguity < 0 ||
    settings.ambiguity > 1
  )
    throw new Error("Invalid policy settings.");
  let support = [...ids];
  const seen = new Set<string>();
  for (const confirmation of confirmations) {
    const answer = scenario.questions
      .find((q) => q.id === confirmation.questionId)
      ?.answers.find((a) => a.id === confirmation.answerId);
    if (!answer || seen.has(confirmation.questionId))
      throw new Error("Invalid or repeated confirmation.");
    seen.add(confirmation.questionId);
    support = support.filter((id) => answer.worlds.includes(id));
  }
  const mass = support.reduce((sum, id) => sum + prior[id], 0);
  const probabilities = Object.fromEntries(
    ids.map((id) => [
      id,
      support.includes(id) && mass > 0 ? prior[id] / mass : 0,
    ]),
  );
  if (!support.length || mass <= 1e-12)
    return {
      kind: "defer",
      reason:
        "The confirmed answer contradicts the modeled support. Re-evaluate the request with new evidence.",
      probabilities: { ...prior },
      actions: [],
      bestAction: "",
      risk: 0,
      questions: [],
      nextQuestion: null,
      eliminated: ids.filter((id) => !support.includes(id)),
    };
  const actions = risks(scenario, probabilities, settings, support);
  const best = actions[0];
  const questions = scenario.questions
    .filter((q) => !seen.has(q.id))
    .map((q) => {
      const branches = q.answers.map((answer) => {
        const subset = support.filter((id) => answer.worlds.includes(id));
        const probability = subset.reduce(
          (sum, id) => sum + probabilities[id],
          0,
        );
        if (probability <= 1e-12)
          return {
            answerId: answer.id,
            probability: 0,
            bestAction: "",
            robustLoss: 0,
          };
        const posterior = Object.fromEntries(
          ids.map((id) => [
            id,
            subset.includes(id) ? probabilities[id] / probability : 0,
          ]),
        );
        const result = risks(scenario, posterior, settings, subset)[0];
        return {
          answerId: answer.id,
          probability,
          bestAction: result.id,
          robustLoss: result.robustLoss,
        };
      });
      const expectedResidual = branches.reduce(
        (sum, b) => sum + b.probability * b.robustLoss,
        0,
      );
      const cost = q.cost * settings.questionCost;
      return {
        id: q.id,
        expectedResidual,
        grossValue: best.robustLoss - expectedResidual,
        netValue: best.robustLoss - expectedResidual - cost,
        cost,
        branches,
      };
    })
    .sort((a, b) => b.netValue - a.netValue || a.id.localeCompare(b.id));
  const base = {
    probabilities,
    actions,
    bestAction: best.id,
    risk: best.robustLoss,
    questions,
    eliminated: ids.filter((id) => !support.includes(id)),
  };
  if (probabilities[scenario.unknownId] >= 0.2)
    return {
      ...base,
      kind: "defer",
      reason:
        "Too much probability lies outside the modeled task. Human review is required.",
      nextQuestion: null,
    };
  if (questions[0]?.netValue > 1e-9)
    return {
      ...base,
      kind: "ask",
      reason:
        "A clarification has positive modeled value after accounting for interruption cost.",
      nextQuestion: questions[0].id,
    };
  if (best.robustLoss <= settings.riskBudget)
    return {
      ...base,
      kind: "act",
      reason:
        "The lowest-risk proposal fits the configured risk budget. Normal authorization is still required.",
      nextQuestion: null,
    };
  return {
    ...base,
    kind: "defer",
    reason:
      "No worthwhile clarification remains and the proposal exceeds the risk budget.",
    nextQuestion: null,
  };
}
