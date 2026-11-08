// Plain module: server components import these keys (see app/login/strings.ts).
export const ORDER_AGAIN_STRING_KEYS = [
  "order.again", "order.again.cartNotEmpty", "order.again.replace", "order.again.add", "order.again.unavailable", "order.again.locked", "common.error",
] as const;
export type OrderAgainStrings = Record<(typeof ORDER_AGAIN_STRING_KEYS)[number], string>;

export const ORDER_ACTION_STRING_KEYS = [
  "order.cancel", "order.cancel.confirm", "order.cancel.yes", "order.cancel.no", "order.requestCancel",
  "order.noteLabel", "order.noteRequiredLabel", "order.sendNote", "order.send", "order.noteSent", "order.notAllowed", "common.error",
] as const;
export type OrderActionStrings = Record<(typeof ORDER_ACTION_STRING_KEYS)[number], string>;
