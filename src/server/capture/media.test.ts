import { describe, expect, it } from "vitest";
import { checkMedia, normaliseMime } from "./media";

const b64 = (bytes: number[], pad = 32) => Buffer.from([...bytes, ...Array(pad).fill(0)]).toString("base64");
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];
const WEBM = [0x1a, 0x45, 0xdf, 0xa3];
const OGG = [...Buffer.from("OggS")];
const M4A = [0, 0, 0, 0x20, ...Buffer.from("ftypM4A ")];

describe("checkMedia (D111)", () => {
  it("accepts real photos and voice notes", () => {
    expect(checkMedia("PHOTO", "image/jpeg", b64(JPEG))).toMatchObject({ ok: true, media: { mimeType: "image/jpeg" } });
    expect(checkMedia("PHOTO", "image/png", b64(PNG))).toMatchObject({ ok: true });
    expect(checkMedia("VOICE", "audio/webm;codecs=opus", b64(WEBM))).toMatchObject({ ok: true, media: { mimeType: "audio/webm" } });
    expect(checkMedia("VOICE", "audio/ogg", b64(OGG))).toMatchObject({ ok: true, media: { mimeType: "audio/ogg" } });
    expect(checkMedia("VOICE", "audio/x-m4a", b64(M4A))).toMatchObject({ ok: true, media: { mimeType: "audio/mp4" } });
  });

  it("refuses other types, renamed files and wrong kinds", () => {
    expect(checkMedia("PHOTO", "image/svg+xml", b64(JPEG))).toEqual({ ok: false, problem: "TYPE" });
    expect(checkMedia("PHOTO", "image/jpeg", Buffer.from("<html><script>").toString("base64"))).toEqual({ ok: false, problem: "MISMATCH" });
    expect(checkMedia("PHOTO", "image/png", b64(JPEG))).toEqual({ ok: false, problem: "MISMATCH" });
    expect(checkMedia("VOICE", "audio/webm", b64(JPEG))).toEqual({ ok: false, problem: "MISMATCH" });
    expect(checkMedia("VOICE", "video/mp4", b64(M4A))).toEqual({ ok: false, problem: "TYPE" });
  });

  it("refuses empty, oversized and non-base64 data", () => {
    expect(checkMedia("PHOTO", "image/jpeg", "")).toEqual({ ok: false, problem: "EMPTY" });
    expect(checkMedia("PHOTO", "image/jpeg", b64(JPEG, 2_000_001))).toEqual({ ok: false, problem: "TOO_LARGE" });
    expect(checkMedia("PHOTO", "image/jpeg", "not base64!")).toEqual({ ok: false, problem: "MISMATCH" });
  });

  it("normalises codec parameters", () => {
    expect(normaliseMime("Audio/WebM; codecs=opus")).toBe("audio/webm");
  });
});
