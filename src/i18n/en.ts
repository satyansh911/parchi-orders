// English UI strings. hi.ts must provide exactly the same keys (enforced by
// its type and by dictionaries.test.ts). "{name}" placeholders are filled by t().

export const en = {
  "app.name": "Parchi Orders",
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "common.error": "Something went wrong.",
  "common.close": "Close",

  "nav.catalogue": "Catalogue",
  "nav.orders": "Orders",
  "nav.cart": "Cart",
  "nav.main": "Main",

  "locale.switchTo": "हिंदी",
  "locale.switchLabel": "Switch language to Hindi",

  "login.title": "Log in",
  "login.phoneLabel": "Mobile number",
  "login.getCode": "Get code",
  "login.sending": "Sending…",
  "login.codeSentTo": "Code sent to {phone}",
  "login.codeLabel": "6-digit code",
  "login.logIn": "Log in",
  "login.checking": "Checking…",
  "login.changeNumber": "Change number",
  "login.demoBanner": "Demo mode: no SMS is sent. Use code {code}.",
  "login.error.LOGIN_DISABLED": "SMS login is not configured.",
  "login.error.INVALID_PHONE": "Enter a 10-digit mobile number.",
  "login.error.INVALID_CREDENTIALS": "Wrong number or code. Please try again.",
  "login.error.INVALID_INPUT": "Something was wrong with the form. Please try again.",
  "login.error.RATE_LIMITED": "Too many attempts. Please wait 15 minutes and try again.",
  "login.error.UNAUTHENTICATED": "Please log in again.",
  "login.error.NOT_FOUND": "Something went wrong. Please try again.",
  "login.error.RETAILER_REQUIRED": "Something went wrong. Please try again.",

  "shell.logout": "Log out",
  "shell.loggingOut": "Logging out…",

  "catalogue.title": "Catalogue",
  "catalogue.searchLabel": "Search products",
  "catalogue.searchPlaceholder": "Search: biscuit, chai patti…",
  "catalogue.categories": "Categories",
  "catalogue.allCategories": "All",
  "catalogue.perCase": "/ case",
  "catalogue.gstExtra": "+ GST",
  "catalogue.perPiece": "{price} / pc",
  "catalogue.piecesPerCase": "{n} pcs per case",
  "catalogue.mrp": "MRP {price}",
  "catalogue.inStock": "In stock",
  "catalogue.lowStock": "Only {n} cases left",
  "catalogue.outOfStock": "Out of stock",
  "catalogue.noMatch": "No products match “{query}”.",
  "catalogue.clearSearch": "Clear search",
  "catalogue.empty": "No products are available right now.",
  "catalogue.resultCount": "{n} products",
  "catalogue.loadError": "Couldn't load the catalogue.",
} as const;

export type MessageKey = keyof typeof en;
