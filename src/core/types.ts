export type Distribution = Record<string, number>;
export interface World {
  id: string;
  label: string;
  description: string;
  color: string;
}
export interface Action {
  id: string;
  label: string;
  description: string;
  losses: Record<string, number>;
}
export interface Answer {
  id: string;
  label: string;
  worlds: string[];
}
export interface Question {
  id: string;
  text: string;
  cost: number;
  answers: Answer[];
}
export interface Scenario {
  id: string;
  name: string;
  category: string;
  description: string;
  request: string;
  context: string;
  worlds: World[];
  actions: Action[];
  questions: Question[];
  fixture: Distribution;
  unknownId: string;
  version: string;
}
export interface Settings {
  riskBudget: number;
  ambiguity: number;
  questionCost: number;
}
export interface Confirmation {
  questionId: string;
  answerId: string;
}
export interface ActionRisk {
  id: string;
  expectedLoss: number;
  robustLoss: number;
}
export interface QuestionValue {
  id: string;
  expectedResidual: number;
  grossValue: number;
  netValue: number;
  cost: number;
  branches: {
    answerId: string;
    probability: number;
    bestAction: string;
    robustLoss: number;
  }[];
}
export interface Decision {
  kind: "ask" | "act" | "defer";
  reason: string;
  probabilities: Distribution;
  actions: ActionRisk[];
  bestAction: string;
  risk: number;
  questions: QuestionValue[];
  nextQuestion: string | null;
  eliminated: string[];
}
export interface ProviderResult {
  source: "fixture" | "jev";
  model: string;
  probabilities: Distribution;
  confidence: number | null;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number } | null;
}
export interface Receipt {
  schema: "hinge.receipt.v1";
  engine: "0.1.0";
  createdAt: string;
  scenario: Scenario;
  request: string;
  settings: Settings;
  confirmations: Confirmation[];
  provider: ProviderResult;
  decision: Decision;
  digest: string;
}
