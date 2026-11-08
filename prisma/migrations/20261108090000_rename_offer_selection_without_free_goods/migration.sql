-- D42 widened the "free goods don't fit" alternative from "take the discount"
-- to "the requested quantity without free goods" (a discount if one applies,
-- otherwise none). Rename in place: no rows are rewritten and nothing is lost.
ALTER TYPE "OfferSelection" RENAME VALUE 'DISCOUNT_FREE_GOODS_SHORT' TO 'WITHOUT_FREE_GOODS_STOCK_SHORT';
