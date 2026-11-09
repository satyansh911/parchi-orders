"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { interpretMediaAction, interpretMessageAction } from "@/app/actions/capture";
import { fill } from "@/i18n/fill";
import { encodeAudio, MAX_UPLOAD_BYTES, MAX_VOICE_SECONDS, recorderMime, shrinkPhoto, type Encoded } from "./media-input";
import type { CaptureFormStrings } from "./strings";

const MAX = 1000;
type Mode = "text" | "photo" | "voice";

/**
 * Order slip (D94, D111): type a message, photograph a handwritten list, or
 * record / upload a voice note. One request ID per message or file: a retry
 * after a lost response reuses it (the server returns the same capture, D96).
 */
export function CaptureForm({ s }: { s: CaptureFormStrings }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const resetRequest = () => {
    requestId.current = null;
    setError(null);
  };

  function send(call: (clientRequestId: string) => ReturnType<typeof interpretMessageAction> | ReturnType<typeof interpretMediaAction>) {
    requestId.current ??= crypto.randomUUID();
    const clientRequestId = requestId.current;
    startTransition(async () => {
      try {
        const result = await call(clientRequestId);
        if (!result.ok) return setError(s["capture.error"]);
        const data = result.data;
        if (data.outcome === "RATE_LIMITED") return setError(s["capture.rateLimited"]);
        if (data.outcome === "BAD_MEDIA") {
          requestId.current = null;
          return setError(data.problem === "TOO_LARGE" ? s["capture.media.large"] : s["capture.media.bad"]);
        }
        if (data.outcome === "REJECTED") {
          requestId.current = null;
          return setError(s["capture.error"]);
        }
        requestId.current = null;
        router.push(`/capture/${data.captureId}`);
      } catch {
        setError(s["capture.error"]); // keep the request ID: a retry returns the same capture
      }
    });
  }

  const modes: Array<[Mode, string]> = [["text", s["capture.mode.text"]], ["photo", s["capture.mode.photo"]], ["voice", s["capture.mode.voice"]]];
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={s["capture.mode.label"]} className="grid grid-cols-3 gap-1 rounded-card bg-paper-dim p-1">
        {modes.map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); resetRequest(); }}
            className={`min-h-11 rounded-card text-base font-medium ${mode === m ? "bg-paper text-accent shadow-sm" : "text-ink-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === "text" && <TextInput s={s} pending={pending} onChange={resetRequest} onSend={(message) => send((id) => interpretMessageAction({ clientRequestId: id, message }))} />}
      {mode === "photo" && <PhotoInput s={s} pending={pending} onChange={resetRequest} onError={setError} onSend={(e) => send((id) => interpretMediaAction({ clientRequestId: id, kind: "PHOTO", mimeType: e.mimeType, data: e.data }))} />}
      {mode === "voice" && <VoiceInput s={s} pending={pending} onChange={resetRequest} onError={setError} onSend={(e) => send((id) => interpretMediaAction({ clientRequestId: id, kind: "VOICE", mimeType: e.mimeType, data: e.data }))} />}
      {error && <p role="alert" className="rounded-card bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

type InputProps = { s: CaptureFormStrings; pending: boolean; onChange: () => void };
const SUBMIT = "min-h-14 rounded-card bg-accent px-5 text-lg font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint";

function TextInput({ s, pending, onChange, onSend }: InputProps & { onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (message.trim()) onSend(message); }} className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s["capture.hint"]}</p>
      <label htmlFor="order-message" className="sr-only">{s["capture.label"]}</label>
      <textarea id="order-message" rows={6} maxLength={MAX} value={message} placeholder={s["capture.placeholder"]}
        onChange={(e) => { setMessage(e.target.value); onChange(); }}
        className="rounded-card border border-line p-3 text-lg leading-relaxed" />
      <p className="self-end text-xs text-ink-muted" aria-live="polite">{fill(s["capture.chars"], { n: message.length })}</p>
      <button type="submit" disabled={pending || !message.trim()} className={SUBMIT}>{pending ? s["capture.reading"] : s["capture.submit"]}</button>
    </form>
  );
}

function PhotoInput({ s, pending, onChange, onError, onSend }: InputProps & { onError: (m: string) => void; onSend: (e: Encoded) => void }) {
  const [photo, setPhoto] = useState<(Encoded & { preview: string }) | null>(null);
  async function choose(file: File | undefined) {
    if (!file) return;
    onChange();
    try {
      const encoded = await shrinkPhoto(file);
      if (encoded.bytes > MAX_UPLOAD_BYTES) return onError(s["capture.media.large"]);
      setPhoto({ ...encoded, preview: `data:image/jpeg;base64,${encoded.data}` });
    } catch {
      onError(s["capture.media.bad"]);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s["capture.photo.hint"]}</p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a served image
        <img src={photo.preview} alt="" className="max-h-72 w-full rounded-card border border-line object-contain" />
      )}
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-card border border-accent px-4 font-medium text-accent">
        {photo ? s["capture.photo.change"] : s["capture.photo.take"]}
        <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid="photo-input" onChange={(e) => choose(e.target.files?.[0])} />
      </label>
      <button type="button" disabled={pending || !photo} onClick={() => photo && onSend(photo)} className={SUBMIT}>
        {pending ? s["capture.media.readingPhoto"] : s["capture.submit"]}
      </button>
    </div>
  );
}

function VoiceInput({ s, pending, onChange, onError, onSend }: InputProps & { onError: (m: string) => void; onSend: (e: Encoded) => void }) {
  const [clip, setClip] = useState<(Encoded & { url: string }) | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function acceptBlob(blob: Blob) {
    if (blob.size > MAX_UPLOAD_BYTES) return onError(s["capture.media.large"]);
    const encoded = await encodeAudio(blob);
    setClip((old) => { if (old) URL.revokeObjectURL(old.url); return { ...encoded, url: URL.createObjectURL(blob) }; });
  }

  async function start() {
    onChange();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recorderMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 24_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setSeconds(null);
        void acceptBlob(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((n) => {
        const next = (n ?? 0) + 1;
        if (next >= MAX_VOICE_SECONDS && rec.state === "recording") rec.stop();
        return next;
      }), 1000);
    } catch {
      onError(s["capture.voice.noMic"]);
    }
  }

  const recording = seconds !== null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s["capture.voice.hint"]}</p>
      <button type="button" onClick={() => (recording ? recorder.current?.stop() : start())} aria-pressed={recording}
        className={`min-h-16 rounded-card text-lg font-semibold ${recording ? "bg-danger text-paper" : "border-2 border-accent text-accent"}`}>
        {recording ? fill(s["capture.voice.stop"], { s: seconds }) : clip ? s["capture.voice.again"] : `● ${s["capture.voice.record"]}`}
      </button>
      {clip && <audio controls src={clip.url} className="w-full" />}
      <label className="flex min-h-11 cursor-pointer items-center justify-center text-sm font-medium text-accent underline">
        {s["capture.voice.upload"]}
        <input type="file" accept="audio/*,.ogg,.opus,.m4a,.mp3,.aac,.wav" className="sr-only" data-testid="voice-input"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onChange(); void acceptBlob(f); } }} />
      </label>
      <button type="button" disabled={pending || !clip || recording} onClick={() => clip && onSend(clip)} className={SUBMIT}>
        {pending ? s["capture.media.readingVoice"] : s["capture.submit"]}
      </button>
    </div>
  );
}
