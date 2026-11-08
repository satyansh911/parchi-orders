// OTP brute-force limits (D56). Per 15-minute window:
//   - at most 5 code requests per phone;
//   - at most 5 failed code checks per phone and 20 per IP.
// A check RESERVES a slot first (atomic increment) and gives it back only on
// success. So even simultaneous guesses can't exceed the limit, and while a
// phone or IP is locked, even the correct code is refused.

import type { PrismaClient } from "@/generated/prisma/client";
import { decrementCounter, incrementCounter } from "../rate-limit";

export const OTP_WINDOW_MS = 15 * 60 * 1000;
export const MAX_CODE_REQUESTS_PER_PHONE = 5;
export const MAX_FAILED_CHECKS_PER_PHONE = 5;
export const MAX_FAILED_CHECKS_PER_IP = 20;

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

const keys = {
  request: (phone: string) => `otp:request:phone:${phone}`,
  failPhone: (phone: string) => `otp:fail:phone:${phone}`,
  failIp: (ip: string) => `otp:fail:ip:${ip}`,
};

/** Counts a code request; false if over the limit. */
export async function allowCodeRequest(db: Db, phone: string, now: Date): Promise<boolean> {
  return (await incrementCounter(db, keys.request(phone), OTP_WINDOW_MS, now)) <= MAX_CODE_REQUESTS_PER_PHONE;
}

export type CheckReservation = { allowed: boolean; succeeded: () => Promise<void> };

/**
 * Reserve a code check for this phone (if known to be well-formed) and IP.
 * Call `succeeded()` after a successful login to give the reservation back.
 */
export async function reserveCodeCheck(db: Db, phone: string | null, ip: string, now: Date): Promise<CheckReservation> {
  const ipCount = await incrementCounter(db, keys.failIp(ip), OTP_WINDOW_MS, now);
  const phoneCount = phone ? await incrementCounter(db, keys.failPhone(phone), OTP_WINDOW_MS, now) : 0;
  return {
    allowed: ipCount <= MAX_FAILED_CHECKS_PER_IP && phoneCount <= MAX_FAILED_CHECKS_PER_PHONE,
    succeeded: async () => {
      await decrementCounter(db, keys.failIp(ip), OTP_WINDOW_MS, now);
      if (phone) await decrementCounter(db, keys.failPhone(phone), OTP_WINDOW_MS, now);
    },
  };
}
