// Deterministic stand-in for the model, for automated tests only (D100).
// Never selectable on Vercel (see providerFromEnv). Answers are written with
// SKU codes and translated to this request's short IDs, like a real model.
//
// Special messages for failure tests: "#timeout", "#busy", "#error", "#garbage", "#empty".

import type { CaptureProvider, ProviderResult } from "./provider";

type FakeLine = { raw: string; code: string | null; qty: number | null; unit: "CASE" | "PIECE" | "UNKNOWN"; score: number; alternatives: string[] };

const SCRIPTS: Array<{ match: RegExp; lines: FakeLine[]; unmatched?: string[] }> = [
  {
    match: /5 peti biscuit chhota/i,
    lines: [
      { raw: "5 peti biscuit chhota", code: "SKU-BS-075", qty: 5, unit: "CASE", score: 88, alternatives: ["SKU-BS-150", "SKU-CR-100"] },
      { raw: "2 peti washing powder 1 kilo", code: "SKU-DT-1KG", qty: 2, unit: "CASE", score: 92, alternatives: ["SKU-DT-500", "SKU-DT-2KG"] },
      { raw: "chai patti 250 wala 1 peti", code: "SKU-TE-250", qty: 1, unit: "CASE", score: 90, alternatives: ["SKU-TD-250", "SKU-TE-500"] },
    ],
  },
  {
    match: /2 peti washing powder$/i,
    lines: [{ raw: "2 peti washing powder", code: "SKU-DT-1KG", qty: 2, unit: "CASE", score: 95, alternatives: ["SKU-DT-500", "SKU-DT-2KG"] }],
  },
  {
    match: /3 peti haldi/i,
    lines: [{ raw: "3 peti haldi 100", code: "SKU-HL-100", qty: 3, unit: "CASE", score: 80, alternatives: ["SKU-HL-200", "SKU-CP-100"] }],
    unmatched: ["2 peti xyz cola"],
  },
];

/** D111 tests: a fake "reads" a photo or voice note into these transcripts. Bytes containing "#timeout" etc. fail. */
export const FAKE_PHOTO_TRANSCRIPT = "5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti";
export const FAKE_VOICE_TRANSCRIPT = "2 peti washing powder";

export const fakeProvider: CaptureProvider = {
  name: "fake",
  async extract(prompt, context) {
    const media = prompt.media;
    const decoded = media ? Buffer.from(media.data, "base64").toString("latin1") : "";
    const transcript = media ? (media.kind === "PHOTO" ? FAKE_PHOTO_TRANSCRIPT : FAKE_VOICE_TRANSCRIPT) : null;
    const trigger = (decoded.match(/#(timeout|busy|error|garbage|empty)\b/) ?? [""])[0]; // real image bytes may contain "#"
    const message = media ? `${transcript} ${trigger}`.trim() : context.message;
    const result = await extractText(message, context.shortIdByCode);
    if (!transcript || !result.ok || trigger) return result;
    return { ok: true, model: result.model, text: JSON.stringify({ transcript, ...JSON.parse(result.text) }) };
  },
};

async function extractText(message: string, shortIdByCode: ReadonlyMap<string, string>): Promise<ProviderResult> {
  {
    const model = "fake";
    if (message.includes("#timeout")) return { ok: false, reason: "TIMEOUT", model };
    if (message.includes("#busy")) return { ok: false, reason: "UPSTREAM_BUSY", model };
    if (message.includes("#error")) return { ok: false, reason: "API_ERROR", model };
    if (message.includes("#garbage")) return { ok: true, text: "{not json", model };
    if (message.includes("#empty")) return { ok: true, text: "", model };
    const script = SCRIPTS.find((s) => s.match.test(message.trim()));
    const toShort = (code: string | null) => (code ? (shortIdByCode.get(code) ?? "S999") : null);
    const output = script
      ? {
          lines: script.lines.map((l) => ({ raw: l.raw, sku: toShort(l.code), qty: l.qty, unit: l.unit, score: l.score, alternatives: l.alternatives.map((a) => toShort(a)!) })),
          unmatched: script.unmatched ?? [],
        }
      : { lines: [], unmatched: [message.trim().slice(0, 100)] };
    return { ok: true, text: JSON.stringify(output), model };
  }
}
