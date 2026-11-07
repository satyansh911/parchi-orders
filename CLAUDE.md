# CLAUDE.md — Distributor ordering app (take-home)

## Context
- This is my take-home for a Software Engineering Intern role. Deadline: 9 Nov 2026, 11:59 pm IST.
- Scoring: Quality of work 50%, Problem solving 30%, Communication 20%.
- Reviewers read the commit history and my Technical Design Document (TDD). I will be interviewed on every decision, number and trade-off, so **the judgement must be mine**. Your job is to build fast and well, and to make sure I understand and own every choice.
- Build only the CORE slice from the brief (below), really well. The rest of MUST HAVE is optional depth that I will decide on.

## How you must work with me
1. **Decisions belong to me.** Before implementing anything that involves a business rule, product behaviour, data-model trade-off, security choice or notable UX choice, STOP and ask me. Give 2–3 options, the trade-off of each, and which one you lean towards and why. Then wait for my answer. Never decide silently and never invent a business rule.
2. **Check `DECISIONS.md` first.** If a question is already answered there, follow it without asking. Record every new answer I give in `DECISIONS.md` (decision, my choice, my reason, date).
3. **Label assumptions.** Anything not stated in the brief goes in `DECISIONS.md` under "Assumptions". Ask me to confirm it before relying on it.
4. **Work phase by phase** (see Phases). At the end of each phase:
   - run typecheck, lint and tests, and fix failures;
   - give me a summary of at most 5 bullets: what was built, and what I need to understand to explain it in the interview;
   - commit in small logical commits with clear messages (e.g. `feat(schemes): apply slab discount`, `test(schemes): free goods at multiples`). Commit after each working piece, not once per phase.
   - Never squash, rewrite or force-push history.
5. **Stay in scope.** Don't add features I didn't ask for. If you think an optional feature is worth it, propose it in one line and ask.
6. **Security basics, always:**
   - No secrets in the repo. Keep `.env.example` with variable names only, and `.env*` in `.gitignore`.
   - Validate every input on the server with zod.
   - Enforce role and ownership on every server action and route handler. A retailer can only ever read their own prices, credit and orders; the desk can read all.
   - Seed data uses fake names and phone numbers only.
7. **Readable code:**
   - Business logic (schemes, pricing, credit, capture post-processing) lives in pure functions under `src/domain/`, with unit tests, and never inside UI components.
   - Keep files small and names clear. TypeScript strict mode.
8. When something in the brief is ambiguous or contradictory, point it out and ask. Don't smooth it over.

## Stack (decided, see DECISIONS.md #12)
- Next.js (App Router) + TypeScript, strict
- Tailwind CSS with our own design tokens (no default-looking UI kit styling)
- PostgreSQL on Neon via Prisma
- zod for validation, Vitest for tests
- Gemini through Google's official Gen AI JS SDK; model name from env `GEMINI_MODEL`; key from `GEMINI_API_KEY`
- Deploy on Vercel
- Mock OTP login (demo code shown in demo mode); no real SMS

## Non-negotiable rules from the brief
- **AI order capture:**
  - Each captured line shows the retailer's original words, a confidence level and two alternative SKUs.
  - Unclear units (case or piece) are ASKED in the UI, never guessed.
  - No order is placed until a person confirms it.
  - Desk corrections are saved as aliases for that retailer and used in future captures.
  - Use the retailer's past orders to map items to SKUs.
- **Never trust AI output.**
  - Validate in code: the SKU exists, quantity is a positive integer, the unit is allowed, and stock status is attached.
  - If the AI call fails, times out, returns invalid JSON or has no key, show a clear "Couldn't read this message, add items manually" path. Never crash.
- **Prices:** always show clearly whether GST is included. Store money as integer paise.
- **Privacy:** a retailer's prices and credit are visible only to that retailer, their salesman and the desk.
- **Performance:** low-end phones on slow 3G, with a first-load target under 3 s.
  - Keep JS light on the catalogue and use optimised images.
  - Large tap targets (at least 44 px).
- **Languages:** Hindi and English UI strings.
- **Design:** minimal, clean layouts, white space, a restrained palette, clear type, and nothing on screen without a purpose.
  - Every screen has loading, empty and error states.
  - Everything works at 360 px width.
  - Shopkeepers order between customers, so the catalogue must be fast and uncluttered, with large images, clear prices and a quick cart.

## AI capture spec
- **Input:** raw message text plus `retailerId`.
- **Prompt context:**
  - the catalogue (id, name, pack size, case size)
  - this retailer's past-ordered SKUs
  - this retailer's aliases
  - the glossary from DECISIONS.md
- **Output:** structured JSON via a response schema:
  `{ lines: [{ raw, skuId|null, qty|null, unit: "case"|"piece"|null, confidence: "high"|"medium"|"low", alternatives: [skuId, skuId], note }], unmatched: [raw] }`
- **Post-processing:** a pure function in `src/domain/capture/` validates the output, applies the confidence rules from DECISIONS.md and attaches stock and scheme info. Unit-test it with mocked AI responses. Tests must never call the real API.
- **Evaluation:** `scripts/eval-capture.ts` runs `fixtures/messages.json` (at least 12 messy Hinglish/Hindi/English messages including the brief's sample, each with expected lines) against the real model and prints accuracy. I'll put the result in the TDD.
- **Rate-limit** the capture endpoint.

## Phases (do one at a time, then stop for my review)
0. **Plan. No code.**
   - Propose the Prisma schema, folder structure and the 6–8 screens.
   - List every open decision not answered in DECISIONS.md as questions for me, with options.
   - Wait for my answers.
1. **Scaffold.**
   - Set up Next.js, TS, Tailwind, Prisma, Vitest and ESLint, plus `.env.example`.
   - Seed script with:
     - the 3 SKUs from the brief, exactly as given;
     - ~35 more realistic kirana SKUs across 4 fictional brands (food and home care);
     - ~20 retailers with fake names, credit limits, outstanding balances, and 3–6 past orders each;
     - a desk user and demo logins.
   - Confirm it builds for deployment.
2. **Scheme engine.** Ask any scheme questions first if they aren't in DECISIONS.md. Write the tests first (list the cases to me), then implement the pure functions until they pass.
3. **Auth and roles.**
   - Mock OTP (phone number plus demo code) and session.
   - Role and ownership guards on every server action and route.
   - Tests proving a retailer cannot read another retailer's data.
4. **Retailer side.**
   - Catalogue: search, category, price display per my decision, GST label, stock badge, scheme badge.
   - Cart with live scheme preview from the same domain functions, and an "add N more to get 1 free" nudge.
   - Credit indicator, place order, my orders.
5. **AI capture.**
   - Paste-message screen (for whichever role DECISIONS.md says).
   - Review screen: original words, confidence, two alternatives, unit question. Confirm turns it into an order.
   - Alias saving and the eval script.
6. **Order desk.**
   - Queue with status filters and credit hold logic.
   - Edit lines, approve.
   - Tally export per DECISIONS.md, marking orders as exported so they can't be exported twice.
7. **Polish and hardening.**
   - Loading, empty and error states everywhere; check at 360 px.
   - Hindi strings, accessibility basics.
   - Review input validation; rate limit on AI.
   - Run a mobile Lighthouse check and report the numbers.
8. **Docs.**
   - `deployment.md`: local setup step by step, how it's deployed, env var names only (never values), demo logins for the reviewer.
   - `docs/TDD.md` draft built from DECISIONS.md, in this order:
     1. GitHub URL and live URL at the top
     2. architecture and why
     3. data model
     4. main flows
     5. how the AI part works and fails safely, with eval results
     6. UI decisions per key screen
     7. labelled assumptions
     8. what I cut and what I'd do next
   - Mark the places where I must write in my own words. I'll convert it to PDF/Word at the end.

## Git and commit plan (reviewers read the history)
Rules:
- Commit after each item below, once it builds and its tests pass. Aim for about 30 commits in total.
- One logical change per commit. Put tests in the same commit as the code they test.
- Use Conventional Commit messages that say what changed and why: `feat(scope): ...`, `fix`, `test`, `refactor`, `docs`, `chore`.
- Never use vague messages like "wip", "update" or "fix stuff".
- The list is a guide, not a script. If something breaks, make a real `fix:` commit. Never pad with empty or trivial commits, never backdate, never squash or rewrite history.
- Never commit `.env`, secrets or real personal data.
- **Authorship:** commits are authored by me only, using my own git `user.name` and `user.email`.
  - Never add `Co-Authored-By`, `Claude-Session`, "Generated with Claude Code" or any other AI trailer or footer to commit messages or PR descriptions.
  - Never change the git author or committer.
- Push to GitHub after every phase. Vercel deploys from `main`.
- After each commit, print the one-line message so I can see progress.

Planned commits:
| # | Phase | Commit |
|---|---|---|
| 1 | 0 | `docs: add project brief, CLAUDE.md and DECISIONS.md` |
| 2 | 1 | `chore: scaffold Next.js app with TypeScript, Tailwind and ESLint` |
| 3 | 1 | `chore: add Prisma with Neon Postgres, Vitest and .env.example` |
| 4 | 1 | `feat(db): schema for catalogue, tiers, schemes, stock, retailers, orders, aliases and exports` |
| 5 | 1 | `feat(seed): seed catalogue, schemes and stock from the brief's sample data` |
| 6 | 1 | `feat(seed): seed retailers, price tiers, credit and past orders` |
| 7 | 2 | `feat(pricing): paise money helpers and tier-based case price` |
| 8 | 2 | `feat(schemes): buy-X-get-Y free goods per complete multiple` |
| 9 | 2 | `feat(schemes): slab discount and best-offer selection` |
| 10 | 2 | `feat(pricing): GST and line/order totals with rounding policy` |
| 11 | 2 | `feat(stock): max orderable quantity including free goods` |
| 12 | 3 | `feat(auth): mock OTP login with HTTP-only session` |
| 13 | 3 | `feat(auth): role and ownership guards on server actions` |
| 14 | 4 | `feat(ui): design tokens, app shell and Hindi/English strings` |
| 15 | 4 | `feat(catalogue): retailer catalogue with prices, GST label, stock and offers` |
| 16 | 4 | `feat(cart): cart with live scheme preview and free-goods nudge` |
| 17 | 4 | `feat(orders): place order with stock reservation and credit hold` |
| 18 | 4 | `feat(orders): order history and repeat order` |
| 19 | 5 | `feat(ai): Gemini client with structured output, timeout and fallback` |
| 20 | 5 | `feat(capture): validate AI output and adjust confidence with retailer history` |
| 21 | 5 | `feat(capture): message capture and review screens` |
| 22 | 5 | `feat(capture): save desk corrections as retailer aliases` |
| 23 | 5 | `test(capture): evaluation script with messy Hinglish fixtures` |
| 24 | 6 | `feat(desk): order queue with status filters` |
| 25 | 6 | `feat(desk): edit, approve, reject and release holds with audit events` |
| 26 | 6 | `feat(export): CSV Tally export in batches with duplicate protection` |
| 27 | 7 | `feat(ui): loading, empty and error states across screens` |
| 28 | 7 | `fix(ui): mobile layout and accessibility pass at 360px` |
| 29 | 7 | `chore(security): rate-limit capture endpoint and review input validation` |
| 30 | 8 | `docs: add deployment guide with env var names and demo logins` |
| 31 | 8 | `docs: add technical design document draft` |

## Client brief (verbatim)

Client
Company A, Jabalpur. Distributor for 4 packaged food and home care brands, serving 1,800 kirana shops. 70 staff including 18 salesmen, revenue ₹85–100 crore a year.

Today
Salesmen write orders in notebooks, or retailers send WhatsApp texts, photos of handwritten lists and Hindi voice notes. Next morning an office team of 6 types them into Tally. Salesmen don't know stock or schemes at the counter, so lines are cut later.

The problem
Assumptions: 600 orders a day, 300 days, ₹5,000 per order, so ₹90 crore a year. 5% of orders have a wrong item or quantity needing a return or redelivery: 1,80,000 × 5% = 9,000 × ₹350 = ₹31.5 lakh. Order entry staff: 6 × ₹2.6 lakh = ₹15.6 lakh. Stock-outs found after ordering lose 1% of sales at 6% margin: ₹90 lakh × 6% = ₹5.4 lakh. Total ₹52.5 lakh a year.

Users
Retailers (shop owners on phones), salesmen, and the office order desk. The owner-director signs the deal.

The ask
My shopkeepers already order on WhatsApp, each in their own way, and my office retypes it all. I want a simple app where a retailer sees stock, his price and the current scheme, and orders in a minute. Salesmen should use it in the shop, even without signal. Messages and voice notes should become orders my desk only has to check.

Must have
- Installable web app with OTP login, catalogue, retailer prices and schemes, stock status, repeat order and credit limit
- Salesman mode for orders during visits, working offline
- AI order capture from text, a photo of a list, or a Hindi voice note
- Scheme engine for free goods (buy 10 get 1) and slab discounts
- Order desk with credit holds, Tally export and van loading lists
- Dashboard of retailers with no order in 14 days

Core build
Software Engineering candidates must ship this slice end to end, in about 6 to 8 screens: retailer catalogue with prices and schemes, cart and order, AI capture from a text order, and order desk with Tally export. Roles: retailer and order desk. AI: order capture from messages. Hard part: the scheme engine. Mock payments, messages and outside systems, and seed from the sample data. The rest of MUST HAVE is optional depth.

Out of scope
- Delivery tracking
- Payments in the app
- GST e-invoicing (stays in Tally)

AI or automation
AI reads text, photos and voice notes and maps items to SKUs using the retailer's past orders. When it is wrong: each line shows the original words, a confidence level and two alternative SKUs, and unclear units (case or piece) are asked, not guessed. No order is placed until a person confirms it, and desk corrections become aliases for that retailer.

Constraints
Retailers use low-end phones on slow 3G: first load under 3 seconds, large tap targets. Hindi and English. Prices must show clearly whether GST is included. A retailer's prices and credit are visible only to them, their salesman and the desk.

Design
The client values good, minimal design: clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Design counts as much as features. Shopkeepers order between customers: a fast, uncluttered catalogue with large images, clear prices and a quick cart.

Budget and time
₹7 lakh, 6 weeks. Success: 50% of orders placed in the app or captured by AI in 4 months; orders with errors from 5% to under 1%; order entry team from 6 to 3.

Sample data
| SKU Code | SKU Name | Dealer Price ₹ | Stock Cases | Scheme |
|---|---|---|---|---|
| SKU-BS-075 | Glucose biscuit 75 g, case of 96 | 8.10 | 340 | Buy 10 cases get 1 free |
| SKU-DT-1KG | Detergent powder 1 kg, case of 20 | 101.50 | 85 | 3% off 5 or more cases |
| SKU-TE-250 | Tea leaf 250 g, case of 40 | 118.00 | 0 | None |

Raw order message: `bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti`

## Submission requirements (for Phase 8)
- One ZIP with the TDD (PDF or Word) and `deployment.md`.
- TDD: GitHub URL at the top (plus live link); architecture and why; data model, main flows and how the AI part works; UI and design decisions (key screens and why they look that way); what was cut and what's next.
- `deployment.md`: how to run locally step by step; how it's deployed and env var names (never values); demo login details.
- Repo stays public; keep the commit history.
