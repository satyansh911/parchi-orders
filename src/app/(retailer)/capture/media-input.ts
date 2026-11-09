// Browser helpers for photo / voice capture (D111). Photos are shrunk on the
// phone (longest side 1600 px, JPEG) so a 4 MB camera photo becomes ~200–400 KB
// on 3G. Nothing is stored on the device.

export const MAX_UPLOAD_BYTES = 2_000_000;
export const MAX_VOICE_SECONDS = 60;
const MAX_SIDE = 1600;

export type Encoded = { mimeType: string; data: string; bytes: number };

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function shrinkPhoto(file: File): Promise<Encoded> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.75));
  return { mimeType: "image/jpeg", data: await blobToBase64(blob), bytes: blob.size };
}

export async function encodeAudio(blob: Blob): Promise<Encoded> {
  return { mimeType: blob.type || "audio/webm", data: await blobToBase64(blob), bytes: blob.size };
}

/** The best recording format this browser supports (Chrome: webm/opus, Safari: mp4/aac). */
export function recorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
}
