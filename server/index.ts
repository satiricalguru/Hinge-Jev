import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getScenario } from "../src/core/scenarios";
import { evaluateProvider } from "./provider";
import { createReceipt } from "./receipt";

const root = fileURLToPath(new URL("..", import.meta.url));
if (existsSync(resolve(root, ".env")))
  process.loadEnvFile(resolve(root, ".env"));
const port = Number(process.env.PORT ?? 5173);
const requestSchema = z
  .object({
    scenarioId: z.enum(["atlas", "release", "sharing"]),
    request: z.string().trim().min(1).max(4000),
    mode: z.enum(["fixture", "jev"]),
    settings: z
      .object({
        riskBudget: z.number().min(0).max(100),
        ambiguity: z.number().min(0).max(1),
        questionCost: z.number().min(0).max(100),
      })
      .strict(),
    confirmations: z
      .array(
        z
          .object({
            questionId: z.string().max(50),
            answerId: z.string().max(50),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > 16384) throw new Error("Request too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
let inFlight = 0;
const vite =
  process.env.NODE_ENV !== "production"
    ? await (
        await import("vite")
      ).createServer({ root, server: { middlewareMode: true }, appType: "spa" })
    : null;
const server = createServer(async (req, res) => {
  const pathname = req.url?.split("?")[0] ?? "/";
  const allowedHosts = [
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ];
  if (!allowedHosts.includes(req.headers.host ?? ""))
    return json(res, 403, { error: "Local access only." });
  if (
    req.headers.origin &&
    !allowedHosts.some((h) => req.headers.origin === `http://${h}`)
  )
    return json(res, 403, { error: "Origin not allowed." });
  if (pathname === "/api/health" && req.method === "GET")
    return json(res, 200, {
      liveAvailable: Boolean(process.env.TYPESAFE_API_KEY),
      model: process.env.TYPESAFE_MODEL ?? "jev-1.13.0",
      version: "0.1.0",
    });
  if (pathname === "/api/evaluate" && req.method === "POST") {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return json(res, 415, { error: "Use application/json." });
    if (inFlight >= 3)
      return json(res, 429, { error: "Too many simultaneous requests." });
    inFlight++;
    try {
      const parsed = requestSchema.safeParse(await readBody(req));
      if (!parsed.success)
        return json(res, 400, { error: "Invalid evaluation request." });
      const { scenarioId, request, mode, settings, confirmations } =
        parsed.data;
      const scenario = getScenario(scenarioId);
      // Validate confirmation semantics before spending an upstream call.
      const { decide } = await import("../src/core/engine");
      decide(scenario, scenario.fixture, settings, confirmations);
      const provider = await evaluateProvider(scenario, request, mode);
      return json(
        res,
        200,
        createReceipt(scenario, request, settings, confirmations, provider),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Evaluation failed.";
      const safeMessage =
        message.startsWith("Jev") ||
        message.startsWith("Set TYPESAFE") ||
        message.startsWith("Fixture") ||
        message.startsWith("Invalid or repeated")
          ? message
          : "Evaluation failed. Check the request or retry the provider.";
      return json(res, 422, { error: safeMessage });
    } finally {
      inFlight--;
    }
  }
  if (pathname.startsWith("/api/"))
    return json(res, 404, { error: "Not found." });
  if (vite) return vite.middlewares(req, res);
  const dist = resolve(root, "dist");
  let path: string;
  try {
    path = resolve(dist, "." + decodeURIComponent(pathname));
  } catch {
    return json(res, 400, { error: "Bad path." });
  }
  if (!path.startsWith(dist + sep)) path = resolve(dist, "index.html");
  if (!existsSync(path) || !extname(path)) path = resolve(dist, "index.html");
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  try {
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(readFileSync(path));
  } catch {
    json(res, 404, { error: "Build the workbench with npm run build first." });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Hinge ready at http://127.0.0.1:${port} · ${process.env.TYPESAFE_API_KEY ? "Jev available" : "fixture mode; add TYPESAFE_API_KEY for live inference"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    void vite?.close().finally(() => process.exit(0));
    if (!vite) process.exit(0);
  });
