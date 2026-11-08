// One-time codes behind an interface (D54). The only implementation today is
// the demo provider, which sends nothing and accepts only 123456. It exists
// only when AUTH_DEMO_OTP is exactly "true" (D55, D71); otherwise there is no
// provider and login is refused. Real SMS later = one new OtpProvider.

import { timingSafeEqual } from "node:crypto";

export interface OtpProvider {
  /** Shown on the login screen in demo mode; null for a real SMS provider. */
  readonly demoCode: string | null;
  sendCode(phone: string): Promise<void>;
  checkCode(phone: string, code: string): Promise<boolean>;
}

export const DEMO_OTP_CODE = "123456";

export const demoOtpProvider: OtpProvider = {
  demoCode: DEMO_OTP_CODE,
  async sendCode() {
    // Demo: no SMS is sent. The code is shown on screen instead.
  },
  async checkCode(_phone, code) {
    const given = Buffer.from(code, "utf8");
    const expected = Buffer.from(DEMO_OTP_CODE, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  },
};

/** The configured provider, or null when SMS login is not configured (the default). */
export function otpProviderFromEnv(env: Record<string, string | undefined> = process.env): OtpProvider | null {
  return env.AUTH_DEMO_OTP === "true" ? demoOtpProvider : null;
}

export const OTP_CODE_PATTERN = /^\d{6}$/;
