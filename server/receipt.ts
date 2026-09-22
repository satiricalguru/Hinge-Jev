import { createHash } from "node:crypto";
import { decide } from "../src/core/engine";
import type {
  Confirmation,
  ProviderResult,
  Receipt,
  Scenario,
  Settings,
} from "../src/core/types";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function digest(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function createReceipt(
  scenario: Scenario,
  request: string,
  settings: Settings,
  confirmations: Confirmation[],
  provider: ProviderResult,
): Receipt {
  const body = {
    schema: "hinge.receipt.v1" as const,
    engine: "0.1.0" as const,
    createdAt: new Date().toISOString(),
    scenario,
    request,
    settings,
    confirmations,
    provider,
    decision: decide(scenario, provider.probabilities, settings, confirmations),
  };
  return { ...body, digest: digest(body) };
}
export function verifyReceipt(receipt: Receipt) {
  const { digest: recorded, ...body } = receipt;
  if (
    receipt.schema !== "hinge.receipt.v1" ||
    receipt.engine !== "0.1.0" ||
    digest(body) !== recorded
  )
    return false;
  try {
    return (
      canonical(
        decide(
          receipt.scenario,
          receipt.provider.probabilities,
          receipt.settings,
          receipt.confirmations,
        ),
      ) === canonical(receipt.decision)
    );
  } catch {
    return false;
  }
}
