// Plain module (not "use client"): server components import values from here.
// A value exported from a client module is only a client reference on the
// server, so string-key lists must not live in login-form.tsx.
export const LOGIN_STRING_KEYS = [
  "login.phoneLabel", "login.getCode", "login.sending", "login.codeSentTo", "login.codeLabel",
  "login.logIn", "login.checking", "login.changeNumber",
  "login.error.LOGIN_DISABLED", "login.error.INVALID_PHONE", "login.error.INVALID_CREDENTIALS",
  "login.error.INVALID_INPUT", "login.error.RATE_LIMITED", "login.error.UNAUTHENTICATED",
  "login.error.NOT_FOUND", "login.error.RETAILER_REQUIRED",
] as const;

export type LoginStrings = Record<(typeof LOGIN_STRING_KEYS)[number], string>;
