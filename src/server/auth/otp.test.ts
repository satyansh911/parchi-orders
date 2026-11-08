import { describe, expect, it } from "vitest";
import { DEMO_OTP_CODE, demoOtpProvider, otpProviderFromEnv } from "./otp";

describe("otpProviderFromEnv (D55: disabled by default)", () => {
  it("is disabled when AUTH_DEMO_OTP is unset", () => {
    expect(otpProviderFromEnv({})).toBeNull();
  });

  it.each(["false", "TRUE", "1", "yes", " true", "true ", ""])("is disabled for AUTH_DEMO_OTP=%j", (value) => {
    expect(otpProviderFromEnv({ AUTH_DEMO_OTP: value })).toBeNull();
  });

  it("is the demo provider only for exactly 'true'", () => {
    expect(otpProviderFromEnv({ AUTH_DEMO_OTP: "true" })).toBe(demoOtpProvider);
  });
});

describe("demoOtpProvider", () => {
  it("accepts only 123456 and shows it as the demo code", async () => {
    expect(demoOtpProvider.demoCode).toBe(DEMO_OTP_CODE);
    expect(await demoOtpProvider.checkCode("9999900101", "123456")).toBe(true);
    for (const bad of ["123457", "000000", "12345", "1234567", "", "12345 ", "１２３４５６"]) {
      expect(await demoOtpProvider.checkCode("9999900101", bad)).toBe(false);
    }
  });
});
