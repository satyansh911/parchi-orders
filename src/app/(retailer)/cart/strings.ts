// Plain module: server components import these keys (see app/login/strings.ts).
export const STEPPER_STRING_KEYS = ["cart.add", "cart.increase", "cart.decrease", "cart.quantity"] as const;
export type StepperStrings = Record<(typeof STEPPER_STRING_KEYS)[number], string>;

export const CART_STRING_KEYS = [
  ...STEPPER_STRING_KEYS,
  "cart.empty", "cart.browse", "cart.loading", "cart.updating", "cart.previewError", "cart.retry",
  "cart.cases", "cart.freeCases", "cart.bestOffer", "cart.otherOffer", "cart.nudgeFree", "cart.nudgeDiscount",
  "cart.remove", "cart.outOfStock", "cart.inactive", "cart.unknown", "cart.shortMore", "cart.shortFree",
  "cart.optionWithFree", "cart.optionWithout", "cart.optionWithoutDiscount", "cart.optionMax",
  "cart.offerChanged", "cart.useBestOffer", "cart.taxable", "cart.discount", "cart.gstAt", "cart.payable", "cart.priceNote",
  "cart.credit.title", "cart.credit.limit", "cart.credit.outstanding", "cart.credit.openOrders", "cart.credit.available", "cart.credit.overBy",
  "cart.tooLarge", "cart.fixLines", "catalogue.perCase", "catalogue.gstExtra",
] as const;
export type CartStrings = Record<(typeof CART_STRING_KEYS)[number], string>;
