// Plain module: server components import these keys (see app/login/strings.ts).
export const ORDER_AGAIN_STRING_KEYS = [
  "order.again", "order.again.cartNotEmpty", "order.again.replace", "order.again.add", "order.again.unavailable", "order.again.locked", "common.error",
] as const;
export type OrderAgainStrings = Record<(typeof ORDER_AGAIN_STRING_KEYS)[number], string>;
