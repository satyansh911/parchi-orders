// Plain module: server components import these keys (see app/login/strings.ts).
export const CAPTURE_FORM_KEYS = [
  "capture.hint", "capture.placeholder", "capture.label", "capture.submit", "capture.reading", "capture.chars", "capture.rateLimited", "capture.error",
  "capture.mode.text", "capture.mode.photo", "capture.mode.voice", "capture.mode.label", "capture.photo.hint", "capture.photo.take", "capture.photo.change",
  "capture.voice.hint", "capture.voice.record", "capture.voice.stop", "capture.voice.upload", "capture.voice.again", "capture.voice.noMic",
  "capture.media.bad", "capture.media.large", "capture.media.readingPhoto", "capture.media.readingVoice",
] as const;
export type CaptureFormStrings = Record<(typeof CAPTURE_FORM_KEYS)[number], string>;

export const CAPTURE_REVIEW_KEYS = [
  "capture.review.original", "capture.review.photo", "capture.review.voice", "capture.conf.HIGH", "capture.conf.MEDIUM", "capture.conf.LOW", "capture.conf.NEEDS_CLARIFICATION",
  "capture.flag.PIECES", "capture.flag.UNIT_UNCLEAR", "capture.flag.QTY_UNCLEAR", "capture.flag.PACK_SIZE_UNCLEAR", "capture.flag.PRODUCT_UNCLEAR",
  "capture.flag.OUT_OF_STOCK", "capture.flag.DUPLICATE", "capture.flag.UNMATCHED", "capture.choose", "capture.pick", "capture.ok", "capture.remove",
  "capture.removed", "capture.undo", "capture.addItem", "capture.addToCart", "capture.fixFirst", "capture.added", "capture.goCart",
  "capture.failed.title", "capture.failed.body", "capture.retry", "capture.manual", "capture.newMessage", "capture.adding", "capture.error", "capture.rateLimited",
  "cart.add", "cart.increase", "cart.decrease", "cart.quantity", "order.again.cartNotEmpty", "order.again.replace", "order.again.add", "order.again.locked",
] as const;
export type CaptureReviewStrings = Record<(typeof CAPTURE_REVIEW_KEYS)[number], string>;
