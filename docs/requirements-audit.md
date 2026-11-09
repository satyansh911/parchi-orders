# Requirements audit (9 Nov 2026)

This audit compares the build against the brief in `CLAUDE.md` and `DECISIONS.md`.

Status values:
- **Complete**: built and verified.
- **Partial**: some of it works, or it is built but not verified live.
- **Deferred**: not built, by decision or as optional depth.

## Core slice

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| Retailer catalogue with own prices, schemes and stock | `catalogue/page.tsx`, `server/catalogue`, domain pricing | E2E `retailer.spec`, live smoke, screenshots | Complete |
| Prices clearly show the GST basis | "+ GST" label next to each price; cart and order show "Total payable (incl. GST)" and GST per rate | E2E, live screenshots | Complete |
| Money stored as integer paise | `src/domain/money`, `Int` columns, CHECK constraints | Unit tests | Complete |
| Cart and order placement | Device cart, server preview, signed quote, transactional placement | Integration `place-order` (17), E2E, live | Complete |
| Scheme engine: free goods per complete multiple, slabs, best offer, nudge | `src/domain/schemes`, `pricing` | Unit tests (brief cases C1–C37) | Complete |
| Stock reservation including free goods, no oversell | Conditional `UPDATE`, sorted locks, CHECK constraints | Integration `reservation`, `place-order` races | Complete |
| Credit limit and holds (D20, D21, D33, D79) | `domain/credit`, placement, desk recheck at approval | Integration `credit`, `desk`, E2E credit-hold test | Complete |
| Repeat order | `repeat-order.ts`, "Order again" | Integration, E2E | Complete |
| OTP login (mock) | DB sessions, demo OTP only when `AUTH_DEMO_OTP=true` | Integration auth, E2E, live | Complete |
| Roles (retailer, desk) with ownership on every action | D67 `action()` wrapper, `ownedBy`, desk-only reads | `security.int.test`, registry test, live retailer→CSV 404 | Complete |
| AI capture from text: original words, confidence, 2 alternatives | Gemini structured output, `postprocess.ts`, review UI | Unit (31), integration (capture), E2E (fake provider) | Complete (code); live model see below |
| Unclear case/piece is asked, never guessed | `unitIn`, NEEDS_CLARIFICATION, "1 case = N packets" | Unit tests | Complete |
| No order until a person confirms | Interpretation writes a capture only; confirm → cart → normal placement | Integration "nothing ordered or reserved" | Complete |
| Desk corrections become retailer aliases, used in future captures | Desk "Save as alias" → `Alias`, used by `aliasKey` in post-processing | Integration alias test, unit `aliasKey` | Complete |
| Retailer past orders used to map SKUs | Past SKUs in the prompt; ±10/15 confidence | Unit tests | Complete |
| Never trust AI output; safe failure | zod validation, active-SKU mapping, typed failures → "Couldn't read this message" | Unit, integration, E2E failure path, live (manual path shown) | Complete |
| Live Gemini extraction | `gemini-3.5-flash` (D107; `gemini-3.8-flash` was overloaded) | Live smoke: the brief's message gives 3/3 correct SKUs and cases; 4.4 s round trip | Complete |
| Real-model eval script (12+ messages) | Not run; D99 allowed one approved run | — | **Deferred** |
| Rate-limit capture | Atomic DB counters: 5/min and 40/day per user, 300/day overall | Integration | Complete |
| Order desk queue, filters, details, history | `/desk`, `/desk/orders/[id]` | E2E `desk.spec`, live | Complete |
| Approve, reject, release hold, cancel approved, stock effects | `server/desk/transitions.ts`, status machine | Integration `desk` (concurrency, effects) | Complete |
| Desk edits with repricing and retailer acknowledgement (D22, D32) | `edit-line.ts`, "Accept changes" | Integration `desk` | Complete (quantity/remove; SKU swap deferred, D101) |
| Cancellation requests visible to the desk | Queue flag and order banner; desk rejects with reason | Manual review | Complete |
| Tally CSV export with batches, no duplicates, reconciliation | `domain/export/tally-csv.ts`, `server/desk/export.ts`, `/api/exports/[id]` | Unit (6), integration (concurrent export, mismatch), E2E, live download | Complete |
| Hindi and English | Retailer screens bilingual (Hindi default); desk English (D106) | E2E Hindi, language persistence test | Complete |
| 360 px, 44 px tap targets, loading/empty/error states | Tailwind tokens, skeletons, empty and error states | E2E at 360 px (no horizontal scroll), screenshots | Complete |
| First load under 3 s on slow 3G | PPR shell, about 150 KB JS | Live emulated slow 3G + 4× CPU: FCP/LCP ~2.2 s, load event ~4.1 s | **Partial** (paint < 3 s; full load > 3 s; no real-device test) |
| Installable web app | `manifest.ts`, icons | Live manifest served | Complete (no service worker) |
| Privacy: no retailer data in shared caches | `private, no-store` on signed-in pages, no private data in the PPR shell | Live header check | Complete |
| No secrets in repo; `.env.example` with names only | `.gitignore`, Vercel env | `git check-ignore` | Complete |
| Tests never use the primary database | Guarded test branch with marker | Guard tests | Complete |
| Deploy on Vercel, `sin1`, Singapore database, verify-full | `vercel.json`, env | `x-vercel-id: bom1::sin1`, live smoke | Complete |

## MUST HAVE beyond the core

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| Installable web app with OTP login, catalogue, prices, schemes, stock, repeat order, credit limit | Manifest and icons; all retailer features above | Live | Complete |
| Salesman mode during visits, working offline | SALESMAN role, assigned shops (D109); offline pack, on-phone pricing with the domain engine, outbox, sync with an exact-match check (D108); salesman-only service worker (D113) | Unit (state, pricing), integration (parity, changed price, access, idempotency), E2E with the network off, live with the network off | Complete |
| AI order capture from a photo of a list | One transcribe-and-extract call; checked file type and bytes; transcript goes through the same pipeline (D111) | Unit (media checks, provider), integration, E2E (photo), live: 4/4 items correct | Complete |
| AI order capture from a Hindi voice note | Record in the browser or upload a file; same pipeline | Integration, live: synthesized Hindi voice, 2/2 correct | Complete (not tested with real shop voices) |
| Order desk van loading lists | `domain/loading`, `/desk/loading`, printable | Unit, integration, E2E, live | Complete |
| Dashboard of retailers with no order in 14 days | `domain/retailers/inactivity`, `/desk/inactive`, filter in the salesman app | Unit, integration (scoping), E2E, live | Complete |
| AI capture inside the salesman app; desk-side capture | — | — | Deferred |
| REVIEW_REQUIRED from partial captures (D27); retailer editing a pending order (D23) | — | — | Deferred |

## Submission

| Item | Status |
|---|---|
| TDD (PDF) with GitHub and live URLs at the top | Complete |
| `deployment.md` | Complete |
| ZIP containing exactly the two deliverables, under 25 MB | Complete |
