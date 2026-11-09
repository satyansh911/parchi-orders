// D111: photo / voice-note uploads. Only a short allow-list of types, a size
// cap, and the bytes must really be that kind of file (magic numbers), so a
// renamed executable or HTML file is refused before it reaches the model.

export type MediaKind = "PHOTO" | "VOICE";
export const MAX_MEDIA_BYTES = 2_000_000; // after client-side shrinking; 60 s of voice is far less

const TYPES: Record<MediaKind, readonly string[]> = {
  PHOTO: ["image/jpeg", "image/png", "image/webp"],
  VOICE: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/x-m4a"],
};

export type CheckedMedia = { kind: MediaKind; mimeType: string; data: string; bytes: number };
export type MediaProblem = "TYPE" | "TOO_LARGE" | "EMPTY" | "MISMATCH";

/** "audio/webm;codecs=opus" → "audio/webm"; m4a is sent to the model as audio/mp4. */
export function normaliseMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base === "audio/x-m4a" ? "audio/mp4" : base;
}

function sniff(bytes: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((b, j) => bytes[i + j] === b);
  const ascii = (i: number, s: string) => [...s].every((c, j) => bytes[i + j] === c.charCodeAt(0));
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "audio/webm";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(4, "ftyp")) return "audio/mp4";
  if (ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return (bytes[1] & 0x06) === 0 ? "audio/aac" : "audio/mpeg";
  return null;
}

export function checkMedia(kind: MediaKind, declaredMime: string, base64: string): { ok: true; media: CheckedMedia } | { ok: false; problem: MediaProblem } {
  const mimeType = normaliseMime(declaredMime);
  if (!TYPES[kind].map(normaliseMime).includes(mimeType)) return { ok: false, problem: "TYPE" };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return { ok: false, problem: "MISMATCH" };
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { ok: false, problem: "EMPTY" };
  if (bytes.length > MAX_MEDIA_BYTES) return { ok: false, problem: "TOO_LARGE" };
  const actual = sniff(bytes.subarray(0, 16));
  const family = (m: string) => (m.startsWith("image/") ? "image" : "audio");
  // Containers vary by phone (aac in mp4, mp3 frames); require the right family and a known signature.
  if (!actual || family(actual) !== family(mimeType)) return { ok: false, problem: "MISMATCH" };
  if (kind === "PHOTO" && actual !== mimeType) return { ok: false, problem: "MISMATCH" };
  return { ok: true, media: { kind, mimeType: kind === "PHOTO" ? mimeType : actual, data: base64, bytes: bytes.length } };
}
