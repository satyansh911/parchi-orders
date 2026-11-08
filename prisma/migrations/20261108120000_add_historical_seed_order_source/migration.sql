-- D53, D66: seeded demo history gets its own order source, so it is always
-- identifiable and never confused with orders created through the app.
-- Additive only: existing values and rows are unchanged.
ALTER TYPE "OrderSource" ADD VALUE 'HISTORICAL_SEED';
