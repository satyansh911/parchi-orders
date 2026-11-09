// Plain module (see app/login/strings.ts for why this isn't in the client file).
export const CATALOGUE_STRING_KEYS = [
  "catalogue.searchLabel", "catalogue.searchPlaceholder", "catalogue.categories", "catalogue.allCategories",
  "catalogue.perCase", "catalogue.gstExtra", "catalogue.perPiece", "catalogue.piecesPerCase", "catalogue.mrp",
  "catalogue.inStock", "catalogue.lowStock", "catalogue.outOfStock",
  "catalogue.noMatch", "catalogue.clearSearch", "catalogue.empty", "catalogue.resultCount",
  "catalogue.discountOn", "catalogue.free", "catalogue.freeEarned", "catalogue.nextFree",
] as const;

export type CatalogueStrings = Record<(typeof CATALOGUE_STRING_KEYS)[number], string>;
