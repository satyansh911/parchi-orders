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
  "cart.youSave", "cart.worth", "cart.freeChip", "cart.discountChip", "cart.beforeDiscount",
  "cart.credit.title", "cart.credit.limit", "cart.credit.outstanding", "cart.credit.openOrders", "cart.credit.available", "cart.credit.overBy",
  "cart.tooLarge", "cart.fixLines", "catalogue.perCase", "catalogue.gstExtra",
  "cart.place", "cart.placing", "cart.confirmHold.title", "cart.confirmHold.body", "cart.confirmHold.yes", "cart.confirmHold.no",
  "cart.unconfirmed", "cart.problem.QUOTE_CHANGED", "cart.problem.STOCK_CHANGED", "cart.problem.CREDIT_CONFIRMATION_REQUIRED", "cart.problem.REJECTED",
  "cart.placed.title", "cart.placed.already", "cart.placed.number", "cart.placed.PENDING_REVIEW", "cart.placed.CREDIT_HOLD", "cart.placed.view", "cart.placed.continue",
] as const;
export type CartStrings = Record<(typeof CART_STRING_KEYS)[number], string>;
