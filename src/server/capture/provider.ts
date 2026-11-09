// AI provider abstraction (D94, D95, D100). The capture service only sees
// "text or a typed failure"; parsing and every trust decision happen after.

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { MODEL_OUTPUT_JSON_SCHEMA } from "./model-output";
import type { Prompt } from "./prompt";
import { fakeProvider } from "./fake-provider";

export type ProviderFailure = "NO_KEY" | "TIMEOUT" | "UPSTREAM_BUSY" | "API_ERROR";
export type ProviderResult = { ok: true; text: string; model: string } | { ok: false; reason: ProviderFailure; model: string };

export interface CaptureProvider {
  readonly name: string;
  extract(prompt: Prompt, context: { shortIdByCode: ReadonlyMap<string, string>; message: string }): Promise<ProviderResult>;
}

export const CAPTURE_TIMEOUT_MS = 8_000;
export const MAX_OUTPUT_TOKENS = 4_096;

type Generate = (args: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) => Promise<{ text?: string | undefined }>;

/** Gemini via @google/genai (2.x). The client is injectable for tests. */
export function geminiProvider(model: string, generate: Generate, timeoutMs = CAPTURE_TIMEOUT_MS): CaptureProvider {
  return {
    name: model,
    async extract(prompt) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await generate({
          model,
          contents: prompt.user,
          config: {
            systemInstruction: prompt.system,
            responseMimeType: "application/json",
            responseJsonSchema: MODEL_OUTPUT_JSON_SCHEMA,
            temperature: 0,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: controller.signal,
            // Our AbortController is the limit. No SDK retries (its default is 5), and
            // no httpOptions.timeout: the SDK sends it as a server deadline, which the
            // API rejects below 10 s (400 INVALID_ARGUMENT, seen on the live deploy).
            httpOptions: { retryOptions: { attempts: 1 } },
          },
        });
        return { ok: true, text: response.text ?? "", model };
      } catch (error) {
        if (controller.signal.aborted) return { ok: false, reason: "TIMEOUT", model };
        // Status only: no message text, prompt or key is logged.
        console.warn("capture provider failure", { model, status: error instanceof ApiError ? error.status : null });
        if (error instanceof ApiError && (error.status === 429 || error.status === 503)) return { ok: false, reason: "UPSTREAM_BUSY", model };
        return { ok: false, reason: "API_ERROR", model };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

const noKeyProvider = (model: string): CaptureProvider => ({ name: model, extract: async () => ({ ok: false, reason: "NO_KEY", model }) });

/** Choose the provider from the environment. "fake" is refused on Vercel (D100). */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): CaptureProvider {
  const kind = env.AI_CAPTURE_PROVIDER ?? "gemini";
  if (kind === "fake") {
    if (env.VERCEL === "1") throw new Error("AI_CAPTURE_PROVIDER=fake is not allowed on Vercel");
    return fakeProvider;
  }
  if (kind !== "gemini") throw new Error(`Unknown AI_CAPTURE_PROVIDER: ${kind}`);
  const model = env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  if (!env.GEMINI_API_KEY) return noKeyProvider(model);
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return geminiProvider(model, (args) => client.models.generateContent(args));
}
