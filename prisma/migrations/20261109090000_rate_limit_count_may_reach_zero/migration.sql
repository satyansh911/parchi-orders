-- D56: an OTP attempt reserves a slot atomically before the code is checked,
-- and a successful login gives it back, so a counter can legitimately return
-- to 0. Negative counts are still impossible.
ALTER TABLE "RateLimitHit" DROP CONSTRAINT "RateLimitHit_count_check";
ALTER TABLE "RateLimitHit" ADD CONSTRAINT "RateLimitHit_count_check" CHECK ("count" >= 0);
