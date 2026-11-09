# DECISIONS.md

My decisions for this build. Read this file before making implementation decisions. Do not silently invent or change business rules. If a new ambiguity arises, ask me before proceeding and append the answer to Section D.

Where a Section D decision refines an earlier section, Section D wins.

Format for new decisions: **Choice:** … **Why:** …

---

## A. Business Rules

### 1. Price unit

**Choice:** Display both per-piece and per-case pricing.
- Make the case price prominent, because retailers place orders in cases (peti).
- Show the per-piece price as secondary information, along with the number of pieces per case.

For the sample data, assume the supplied dealer prices are per individual consumer pack, not per case:

- Glucose biscuit: ₹8.10 × 96 = ₹777.60 per case.
- Detergent powder: ₹101.50 × 20 = ₹2,030 per case.
- Tea leaf: ₹118 × 40 = ₹4,720 per case.

Keep the price unit configurable, so this assumption can be changed without modifying application logic. Clearly label this as demo data requiring business confirmation.

**Why:** Retailers usually think in terms of cases and boxes, so the case price helps them understand their actual purchasing cost. Showing the per-piece price maintains transparency and prevents confusion.

### 2. GST display

**Choice:** Display dealer prices with an explicitly stated GST basis.
- For the initial implementation, assume dealer prices are GST-exclusive and display a clear "GST extra" label.
- Show the applicable GST amount and the final GST-inclusive payable amount in the cart and order summary.
- Store GST rates separately for each SKU, using configurable, explicitly labelled demo rates. Do not assume every SKU has the same GST rate. Actual rates must be verified using the product's HSN classification and the distributor's accountant.
- If actual dealer prices are confirmed to be GST-inclusive, display them as inclusive and do not add GST again.
- MRP, wherever available, must always be displayed as inclusive of all applicable taxes. Do not confuse MRP with dealer price.

**Why:** MRP is the consumer-facing maximum retail price, whereas dealer price is the distributor's wholesale selling price. Showing the GST basis explicitly prevents retailers from being surprised by additional charges and ensures accurate billing and Tally reconciliation.

### 3. Buy 10 cases, get 1 free

**Choice:**
- Apply the scheme for every complete multiple of 10 paid cases. For 21 paid cases, provide 2 free cases.
- Free cases must reduce available inventory.
- The scheme applies only when sufficient stock is available for both paid and free quantities.
- If free stock is insufficient, do not silently reduce the promotional benefit (see D7).
- Display paid quantity and free quantity separately.
- Free quantities must not be included in the paid quantity when calculating the scheme threshold.

**Why:** Retailers should receive the full promotional benefit they qualify for. The distributor must also avoid promising goods that are unavailable. Separating paid and free quantities makes the scheme transparent.

### 4. 3% discount on 5 or more cases

**Choice:**
- Apply a 3% discount to the entire eligible line when the retailer orders 5 or more paid cases.
- Do not apply the discount only to quantities above 5.
- Do not stack multiple schemes on the same SKU line.
- If multiple schemes are eligible, apply the scheme providing the highest monetary benefit to the retailer (see D2).
- Display the discount percentage and saved amount separately.
- Calculate the discount on the eligible taxable base before GST.

**Why:** A whole-line discount is easier for retailers to understand and encourages larger orders. Preventing scheme stacking protects distributor margins and avoids unpredictable pricing.

### 5. Out of stock / partial stock

**Choice:**
- If stock is zero, disable ordering for that product and clearly display "Out of stock".
- If the requested quantity exceeds available stock, offer the maximum available quantity as an alternative (see D7).
- Never automatically change the retailer's requested quantity.
- Require explicit retailer confirmation before accepting a reduced quantity.
- Backorders are not supported in the initial version.
- Stock is reserved at placement (D4); approval re-checks only lines the desk edited.

**Why:** Retailers should never discover after placing an order that products are unavailable. Offering available stock as an alternative keeps ordering convenient without silently modifying their requirements.

### 6. Credit limit

**Choice:** Allow retailers to submit orders even when their available credit is insufficient. Automatically mark such orders as `CREDIT_HOLD` and send them to the order desk for review.

Display:
- Total outstanding amount.
- Credit limit.
- Available credit.
- Amount exceeding the limit.

Only authorized order desk employees can release a credit hold. Orders on credit hold cannot be approved or exported until released.

**Why:** Completely blocking an order can interrupt a retailer's business. A credit hold gives the distributor control while allowing retailers to submit their requirements.

### 7. Who uses AI capture

**Choice:** Support AI order capture for both retailers and order desk employees.

- Retailers can type or paste WhatsApp-style messages directly into the application.
- Order desk employees can paste messages received through WhatsApp on behalf of retailers.
- Both workflows use the same AI extraction service and SKU-matching logic.
- AI-generated orders must be reviewed before placement.
- The order desk can correct extracted items and save verified retailer-specific aliases.
- Photo and voice-note extraction are deferred to a later phase.

**Why:** Retailers should be able to continue their existing ordering habits without learning a complicated system. The office team should also be able to process existing WhatsApp orders without requiring retailers to change their behaviour immediately.

### 8. Confidence levels

**Choice:** Use the following initial confidence thresholds (the final score is adjusted by code, see D10):

| Confidence | Classification | Behaviour |
|---|---|---|
| 90–100% | High | Preselect suggested SKU |
| 70–89% | Medium | Show suggestion and alternatives |
| Below 70% | Low | Require manual SKU selection |

Additional rules:
- Always display the original extracted text.
- Show two alternative SKUs wherever possible.
- Never guess ambiguous units such as case versus piece (see D3).
- Require clarification when product identity or packaging is uncertain.
- Even high-confidence suggestions require human review and confirmation before order placement.
- Store verified order desk corrections as retailer-specific aliases.
- AI confidence is a guidance signal, not a guarantee of correctness.

**Why:** The objective is to reduce manual work without sacrificing order accuracy. Confidence-based suggestions make the process faster while ensuring uncertain AI results never become incorrect orders.

### 9. Glossary of known words

**Choice:** Maintain a common glossary and retailer-specific product aliases.

Initial common mappings:

| Word / Phrase | Meaning |
|---|---|
| Peti | Case |
| Dabba | Box / case, depending on context |
| Chhota | Smallest available pack |
| Bada | Largest available pack |
| Washing powder | Detergent powder |
| Chai patti | Tea leaf |
| Biscuit | Biscuit product |
| 1 kilo / 1 kg | 1 kg variant |
| 250 wala | 250 g variant |

Additional rules:
- Match products using SKU names, packaging and aliases.
- Use retailer order history as additional context.
- Retailer-specific aliases take precedence over general aliases.
- Never map an ambiguous term to a SKU without sufficient evidence.
- Allow verified corrections to improve future matching for that retailer.

**Why:** Different retailers use different local names for the same products. A shared glossary improves initial matching, while retailer-specific aliases make the system more accurate over time.

### 10. Order lifecycle and editing

**Choice:** Use the following order lifecycle:

`DRAFT → PENDING_REVIEW → APPROVED → EXPORTED`

A pending order can additionally transition to `CREDIT_HOLD` or `REVIEW_REQUIRED`, depending on validation results.

Possible transitions:

- DRAFT → PENDING_REVIEW
- PENDING_REVIEW → APPROVED
- PENDING_REVIEW → CREDIT_HOLD
- PENDING_REVIEW → REVIEW_REQUIRED
- CREDIT_HOLD → APPROVED after desk release
- REVIEW_REQUIRED → APPROVED after desk correction
- PENDING_REVIEW / CREDIT_HOLD / REVIEW_REQUIRED → CANCELLED
- APPROVED → CANCELLED by the desk with a reason, only before export (D1)
- APPROVED → EXPORTED

Permissions:

| Stage | Retailer | Order Desk |
|---|---|---|
| Draft | Edit | Edit |
| Pending Review | Edit / Cancel | Edit / Approve / Reject |
| Credit Hold | View / Request cancellation | Edit / Release / Reject |
| Review Required | View / Clarify | Edit / Approve / Reject |
| Approved | View only | View / Cancel with reason |
| Exported | View only | View only |

Additional rules:
- Approved and exported orders cannot be edited (D1).
- Cancelled orders cannot be reactivated; create a new order instead.
- Every order desk correction must be recorded in the audit log (`OrderEvent`).
- Orders must preserve their original AI input and extracted values for traceability.

**Why:** Retailers need flexibility before an order is approved, while the distributor needs control over confirmed orders. A controlled lifecycle prevents accidental changes and maintains a clear history of every order.

### 11. Tally export

**Choice:**
- Generate CSV exports containing approved orders.
- Support daily batch export of multiple orders.
- Include order ID, retailer details, SKU, product name, paid quantity, free quantity, unit price, discount, GST rate, GST amount and final totals.
- Assign a unique export batch ID.
- Mark successfully exported orders as `EXPORTED`.
- Prevent duplicate exports using unique order IDs and export status.
- Failed exports remain retryable without duplicating previously exported orders.
- Maintain an export history for the order desk (D11).
- Native Tally XML integration is outside the initial scope.

**Why:** CSV is simple to generate, verify and demonstrate within the available development time. Batch exports reduce manual work, while unique IDs and export tracking prevent duplicate accounting entries.

---

## B. Technical Choices

### 12. Stack

**Choice:**
- Frontend: Next.js with TypeScript.
- Styling: Tailwind CSS.
- Backend: Next.js server-side route handlers and server actions.
- Database: PostgreSQL hosted on Neon.
- ORM: Prisma.
- Deployment: Vercel.
- Authentication: Custom mock OTP with secure session cookies.
- AI: Gemini API.

Use a modular backend structure separating:
- Authentication
- Catalogue
- Retailer pricing
- Inventory
- Scheme engine
- AI extraction
- Order management
- Credit management
- Tally export

Avoid introducing a separate Express backend unless a genuine requirement emerges.

**Why:** This stack allows the application to be developed and deployed quickly without maintaining a separate backend server. PostgreSQL provides reliable relational data management, while Prisma makes database operations easier to maintain.

### 13. Money representation

**Choice:** Represent monetary amounts as integer paise in application calculations and database storage.

Examples:
- ₹8.10 = 810 paise.
- ₹101.50 = 10,150 paise.
- ₹777.60 = 77,760 paise.

Use integer arithmetic for discounts and GST calculations, with the rounding policy in D6. Store percentage rates as integer basis points (1% = 100 basis points).

**Why:** Integer-based monetary calculations prevent floating-point precision issues and ensure consistent totals across catalogue, cart, order processing and exports.

### 14. Where scheme maths runs

**Choice:**
- All price, discount, GST, scheme and stock calculations must be validated on the server.
- The frontend can display a scheme preview, but final calculations are always performed by the backend.
- Create a reusable scheme calculation module with shared business rules.
- Persist the final applied scheme details against each order item, including eligible quantity, free quantity, discount and calculated amount.
- Stock validation and order creation must use database transactions to prevent overselling and inconsistent inventory updates.

**Why:** The client should never be trusted with final financial calculations. Server-side validation prevents manipulated requests and ensures consistent pricing regardless of how an order is created.

### 15. Mock OTP design

**Choice:**
- Use a fixed demo OTP of `123456`.
- Seed demo users with predefined phone numbers and roles.
- Validate the OTP on the server.
- Create a session after successful verification.
- Use secure HTTP-only session cookies.
- Store user identity and role in the database.
- Implement server-side role-based authorization.
- Include a logout function.
- Clearly mark this authentication as demo-only.
- Never trust a role supplied directly by the frontend.

**Why:** A real SMS integration is unnecessary for this task. Predictable demo login makes testing easier while preserving the structure of a proper authentication workflow.

### 16. AI model and tier

**Choice:**
- Use a currently supported Gemini Flash model through the official API.
- Keep the model name configurable through environment variables.
- Store API keys securely in environment variables.
- Use structured JSON output with schema validation.
- Pass only relevant SKU information, aliases and retailer purchase history.
- Use synthetic sample data for demonstrations.
- Do not send sensitive production retailer information through a demo or free-tier setup.
- Production deployment must use provider terms and data-processing arrangements approved for the distributor's privacy and DPDP obligations.
- Never allow AI to directly create, approve or export orders.

AI responsibilities:
- Understand Hindi/Hinglish messages.
- Extract product descriptions.
- Identify possible SKUs.
- Extract quantities and units.
- Provide confidence information.
- Suggest alternative SKUs.

Backend responsibilities:
- Validate SKU existence.
- Validate quantities and units.
- Calculate prices and GST.
- Apply schemes.
- Check inventory.
- Validate credit limits.
- Create orders only after confirmation.

**Why:** A Flash model offers a good balance between response speed, cost and language understanding for short Hindi/Hinglish ordering messages. Structured outputs make it easier to validate AI responses before processing them.

### 17. What I'm cutting

**Choice:** The initial implementation will include:

Core features:
- Retailer authentication.
- Retailer catalogue.
- Retailer-specific prices and schemes.
- Cart and order placement.
- Repeat order (D9).
- AI text-based order capture.
- AI confidence and alternative SKU suggestions.
- Scheme engine.
- Order desk.
- Credit holds.
- CSV Tally export.

Deferred features:
- Offline salesman mode and synchronization.
- Salesman-specific application mode.
- Hindi voice-note transcription.
- Handwritten image/photo extraction.
- Delivery tracking.
- Payments.
- Native Tally integration.
- Van loading lists.
- Inactive retailer dashboard.
- Production SMS/OTP integration.
- Order revisions (D1).
- Auto-expiry of stock reservations on held orders (D4).
- Per-retailer price overrides (D5).

**Why:** The priority is to demonstrate a complete and reliable ordering workflow from product discovery to order export. Additional features can be added later without compromising the core functionality or the six-week development timeline.

---

## C. Assumptions

1. Each retailer has a unique registered phone number.
2. Each product has a unique SKU code.
3. The sample dealer prices are assumed to be per individual consumer pack, with case quantities specified separately. This must be confirmed before production.
4. All orders are placed in whole cases (D3).
5. Each SKU has a configurable GST rate.
6. MRP and dealer price are separate fields.
7. Stock is shared across all retailers.
8. Each retailer belongs to a price tier with its own discount, and has its own credit limit (D5).
9. A SKU may have multiple schemes; only the best one applies per line (D2).
10. Free goods are recorded separately from paid quantities.
11. Both paid and free goods consume inventory.
12. Stock is reserved when an order is placed and released on cancel or reject (D4).
13. Orders are not automatically confirmed by AI.
14. Only approved orders can be exported.
15. All monetary calculations use paise.
16. Demo users, products, inventory, schemes and order history are seeded into the database.
17. All external integrations are mocked except the AI API.
18. All timestamps are stored in UTC and displayed in Indian Standard Time.
19. The application is mobile-first and supports English and Hindi text on retailer screens (D11).
20. Retailer-specific prices, credit details and order information are protected through server-side role and ownership checks.
21. All demo pricing and tax values are clearly identifiable as sample data, not actual commercial rates.
22. Free goods carry zero taxable value; GST treatment of free goods must be confirmed with the accountant (D6).

---

## D. Decisions Made During the Build

Claude Code appends new decisions here whenever a new ambiguity is resolved.

### D1. Editing approved orders
**Choice:** Approved and exported orders cannot be edited. The desk can cancel an approved (not yet exported) order with a reason; the retailer or desk then places a new order. No revision system.
**Why:** Simple and predictable for both sides; avoids a revision model that adds complexity without helping the core workflow.

### D2. Multiple schemes per SKU
**Choice:**
- A SKU can have more than one active scheme.
- Per line, the engine calculates every eligible scheme and applies the one with the highest monetary benefit to the retailer.
- Free-goods value = free cases × the retailer's case price.
- On a tie, apply the discount, because it doesn't consume stock.
- The UI shows "Best offer applied" and names the other offer.
- Seed one SKU with both a free-goods and a slab scheme to demonstrate this.
**Why:** The retailer always gets the best deal without doing maths; the distributor never pays two schemes on one line.

### D3. Pieces in AI-captured messages
**Choice:** Orders are in whole cases only. If a message mentions pieces or packets (e.g. "20 packet biscuit"), that line is flagged "Unit needs clarification" and shows a hint (e.g. "1 case = 96 packets"). It is never auto-converted; the person picks a case quantity.
**Why:** Keeps the "never guess units" rule while still helping the retailer convert quickly.

### D4. Stock reservation
**Choice:**
- Each SKU has `stockCases` and `reservedCases`; available = stock − reserved.
- Placing an order reserves paid + free cases in a single transaction with a conditional update (it fails if not enough is available).
- Approval moves the quantity from reserved to deducted.
- Cancel or reject releases the reservation.
- The cart itself does not reserve.
**Why:** What the retailer sees at checkout is what they get, and two retailers can never be promised the same last cases. Next step: auto-expire reservations on orders left on hold too long.

### D5. Retailer-specific prices
**Choice:**
- Use price tiers.
- Each SKU has a base dealer price per piece.
- Each retailer belongs to a tier with a discount in basis points (demo: STANDARD = 0%, KEY_ACCOUNT = 2%).
- The tier applies to the case price before schemes.
- Per-retailer overrides per SKU are a next step.
**Why:** Covers "his price" with one small table, is easy for the desk to manage, and is easy to explain.

### D6. Rounding policy
**Choice:** All amounts are integer paise and all rates are basis points.
- Case price = piece price × pieces per case, then the tier discount, rounded half-up once per case.
- Line taxable = paid cases × case price.
- Discount = round half-up(taxable × discount bps / 10000).
- GST = round half-up((taxable − discount) × GST bps / 10000), per line.
- Line total = taxable − discount + GST.
- Order total = sum of line totals.
- Free cases carry zero taxable value; their reference value is shown.
**Why:** One deterministic rule, so the catalogue, cart, order and CSV always match to the paisa.

### D7. Max quantity with free goods
**Choice:** When stock is short, the offered maximum is the largest paid quantity whose paid + free cases fit in available stock (e.g. 340 available → 309 paid + 30 free = 339). The free benefit is never reduced silently. Because stock is reserved at placement (D4), a free-goods shortfall cannot appear later.
**Why:** The retailer gets the full scheme on what can actually be delivered.

### D8. REVIEW_REQUIRED
**Choice:**
- Used for orders with unresolved AI lines or a failed stock or price recheck.
- The desk can edit SKU and quantity; pricing, scheme and stock are re-run by the same engine.
- The desk then approves, or rejects with a reason.
- Every edit is written to an `OrderEvent` audit table.
**Why:** The desk fixes problems in one place, and every change is traceable.

### D9. Repeat order
**Choice:** Included. "Order again" on a past order copies its lines into the cart at today's price, scheme and stock; unavailable items are flagged, not dropped silently.
**Why:** The fastest way for a regular shopkeeper to order in under a minute, for very little build effort.

### D10. Confidence = model score adjusted by code
**Choice:** The model returns a 0–100 score per line, and code adjusts it:
- exact retailer alias match → High;
- SKU in this retailer's recent orders → +10;
- SKU never ordered and not an alias → −15;
- missing or piece unit → "Needs clarification" whatever the score;
- out-of-stock SKU → kept but flagged.
Thresholds stay at 90 and 70 and are checked against the eval set.
**Why:** An LLM's self-reported confidence is poorly calibrated; grounding it in the retailer's own history makes the label more trustworthy.

### D11. Scope trims for time
**Choice:**
- No revisions (D1).
- The audit log is a simple `OrderEvent` table.
- Export history is an `ExportBatch` table only; a retry just re-exports APPROVED orders not yet exported (naturally idempotent).
- Hindi strings cover the retailer screens; desk screens are English.
**Why:** Keeps the full core flow polished within the time available; the trimmed parts don't change the client's main outcome.

### Further decisions during the build
| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-07 | D12 Cart and DRAFT | Cart in localStorage; DRAFT not used | Fast on 3G, no write per tap |
| 2026-11-07 | D13 Sessions | DB sessions, hashed token, 7 days | Real logout, role re-read each request |
| 2026-11-07 | D14 AI rate limit | DB table: 5/min, 40/day per user, 300/day global | No extra service; protects Gemini cost |
| 2026-11-07 | D15 Language | Hindi names seeded, picker on login, default Hindi | Primary users are kirana retailers |
| 2026-11-07 | D16 Idempotent submit | Request ID per cart, retries return the same order | Flaky connections must not duplicate orders |
| 2026-11-07 | D17 Salesman | Not in schema; future extension | Only two roles in the core slice |
| 2026-11-07 | D18 Dual scheme, short stock | Offer both valid options, retailer picks | Never switch silently, never over-promise |
| 2026-11-07 | D19 Nudges | Free-goods and slab nudges when stock allows | Explains offers, encourages larger orders |
| 2026-11-07 | D20 Available credit | Limit − outstanding − open orders | Stops order-splitting past the limit |
| 2026-11-07 | D21 Status at submit | REVIEW_REQUIRED > CREDIT_HOLD > PENDING_REVIEW | Correct lines first, then credit |
| 2026-11-07 | D22 Price freeze | Freeze at submit; only edited lines re-priced | Retailer pays what they agreed to |
| 2026-11-07 | D23 Retailer on open orders | Edit in PENDING_REVIEW; request/notes otherwise | Flexibility before approval, desk keeps control |
| 2026-11-07 | D24 Cancel approved | Restore stock exactly once, in a transaction | Undispatched goods return to stock |
| 2026-11-07 | D25 Images | Lightweight SVG pack illustrations | Fast on 3G, no licensing |
| 2026-11-07 | D26 Stock visibility | In stock / Only N left (≤ 20) / Out of stock | Useful without exposing inventory |
| 2026-11-07 | D27 Partial capture | Retailer may confirm with unresolved lines | One unclear item shouldn't block an order |
| 2026-11-07 | D28 Aliases | Only desk corrections become aliases | Retailer mis-taps must not pollute matching |
| 2026-11-07 | D29 Tally export | One button, all approved not yet exported | Simple daily batch, reliable history |
| 2026-11-07 | D30 Order lifecycle | Consolidated transition list (below) | Single source after D21–D27 |
| 2026-11-07 | D31 Engineering expectations | Paise, transactions, audit, isolation, config | Standing rules for every phase |

### D12. Cart and DRAFT (resolves C1)
**Choice:** The cart lives in localStorage on the device. DRAFT is not used in the active order workflow and stays in the enum only for a possible future salesman/offline mode. Unconfirmed AI captures stay in `Capture`/`CaptureLine` records and never create `Order` records.
**Why:** Keeps the retailer experience fast on slow 3G and avoids a database write on every cart interaction.

### D13. Sessions
**Choice:** Database-backed sessions. A random session token is stored in an HTTP-only, Secure, SameSite=Lax cookie; only its SHA-256 hash is stored in the database. Sessions expire after 7 days. Logout revokes the session. User role and permissions are re-read from the database on every request.
**Why:** Better security, real revocation and centralised permission management.

### D14. AI capture rate limiting
**Choice:** A database table enforces the limits with atomic operations, so they hold across concurrent Vercel instances:
- 5 AI captures per minute per user.
- 40 AI captures per day per user.
- 300 AI captures per day globally.
**Why:** No extra external service, while protecting against excessive use and unexpected Gemini costs.

### D15. Language
**Choice:** Seed Hindi product and category names alongside English. Language picker on the login screen; the choice is remembered per user; Hindi is the default. English stays available.
**Why:** The primary users are Indian kirana retailers who may be more comfortable ordering in Hindi.

### D16. Idempotent order submission
**Choice:** Generate a unique request ID when the cart is initialised and reuse it for retries. Submitting the same request more than once returns the original order instead of creating a duplicate. This must hold under concurrent requests.
**Why:** Retailers have unstable connections; a retry must never create a duplicate order.

### D17. Salesman role (resolves C5)
**Choice:** Leave the salesman role and salesman relationships out of the initial schema. Document it as a future extension.
**Why:** The core slice has two roles, retailer and order desk. Avoid unused functionality and schema complexity.

### D18. Free goods that don't fit in stock on a dual-scheme SKU (refines A.3 and D7; resolves C3)
**Choice:** When the retailer qualifies for free goods but available stock can't cover the full free quantity, offer both valid choices and let the retailer pick. Example, 340 available, Buy 10 Get 1 and 3% off 5+:
- Option 1: 309 paid + 30 free = 339 cases.
- Option 2: 340 paid with 3% off.
Never switch schemes or quantities silently. Revalidate and reserve inventory in a transaction after the choice is made.
**Why:** Gives retailers flexibility while the distributor never promises stock it doesn't have.

### D19. Scheme nudges
**Choice:** Show a nudge whenever the next eligible quantity can be met from available stock, e.g. "Add 3 more cases to get 1 free" or "Add 2 more cases to unlock 3% off". Free goods: next complete multiple. Slabs: next applicable slab.
**Why:** Helps retailers understand offers and encourages larger orders without being intrusive.

### D20. Available credit
**Choice:** Available credit = credit limit − outstanding − total value of open orders.
- Open orders: PENDING_REVIEW, CREDIT_HOLD, REVIEW_REQUIRED, and APPROVED but not yet exported.
- Use each order's net payable (after discounts, including GST).
- Exclude CANCELLED and EXPORTED orders.
- Never count the order being validated twice.
**Why:** Stops retailers from splitting a large order into smaller ones to get past the limit.

### D21. Status at submission and precedence (resolves C2)
**Choice:**
- Credit is calculated during submission.
- If the order has unresolved AI lines, it is created as REVIEW_REQUIRED (this takes precedence over credit).
- Otherwise, if it exceeds available credit, it is created directly as CREDIT_HOLD, with a system `OrderEvent` recording the amount over the limit.
- Otherwise it is created as PENDING_REVIEW.
- When the desk resolves a REVIEW_REQUIRED order, credit is recalculated; if still over the limit, the order moves to CREDIT_HOLD. New transition: REVIEW_REQUIRED → CREDIT_HOLD.
**Why:** Product and quantity correctness should be settled before credit is finalised.

### D22. Price freeze and desk edits (resolves C4)
**Choice:** Prices, schemes and GST are frozen at submission. When the desk changes a line, only that line is recalculated with the current price and scheme rules; the original line details are kept in the audit history. If a change materially alters the payable amount, the retailer must acknowledge it before final approval.
**Why:** Retailers get the prices and schemes they agreed to; desk corrections never silently change their financial commitment.
**Open:** what counts as "material", and how acknowledgement works. See Open items.

### D23. Retailer actions on open orders (refines A.10)
**Choice:**
- PENDING_REVIEW: the retailer can edit quantities or remove lines, through the same server-side validation and pricing as the desk.
- CREDIT_HOLD and REVIEW_REQUIRED: the retailer can request cancellation and add clarification notes, but cannot modify the order directly.
- Requests and notes are recorded as order events.
**Why:** Flexibility before approval, while the desk keeps control of orders that need intervention.

### D24. Cancelling an approved order
**Choice:** When the desk cancels an APPROVED order, the deducted stock is restored to inventory in a database transaction, exactly once.
**Why:** Cancelled, undispatched orders must not permanently consume inventory.

### D25. Product images
**Choice:** Lightweight SVG pack illustrations with distinct product shapes, restrained brand/category colours, consistent dimensions and a polished look.
**Why:** Fast on slow 3G, consistent, and free of external images and licensing.

### D26. Stock visibility for retailers
**Choice:** Three states: "In stock"; "Only N cases left" when available stock is 20 cases or fewer; "Out of stock". Exact quantities above 20 cases are never shown.
**Why:** Useful availability information without exposing the distributor's full inventory.

### D27. Confirming a capture with unresolved lines
**Choice:**
- Retailers may confirm a capture with some lines unresolved.
- Resolved lines are priced and reserved; unresolved lines keep their original words and are attached to the order.
- The order enters REVIEW_REQUIRED, and the desk must resolve every remaining line before approval.
- Captures started by the desk must have every line resolved before confirmation.
- Unresolved lines can never be exported.
- Partial reservations are transactional and released correctly if the order is cancelled.
**Why:** One unclear product doesn't block the retailer, while final processing stays under human supervision.

### D28. Aliases
**Choice:** Only verified desk corrections become permanent retailer-specific aliases. Retailer selections are recorded and used as matching context (the +10 adjustment in D10) but never become aliases automatically.
**Why:** Desk corrections are verified; accidental retailer taps would degrade future matches.

### D29. Tally export
**Choice:**
- One button exports every APPROVED order not yet exported. Before exporting, show the number of orders and their total value.
- Each export is a batch CSV with a unique batch ID; exported orders are marked EXPORTED.
- Duplicate exports are prevented.
- The exact CSV contents are stored so past batches re-download byte-identically.
- Failed exports are safely retryable.
**Why:** Minimal manual effort for the office team, with a reliable export history.

### D30. Order lifecycle, consolidated (supersedes the transition list in A.10 where they differ)
Derived from A.10, D1, D12 and D21–D27. DRAFT is unused (D12).

| From | To | Who | Condition |
|---|---|---|---|
| (submission) | REVIEW_REQUIRED | system | Unresolved AI lines (D21, D27) |
| (submission) | CREDIT_HOLD | system | Over available credit; system event records the excess (D21) |
| (submission) | PENDING_REVIEW | system | Otherwise |
| PENDING_REVIEW | APPROVED | desk | |
| PENDING_REVIEW | CREDIT_HOLD | system | Credit re-check fails (see Open items) |
| REVIEW_REQUIRED | APPROVED | desk | All lines resolved, within credit |
| REVIEW_REQUIRED | CREDIT_HOLD | system | All lines resolved, over credit (D21) |
| CREDIT_HOLD | APPROVED | desk | Desk releases the hold |
| PENDING_REVIEW | CANCELLED | retailer or desk | Retailer cancels own order; desk rejects with reason |
| CREDIT_HOLD / REVIEW_REQUIRED | CANCELLED | desk | Reject with reason (retailer can only request, D23) |
| APPROVED | CANCELLED | desk | Reason required, before export only; stock restored (D1, D24) |
| APPROVED | EXPORTED | desk | Via export batch (D29) |

CANCELLED and EXPORTED are final.

### D31. Engineering expectations (standing rules)
1. All financial calculations in integer paise.
2. Database transactions for stock reservation and release, credit validation and order submission.
3. Idempotency and stock reservation must be correct under concurrent requests.
4. A complete audit history of order modifications, status changes, scheme applications and desk corrections.
5. Retailer data isolation enforced on the server.
6. Business rules configurable where possible.
7. No deferred features without approval.

### Open items
O1–O4 were raised on 2026-11-07 and resolved the same day as D32–D35. Past-order seeding is D36.

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-07 | D32 Retailer acknowledgement (O1) | Flag on order; increases or SKU swaps need acknowledgement | Desk changes never silently raise the commitment |
| 2026-11-07 | D33 Credit recheck at approval (O2) | Yes; over limit → CREDIT_HOLD | Credit may change between submit and approval |
| 2026-11-07 | D34 Discount instead of free goods (O3) | Only when free goods can't fit in stock | Best offer (D2) can't be bypassed via the API |
| 2026-11-07 | D35 Demo GST rates (O4) | Biscuits 5%, tea 5%, detergent 18%, per SKU | Demo only, verify against HSN |
| 2026-11-07 | D36 Past-order seeding | At end of Phase 2, priced by the domain engine | One source of truth for pricing |

### D32. Retailer acknowledgement of desk changes (resolves O1; refines D22)
**Choice:**
- **Material change:** any increase in the order total, or a different SKU on a line the retailer had already seen priced, requires retailer acknowledgement. Decreases are shown to the retailer but do not block approval.
- **Unresolved AI lines:** once the desk identifies the product and prices it, the retailer must see the revised total and acknowledge it before approval. The absence of an earlier price is not consent.
- **Mechanism:** an acknowledgement flag on the order, not a new status.
- **Retailer actions:** the retailer sees the revised order with two actions, **Accept changes** or **Request cancellation**.
- **Desk queue:** gets an **Awaiting retailer** filter.
- **Enforced on the server:** the desk cannot approve while acknowledgement is pending.
- **No response:** the desk can cancel with a reason. Auto-expiry stays deferred.
- **History:** original values and the full change history are preserved for every desk edit.
**Why:** Desk corrections must never silently increase what the retailer has committed to pay.

### D33. Credit recheck at approval (resolves O2)
**Choice:** When the desk approves an order, available credit is recalculated with the D20 formula, without counting the current order twice. If the retailer is now over the limit, the order moves from PENDING_REVIEW to CREDIT_HOLD automatically, and the reason is recorded in `OrderEvent`.
**Why:** Outstanding balances and other orders can change between submission and approval.

### D34. Choosing the discount instead of free goods (resolves O3; refines D18)
**Choice:** The retailer can choose the discount instead of free goods only when the free goods can't be fulfilled because stock is insufficient. Otherwise the D2 best-offer rule is enforced. The server ignores or rejects any other offer sent directly to the API. Stock and the selected offer are revalidated in a transaction at submission.
**Why:** The best-offer rule protects both sides and must not be bypassable by the client.

### D35. Demo GST rates (resolves O4)
**Choice:** Biscuits 5%, tea 5%, detergent 18%. These are demo assumptions to be verified against the actual HSN codes before production use. GST is configurable per SKU (`gstBps`) and never hard-coded in business logic.
**Why:** Realistic demo values without baking unverified tax rates into code.

### D36. Past-order seeding
**Choice:** Past orders are seeded at the end of Phase 2, using the same domain-engine functions the application uses. Phase 1 seeds the catalogue, schemes, stock, tiers, retailers, credit and users only.
**Why:** One source of truth for pricing, schemes and GST matters more than seeding history earlier.

### D37. Seed data (approved defaults)
**Choice:**
- Fictional demo brands: Rewa Foods, Kanha Chai, Sitara Home Care and Bhedaghat Masale. Brief SKUs: biscuit → Rewa Foods, detergent → Sitara Home Care, tea → Kanha Chai.
- 20 fictional retailers across Jabalpur localities, including 4 key accounts.
- Fake phone-number pattern: desk `9999900001`, retailers from `9999900101`. OTP `123456`.
- Hindi product and category names, Hindi as the default language.
- All demo data clearly identifiable as synthetic.
**Why:** Realistic demo data that is obviously not real.
**Before production:** verify that the brand names do not conflict with real businesses or trademarks.

### Phase 1 review and Phase 2 decisions (2026-11-08)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-08 | D38 Database region | Neon Singapore (ap-southeast-1) primary; Vercel functions in sin1 | ~4x lower latency; colocated app and DB |
| 2026-11-08 | D39 Database TLS | `sslmode=verify-full&channel_binding=require` everywhere | Verified certificate and hostname |
| 2026-11-08 | D40 Old US database | Kept untouched until major phases and deployment are verified | Safe rollback point |
| 2026-11-08 | D41 Demo GST, all categories | Biscuits, tea, snacks, spices 5%; detergent, cleaners 18% | Demo only; verify against HSN |
| 2026-11-08 | D42 Free goods short, single scheme (P1) | Offer max paid with free goods, or requested qty without free goods | Explicit choice, no lost sale |
| 2026-11-08 | D43 Scheme dates (P2) | Half-open window; date-only dates are whole IST calendar days | Unambiguous expiry |
| 2026-11-08 | D44 Nudges (P3) | At most one useful nudge per line | Uncluttered, between customers |
| 2026-11-08 | D45 Order size limits (P4) | ≤ 999 cases per line, ≤ ₹1 crore per order | Stays within Int columns; far above real orders |
| 2026-11-08 | D46 Other-offer label (P5) | Named only if a different offer type | Avoids noise for slab vs slab |
| 2026-11-08 | D47 Stale offer choice (P6) | Return OFFER_CHANGED, retailer re-confirms | Never switch silently |
| 2026-11-08 | D48 Duplicate SKU lines (P7) | Rejected | Merging could silently cross a threshold |
| 2026-11-08 | D49 Integration test database (P8) | Separate Neon branch via TEST_DATABASE_URL, guarded | Real Postgres concurrency, no risk to real data |
| 2026-11-08 | D50 Free goods SKU | Always the same SKU as purchased | Matches the brief's schemes |

### D38. Database region
**Choice:** The Neon project in AWS Asia Pacific (Singapore, ap-southeast-1) is the primary development database. Vercel functions run in `sin1` (vercel.json) so the app and database are colocated.
**Why:** Measured median query round trip from the developer's machine fell from 326 ms (us-east-2) to 81 ms (about 4x); in production the functions sit next to the database.

### D39. Database TLS
**Choice:** Both connection strings (local and production) use `sslmode=verify-full&channel_binding=require`. Verified: TLS 1.3, certificate trusted, and a connection by raw IP is rejected because the hostname must match the certificate.
**Why:** Full certificate and hostname verification, and no reliance on the pg driver's changing defaults.

### D40. Old US database
**Choice:** Keep the old us-east-2 Neon project untouched (no deletes, writes or resets) until the major development phases are complete and the deployment is verified. Its connection strings are kept locally in a git-ignored backup file.
**Why:** A known-good rollback point at no cost.

### D41. Demo GST rates for all categories (extends D35)
**Choice:** Biscuits 5%, tea 5%, snacks 5%, spices 5%, detergent 18%, cleaners 18%. Demo assumptions only, not tax advice. GST stays configurable per SKU; actual HSN classification and rates must be verified before production.
**Why:** Consistent food / home-care demo split.

### D42. Free goods that don't fit, single free-goods scheme (P1; refines D7)
**Choice:** When the requested paid quantity fits in stock but its free cases don't (e.g. 335 biscuit cases with 340 available), offer two options and let the retailer pick:
- the largest paid quantity whose paid + free cases fit (309 + 30 free = 339), or
- the requested quantity without the free goods (335).
Nothing is switched silently. Together with D18 this gives one rule: when free goods don't fit, the alternative is the requested quantity with the best offer that has no free goods (a discount if one applies, otherwise none). This choice is only accepted when the free goods really don't fit (D34).
**Why:** The retailer chooses explicitly, and the sale isn't lost.

### D43. Scheme validity dates (P2)
**Choice:**
- A scheme is active on the half-open window `[startsAt, endsAt)`: active at its start instant, inactive at its end instant.
- Date-only dates are IST calendar dates and include the whole day: "valid 1–31 Oct" means from 1 Oct 00:00 IST up to (not including) 1 Nov 00:00 IST.
- Instants are stored in UTC.
- Activity is evaluated with server time at submission and then frozen on the order (D22). The cart preview uses the server time sent with the page.
**Why:** Removes ambiguity about the last day and about time zones.

### D44. Nudges (P3; refines D19)
**Choice:** At most one useful nudge per line. Among the next free-goods multiple and the next slab, show the one needing the fewest extra cases, and only if it beats the line's current offer and stock can cover it (including free cases). On a tie, show the larger benefit.
**Why:** One clear prompt is useful between customers; several are clutter.

### D45. Order size limits (P4)
**Choice:** At most 999 paid cases per line and at most ₹1 crore (1,00,00,00,000 paise) per order total; above that the order is rejected with `ORDER_TOO_LARGE`. At most 50 lines per order (Phase 0 contract).
**Why:** Keeps every amount far inside the database's Int range (about ₹2.14 crore) without BigInt, and is far above any real kirana order.

### D46. Other-offer label (P5; refines D2)
**Choice:** The "also eligible" offer is named only when it is a different type from the applied one (free goods vs discount). A lower slab of the same type is not named.
**Why:** "Also eligible: 3% off" next to an applied 5% slab is noise.

### D47. Stale offer choice at submission (P6)
**Choice:** If the retailer chose the no-free-goods option because stock was short, but at submission the free goods fit again, the server returns `OFFER_CHANGED` and the retailer re-confirms. It never switches offers silently.
**Why:** Consistent with "never switch schemes or quantities silently" (D18).

### D48. Duplicate SKU lines (P7)
**Choice:** An order containing the same SKU on more than one line is rejected (`DUPLICATE_SKU`). The cart keeps one line per SKU.
**Why:** Merging lines could silently cross a scheme threshold.

### D49. Integration test database (P8)
**Choice:** Integration tests (stock reservation, concurrency) run against a separate Neon branch reached through `TEST_DATABASE_URL`, with `pnpm test:integration`. Unit tests never touch a database. A guard refuses to run if the test URL points at the primary database, at any protected host (e.g. the old US database), or at a database without the test marker.
**Why:** Real Postgres locking behaviour, with no way to wipe real data by mistake.

### D50. Free goods SKU
**Choice:** Free goods are always the same SKU as the purchased SKU.
**Why:** Matches every scheme in the brief; the schema has no separate free-item field.

### Phase 2 review (2026-11-08)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-08 | D51 Stock option rules | Three derived rules approved (below) | Precise behaviour for D7, D18, D34, D42, D47 |
| 2026-11-08 | D52 Historical order size | 1–3 lines, 1–3 cases per line | Close to the brief's ₹5,000 average order |
| 2026-11-08 | D53 Historical order records | No export batch; engine-priced; current credit snapshot; clearly marked as seeded history | Honest, traceable demo data |

### D51. Stock option rules (refines D7, D18, D34, D42, D47)
**Choice:**
1. A "with free goods" option is offered only if it actually includes free cases. Example: 10 available, 10 asked → only "10 without free goods" (9 cases with no free goods is never better).
2. The "without free goods" alternative (D42) also applies when more than the available stock is asked for, capped at what is available. Example: 400 biscuit cases asked, 340 available → "309 + 30 free" or "340 without free goods".
3. D34 and D47 share one outcome, `OFFER_CHANGED`, which returns the current best line. The engine cannot tell a bypass attempt from stock that came back, and in both cases the retailer must re-confirm.
**Why:** Options are always genuinely useful, consistent whether stock is short or exceeded, and the best-offer rule can't be bypassed.

### D52. Historical order size
**Choice:** Seeded historical orders have 1–3 lines with 1–3 paid cases each.
**Why:** The first seed produced ₹10,730–₹1,27,215 orders against the brief's ₹5,000 average; smaller orders are realistic for kirana shops.

### D53. Historical (seeded) order records
**Choice:**
- No export batch association: they were keyed into Tally before the app existed.
- Totals are calculated by the domain engine at the order's date and the retailer's tier.
- The credit snapshot uses the retailer's current figures (the historical ones are unknown).
- They are clearly identifiable as seeded historical demo records, not orders created through the application.
**Why:** The demo needs order history (repeat order, AI capture context) without pretending it came from the app.
**Note:** With 1–3 lines of 1–3 cases, the seeded median order is ₹11,566 (about 2.3x the brief's ₹5,000) because A.1 case prices run ₹777–₹5,460. Totals are not manipulated to hit ₹5,000; the TDD states this discrepancy openly.

### Phase 3: authentication and roles (2026-11-08)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-08 | D54 OTP mechanism (Q1) | `OtpProvider` interface; demo provider accepts only 123456; no challenge table | Real SMS later = one new provider |
| 2026-11-08 | D55 Demo OTP switch (Q2) | `AUTH_DEMO_OTP=true` required; disabled by default | Production can't accidentally accept 123456 |
| 2026-11-08 | D56 OTP brute-force limits (Q3) | 5 failed checks/phone and 20/IP per 15 min; 5 requests/phone per 15 min | Ready for real SMS |
| 2026-11-08 | D57 Session expiry (Q4) | Fixed 7 days from login | As D13; simplest to reason about |
| 2026-11-08 | D58 Session caching (Q5) | None; re-read from DB on every render and action | Logout and demotion apply immediately |
| 2026-11-08 | D59 Session token (Q6) | 32 random bytes; store SHA-256 only; SESSION_SECRET removed | No secret adds nothing for a 256-bit random token |
| 2026-11-08 | D60 Session cookie (Q7) | `__Host-parchi_session` (prod) / `parchi_session` (local); HttpOnly, SameSite=Lax | Lax keeps WhatsApp links working |
| 2026-11-08 | D61 Multiple sessions (Q8) | Allowed; logout ends the current device only | Phone and shop computer |
| 2026-11-08 | D62 Refusal responses (Q9) | Others' records and wrong-role pages → 404; unauthenticated → login / 401 | Doesn't reveal what exists |
| 2026-11-08 | D63 Phone input (Q10) | Accept +91, spaces, leading 0; normalise to 10 digits starting 6–9 | How people type numbers |
| 2026-11-08 | D64 Proxy (Q11) | Optimistic cookie-presence redirect only; real checks server-side | Next.js guidance; no DB hit per request |
| 2026-11-08 | D65 Login page timing (Q12) | Functional now; design, picker and Hindi in Phase 4 | Keeps Phase 3 on security |
| 2026-11-08 | D66 Historical order source (Q13) | `OrderSource.HISTORICAL_SEED` via additive migration | Resolves D53 "clearly identifiable" |
| 2026-11-08 | D67 Action wrapper (Q14) | Every server action uses one wrapper with strict zod input | Guards provably on every action |
| 2026-11-08 | D68 Post-login redirect (Q15) | `next=` only for safe relative paths in the user's own area | No open redirects |
| 2026-11-08 | D69 Security requirements | Twelve non-negotiable rules (below) | Standing rules for every phase |

### D54. OTP mechanism (Q1; implements B.15)
**Choice:** An `OtpProvider` interface. The demo implementation accepts only `123456`. No OTP challenge table; failed attempts are counted in `RateLimitHit` (D56).
**Why:** Mocks the external SMS system cleanly; adding real SMS later means writing one provider.

### D55. Demo OTP switch (Q2)
**Choice:** Demo OTP login works only when `AUTH_DEMO_OTP=true` is explicitly configured; it is disabled by default. When enabled, the login screen shows the demo code. When disabled, login refuses with "SMS login not configured".
**Why:** Production can never accidentally accept the demo code.

### D56. OTP brute-force limits (Q3)
**Choice:** Per 15 minutes: at most 5 failed code checks per phone and 20 per IP; at most 5 code requests per phone. While locked, even a correct code is rejected. Counters use atomic database operations and are safe under concurrent requests.
**Why:** Meaningless with a fixed demo code, but the structure is in place for real SMS.

### D57. Session expiry (Q4; confirms D13)
**Choice:** Sessions expire exactly 7 days after login. No sliding renewal.
**Why:** Matches D13 and is the simplest behaviour to reason about.

### D58. No session caching (Q5; confirms D13)
**Choice:** The database-backed session is re-read on every page render and every action. No `use cache` or `use cache: private` on session reads; session-dependent UI streams behind `<Suspense>`.
**Why:** Logout, revocation and role changes take effect on the next request. The Next.js 16 guide's `use cache: private` pattern would allow up to 5 minutes of staleness.

### D59. Session token (Q6; refines D13)
**Choice:** Tokens are 32 cryptographically random bytes. Only the SHA-256 hash is stored. Raw tokens are never stored or logged. `SESSION_SECRET` is removed from the environment.
**Why:** A 256-bit random token can't be guessed or reversed from its hash; a secret would add nothing.

### D60. Session cookie (Q7; refines D13)
**Choice:** `__Host-parchi_session` in production (Secure, Path=/, no Domain attribute); `parchi_session` locally. Both HttpOnly, SameSite=Lax, Max-Age 7 days.
**Why:** `__Host-` binds the cookie to the exact host over HTTPS. SameSite=Strict would make the app look logged out when opened from a WhatsApp link.

### D61. Multiple sessions (Q8)
**Choice:** A user may have several active sessions (e.g. phone and shop computer). Logout revokes only the current device's session.
**Why:** Matches how shops work.

### D62. Refusal responses (Q9)
**Choice:** Another retailer's record → 404 (not found). A retailer opening a desk page → 404. Unauthenticated → redirect to `/login` for pages, 401 for APIs.
**Why:** Doesn't reveal which records exist. Next.js `forbidden()` is still experimental.

### D63. Phone input (Q10)
**Choice:** Accept Indian numbers typed with `+91`, spaces or a leading `0`; normalise to 10 digits starting with 6–9; reject anything else.
**Why:** Matches how people type numbers, with one canonical stored form.

### D64. Proxy (Q11)
**Choice:** `proxy.ts` only checks whether a session cookie is present and redirects to `/login` if not. It does no database lookup. All authentication and authorization happens server-side in the data-access layer and actions.
**Why:** Next.js recommends proxy checks only as optimistic redirects.

### D65. Login page timing (Q12; sequencing for D15)
**Choice:** Phase 3 ships a minimal functional login page. The full design, language picker and Hindi strings follow in Phase 4 (commit #14).
**Why:** Keeps Phase 3 focused on security. D15 still holds for the final product.

### D66. Historical order source (Q13; resolves D53)
**Choice:** Add `OrderSource.HISTORICAL_SEED` with an additive migration. Seeded historical orders use it.
**Why:** Makes seeded history queryable and labelled in the UI, and impossible to confuse with app orders.

### D67. Server action wrapper (Q14)
**Choice:** Every server action is built with one common wrapper, `action({ role, input, handler })`. It resolves the session, enforces the role and validates input with a strict zod schema that rejects unknown keys. A test fails if any exported action isn't built with the wrapper.
**Why:** Guards on every action are enforced structurally, not by convention.

### D68. Post-login redirect (Q15)
**Choice:** `next=` is honoured only for safe relative paths in the authenticated user's own area. Otherwise retailers go to `/catalogue` and desk users to `/desk`. `//host`, absolute URLs and other-role paths are ignored.
**Why:** Prevents open redirects and cross-role confusion.

### D69. Security requirements (standing rules)
1. Never trust client-supplied `userId`, `role` or `retailerId`.
2. Resolve the user, role and retailer from the database-backed session.
3. Retailer data-access queries are always scoped to the authenticated `retailerId`.
4. Retailer actions reject unknown keys, especially `retailerId` and `role`.
5. Desk actions require an explicit `retailerId` whenever an operation concerns a particular retailer.
6. Session tokens use cryptographically secure randomness; raw tokens are never stored or logged.
7. Logout is POST-only and revokes only the current session.
8. Role changes and demotions take effect on the next request.
9. Rate limiting uses atomic database operations and is safe under concurrent requests.
10. No retailer-specific prices, credit or orders enter shared server caches.
11. Route handlers that change state validate the request Origin (CSRF).
12. Production cannot accidentally accept the demo OTP.

### Open items (Phase 3)
R1–R3 were raised on 2026-11-08 and resolved the same day as D70–D72.

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-08 | D70 Cookie by protocol (R1) | Cookie name and Secure flag follow the real request protocol | Local production builds work over HTTP |
| 2026-11-08 | D71 Demo OTP on the reviewer deployment (R2) | Explicitly enabled on Vercel, with safeguards | Reviewers must be able to log in |
| 2026-11-08 | D72 Pre-login language (R3) | Device cookie `parchi_locale`, then `User.locale` | Consistent language before and after login |

### D70. Session cookie follows the request protocol (R1; refines D60)
**Choice:**
- HTTPS: `__Host-parchi_session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain.
- Local HTTP: `parchi_session`, HttpOnly, SameSite=Lax, Path=/, not Secure.
- Protocol detection trusts the `x-forwarded-proto` header only when running on Vercel (`VERCEL=1`), where Vercel's edge sets it and clients can't override it. Anywhere else, forwarded headers are ignored and the request is treated as HTTP.
- Tested for both configurations, including a spoofed header off Vercel.
**Why:** `NODE_ENV=production` would break local production builds on `http://localhost` (Phase 7 Lighthouse), and an untrusted forwarded header must never decide security settings.

### D71. Demo OTP on the reviewer deployment (R2; refines D55)
**Choice:** The controlled Vercel reviewer deployment explicitly sets `AUTH_DEMO_OTP=true`. Safeguards:
- The default remains false everywhere else.
- Only synthetic demo accounts and data exist.
- All phone and IP rate limits stay on.
- No real customer information is exposed.
- deployment.md states clearly that this is a controlled demo login mechanism, not production-grade SMS authentication.
- Real SMS integration remains deferred.
**Why:** Reviewers need to log in; the safeguards keep this from looking or acting like real authentication.

### D72. Pre-login language (R3; refines D15, implemented in Phase 4)
**Choice:** Language precedence:
1. Before login, the device cookie `parchi_locale` (`hi` or `en`).
2. After a successful login, the user's `User.locale` takes precedence.
3. The locale selected on the login screen is saved to `User.locale` at login.
4. If neither exists, Hindi.
**Why:** The user is unknown before login, so the choice must live on the device until it can be saved to the account.

### Phase 3 review (2026-11-09)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-09 | D73 Protected page status codes (O1) | Keep partial prerendering; generic shell may return HTTP 200 | Fast shell on 3G; no private data before authorization |

### D73. HTTP status codes on protected pages (O1; refines D62)
**Choice:**
- Keep partial prerendering. The generic static shell may return HTTP 200.
- Session-dependent content stays behind `<Suspense>`.
- Unauthorized retailer or desk content is never rendered or streamed.
- Wrong-role users see the not-found experience (inside a 200 response).
- Expired or invalid sessions are redirected to login (client-side, inside a 200 response). With no session cookie at all, the proxy returns a real 307.
- APIs (route handlers) always return real 401/404 responses.
- The TDD documents this accurately and never claims protected pages always return HTTP 404 or 307.
**Rule:** Security takes priority over rendering performance: no private data may enter the response before authorization succeeds.
**Why:** The static shell keeps first paint fast on slow 3G; correctness of access control does not depend on the status code.

### Phase 4: retailer side (2026-11-09)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-09 | D74 Cart preview (Q1) | Server action `previewCart`, debounced | Exact stock stays private; engine stays out of the client bundle |
| 2026-11-09 | D75 Quote token (Q2 + refinement 1) | Server-signed, retailer-bound quote; full recalculation at placement | Nothing changes silently; quote is never authorization |
| 2026-11-09 | D76 Request ID lifecycle (Q3 + refinement 2) | Keep ID and payload until resolved; new ID only once resolved | No duplicate orders, no ID reused for an edited cart |
| 2026-11-09 | D77 Retailer order actions (Q4) | Cancel PENDING_REVIEW; request cancellation on held/review orders; edit and accept-changes in Phase 6 | Shares Phase 6's line-editing engine |
| 2026-11-09 | D78 Repeat into a non-empty cart (Q5) | Ask "Replace cart" / "Add to cart"; add sums per SKU, capped at 999 | Explicit choice |
| 2026-11-09 | D79 Over-credit confirmation (Q6 + refinement 4) | Explicit confirmation, re-validated on the server | A stale confirmation can't bypass CREDIT_HOLD |
| 2026-11-09 | D80 Catalogue layout (Q7) | One product per row at 360 px; two columns from 640 px | Scannable with one thumb |
| 2026-11-09 | D81 Navigation (Q8) | Bottom bar: Catalogue, Orders, Cart | Thumb reach, minimal |
| 2026-11-09 | D82 Search (Q9) | Instant client-side filter; names EN/HI, brand, category, glossary words | No round trip per keystroke |
| 2026-11-09 | D83 Numbers (Q10) | Latin digits, Indian grouping, both languages | Matches bills and Tally |
| 2026-11-09 | D84 Fonts (Q11) | System fonts only | No web-font download on 3G |
| 2026-11-09 | D85 Colours (Q12) | Neutral ink/paper, one teal accent, semantic stock colours, light only | Restrained palette (brief) |
| 2026-11-09 | D86 Installable app (Q13) | Manifest and icons, no service worker | Offline deferred; no private data cached on device |
| 2026-11-09 | D87 Catalogue caching (Q14) | None in Phase 4; revisit in Phase 7 with measurements | No risk of private prices in caches |
| 2026-11-09 | D88 End-to-end tests (Q15) | Playwright, 360 px Chromium, guarded test branch only | Real taps, never the primary |
| 2026-11-09 | D89 Open-orders index | `Order(retailerId, status)` | Matches the credit query exactly |
| 2026-11-09 | D90 Stale previews (refinement 3) | Debounce; newest request wins; "updating" state | An old response never overwrites a newer cart |
| 2026-11-09 | D91 Phase 4 security (refinement 5) | D67, D69, D73 preserved | No private data before verification |

### D74. Cart preview on the server (Q1)
**Choice:** The cart is priced by a `previewCart` server action that runs the same domain functions as placement, called (debounced) after quantity changes. Quantities update on screen immediately; prices follow when the preview returns. The catalogue page receives only stock bands (D26), never exact stock above 20; exact quantities reach the retailer only through the stock-short options they trigger by asking for more (D7).
**Why:** Keeps inventory private and keeps the pricing engine out of the client bundle (light JS on low-end phones).

### D75. Server-signed quote token (Q2, refinement 1)
**Choice:**
- Every preview returns a quote token: a payload plus an HMAC-SHA256 signature made with a server-only key, env `QUOTE_SIGNING_KEY`.
- The payload is bound to the authenticated retailer and holds a digest of everything the retailer saw: normalised lines (sorted by SKU) with paid cases and offer choice, and per line the case price, applied scheme, free cases, discount, GST and line total. Also the order totals and the credit outcome (hold or not, and the amount over). The token also carries an issue time and a 30-minute expiry.
- At placement the server verifies the signature, the retailer and the expiry, then **independently recalculates everything** and compares digests. Any difference → `QUOTE_CHANGED` with a fresh preview; nothing is created.
- The quote is a change detector, never authorization: the session and role are checked first (D67), and the server never uses values from the token, only its own recalculation.
- If `QUOTE_SIGNING_KEY` is missing, previews and placement fail closed.
**Why:** The retailer always confirms exactly what will be charged; a forged, altered, expired or other-retailer quote can't be used.
**Note:** This adds one secret env var. D59 removed `SESSION_SECRET` because session tokens don't need one; this key is different, because a signature needs a secret.

### D76. Request ID lifecycle (Q3, refinement 2)
**Choice:**
- The cart holds one `clientRequestId`. When the retailer presses Place, the ID and the exact submitted payload are saved on the device as a pending submission, and the cart is locked.
- If the response is lost or times out, the app resolves that original request first by re-sending the same ID and payload. The server returns the order if it exists (`alreadyPlaced`). It never reuses the ID for an edited cart.
- A new ID is generated only once the original request is resolved: after a confirmed success, **or** after a definitive server answer that nothing was created (`QUOTE_CHANGED`, `STOCK_CHANGED`, credit confirmation needed, invalid lines).
- On the server, the same ID always returns the original order. A unique constraint makes simultaneous duplicates collapse to one order.
**Why:** Flaky 3G must never create duplicate orders.
**Interpretation:** Read literally, "generate a new ID only after confirmed success" would leave a retailer whose order was rejected (e.g. stock changed) unable to send an edited cart without reusing the ID. A definitive "nothing created" answer is treated as resolution, and the next attempt gets a new ID.

### D77. Retailer actions on their own orders (Q4; sequences D23, D32)
**Choice:** Phase 4: cancel own PENDING_REVIEW order (releases the reservation exactly once); "Request cancellation" plus note on CREDIT_HOLD / REVIEW_REQUIRED orders (event + `cancelRequestedAt`, no status change). Editing a pending order (D23) and "Accept changes" (D32) come in Phase 6 with the desk's line-editing engine.
**Why:** Both share Phase 6's engine; the Phase 4 actions are complete on their own.

### D78. Repeat order into a non-empty cart (Q5; refines D9)
**Choice:** Empty cart: copy the lines in. Non-empty: ask "Replace cart" or "Add to cart"; adding sums cases per SKU, capped at 999. Unavailable items are flagged, never dropped silently.
**Why:** Explicit choice; one line per SKU (D48).

### D79. Over-credit confirmation (Q6, refinement 4)
**Choice:**
- When the preview says the order would exceed available credit, the retailer must confirm: "This order is ₹X over your available credit. It will wait for the office to approve. Place anyway?"
- Placement sends `confirmCreditHold`.
- The server recalculates credit with the latest open orders and the recalculated total. If the order now needs a hold and the confirmation wasn't given, or the quote's credit outcome differs, it returns a fresh preview to confirm.
- The server always decides CREDIT_HOLD itself; a client can never place an over-limit order as PENDING_REVIEW.
**Why:** A stale or forged confirmation can't bypass CREDIT_HOLD.

### D80–D88. UI, search, numbers, fonts, colours, PWA, caching, E2E (Q7–Q15)
- **D80:** one product per row at 360 px (88 px pack image, name, large case price "+ GST", per-piece price, MRP small, stock and offer badges, stepper); two columns from 640 px.
- **D81:** bottom bar with Catalogue, Orders, Cart (with count); capture joins in Phase 5.
- **D82:** instant client-side filtering of the retailer's loaded list over English and Hindi names, brand, category and the DECISIONS #9 glossary; category and search in the URL.
- **D83:** Latin digits with Indian grouping (₹1,23,456.00) in both languages.
- **D84:** system font stack only (Android ships Noto Sans Devanagari).
- **D85:** neutral ink/paper, one teal accent for actions and offers, green/amber/red for stock; light theme only.
- **D86:** web app manifest and icons; no service worker (offline deferred; avoids caching private prices on devices).
- **D87:** no catalogue caching in Phase 4; revisit in Phase 7 with Lighthouse numbers.
- **D88:** Playwright at a 360 px Chromium viewport for the core journey, against the guarded test branch, seeded by a guarded `test:e2e:seed` (marker required) and served with `DATABASE_URL` pointed at the test branch. Never the primary. Not part of `pnpm check`.

### D89. Open-orders index
**Choice:** Add `Order(retailerId, status)` (additive migration). Existing `Order` indexes: `(status, placedAt)`, `(retailerId, placedAt)`, `(awaitingRetailerAck)` and the unique keys. The credit query filters `retailerId = ? AND status IN (PENDING_REVIEW, CREDIT_HOLD, REVIEW_REQUIRED, APPROVED)`; `(retailerId, placedAt)` would read every one of the retailer's orders, while `(retailerId, status)` matches the filter directly.
**Why:** Keeps the credit check cheap as order history grows.

### D90. Stale preview responses (refinement 3)
**Choice:** `previewCart` calls are debounced. Each carries a sequence number, and a response is applied only if it belongs to the latest request; older responses are discarded. While a recalculation is in flight, prices show an "updating" state and Place order is disabled.
**Why:** An older response must never overwrite a newer cart.

### Phase 5: AI order capture (2026-11-09)

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-09 | D92 Unresolved capture lines (Q1) | Every line resolved or explicitly removed before the cart; D27 deferred | Fits the Phase 4 cart path; no silent loss |
| 2026-11-09 | D93 Phase 5 scope (Q2) | Retailer capture only; desk paste-on-behalf, desk corrections and aliases in Phase 6 | Keeps Phase 5 focused; evidence is kept |
| 2026-11-09 | D94 Architecture | One grounded structured-output call + pure server post-processing | Simplest reliable design for this catalogue |
| 2026-11-09 | D95 Model and SDK (Q3) | `gemini-3.8-flash`, `@google/genai` 2.x pinned exactly | Stable model, mature SDK |
| 2026-11-09 | D96 Interpretation idempotency (Q4) | Client UUID stored on the capture | A retry is not a second, intentional order |
| 2026-11-09 | D97 Confidence methodology (refinement A) | Evidence-based, model score is one signal | Self-reported scores aren't calibrated |
| 2026-11-09 | D98 Cart merge idempotency (refinement B) | Server confirm returns the stored result; device ledger of merged captures | A capture can't add to the cart twice |
| 2026-11-09 | D99 Limits, tab, evaluation (Q5–Q7) | 1,000 chars, 30 lines; "पर्ची" tab; one approved real-model eval run | As proposed |
| 2026-11-09 | D100 Fake provider | Test-only, refused on Vercel | Deterministic tests, never in production |

### D92. Unresolved capture lines (Q1; defers D27)
**Choice:** Every extracted line must be resolved (product and case quantity chosen) or explicitly removed by the retailer before the capture's lines go into the cart. The original words, the model's interpretation and the retailer's resolution (including removals) stay stored on the capture; nothing is silently discarded.
**D27 is deferred, not dropped:** D27 placed orders with unresolved lines as REVIEW_REQUIRED. Phase 5 routes capture lines through the Phase 4 cart and placement (signed quote, idempotency, reservation, credit), which never creates REVIEW_REQUIRED orders. Supporting D27 would need changes to the cart, the quote, placement and desk tooling; with the submission deadline today, it is deferred to a later phase.
**Why:** One reliable path to an order; the retailer decides every line explicitly.

### D93. Phase 5 scope (Q2; sequences A.7 and D28)
**Choice:** Phase 5 delivers retailer capture only. Desk paste-on-behalf, desk corrections and alias saving/approval belong to Phase 6. Phase 5 keeps all evidence that workflow will need: original words, model suggestion, alternatives and the retailer's resolution per line.
**Why:** Focus; the desk workflow needs desk tooling.

### D94. AI architecture
**Choice:** One structured-output model call per message, grounded in the active catalogue (short IDs `S1…Sn`), this retailer's past-ordered SKUs, this retailer's approved aliases and the D9 glossary. Strict zod validation, then pure post-processing in `src/domain/capture` decides everything that matters. No RAG, embeddings, vector database, agents or second call. A pre-filter becomes worthwhile above about 300 active SKUs.
**Why:** The whole catalogue fits in one prompt; deterministic code, not the model, enforces trust.

### D95. Model and SDK (Q3, refinement D)
**Choice:** `GEMINI_MODEL=gemini-3.8-flash` (stable, not preview, never a floating alias). `@google/genai` pinned to an exact 2.x version (2.32.0 if its API is verified; never 3.0.0 in this phase). Temperature 0, explicit output-token cap, explicit timeout via abort signal, SDK retries disabled, and only a thinking setting the installed SDK supports.
**Why:** Reproducible behaviour; the time limit is ours, not the SDK's.

### D96. Interpretation idempotency (Q4, refinement C)
**Choice:** The client generates a UUID per interpretation request and stores it with the capture (`Capture.clientRequestId`, unique). A retry with the same UUID returns the existing capture; another retailer's UUID is refused. Sending the same text again with a new UUID is a new, intentional capture.
**Why:** A retry and a second intentional order are different operations.

### D97. Confidence methodology (refinement A; refines D8, D10)
**Choice:** The model's 0–100 score is one signal, adjusted by evidence the server checks itself:
- +10 if the SKU is in this retailer's past orders; −15 if neither past-ordered nor an alias (D10);
- −20 and capped at Low if the original words don't support the product (no name, brand, category or glossary match);
- capped at Low if the model's "original words" are not actually in the message.
Hard rules override the score:
- **Needs clarification** if the unit isn't an explicit case word ("peti", "case", "पेटी", "dabba") or the quantity is missing, invalid or not in the words. Pieces/packets are never converted (D3).
- **Needs clarification** if same-product pack sizes exist and the words don't pin one (a matching pack number, or "chhota"/"bada" picking the smallest/largest). Past orders never override a pack-size ambiguity.
- **At most Medium** if another product is equally supported by the words, unless past orders single out the suggestion.
- An exact approved retailer alias gives High only if it maps to one active SKU and the unit and quantity are valid.
Thresholds: High ≥ 90 (pre-selected), Medium 70–89 (suggested, must be confirmed), Low < 70 (must choose). Every suggestion, including High, can be corrected. Out-of-stock is flagged, not hidden.
**Why:** A score of 95 must not make an ambiguous product High.

### D98. Cart merge idempotency (refinement B)
**Choice:**
- Confirming is idempotent on the server: the first confirmation stores each line's resolution and marks the capture CONFIRMED; any later call returns the stored result (`alreadyConfirmed`) and ignores new input.
- The device cart keeps a ledger of capture IDs already merged, saved in the same storage write as the cart lines and kept when an order is placed. Merging a capture already in the ledger does nothing.
- A confirmed capture not yet in the ledger (response lost) can be resumed once; one already in the ledger shows "added to cart".
**Why:** Retries, reloads and double taps never add the same quantities twice.

### D99. Limits, navigation, evaluation (Q5–Q7)
**Choice:** Messages up to 1,000 characters; at most 30 extracted lines. A fourth bottom tab "पर्ची" / "Order slip". The real-model evaluation script runs once, only after deterministic tests pass and after a report of fixtures, expected outputs and estimated cost; never automatically.
**Why:** As proposed and approved.

### D100. Fake provider (test only)
**Choice:** `AI_CAPTURE_PROVIDER=fake` selects a deterministic fixture provider for integration and E2E tests. The server refuses it when `VERCEL=1`. The default is Gemini.
**Why:** Automated tests never call a paid API; production can never run on canned answers.

### D91. Phase 4 security (refinement 5)
**Choice:** D67, D69 and D73 apply unchanged. No private retailer data is rendered or streamed before session and role verification. Exact stock (above 20) and other retailers' prices are never exposed. All new actions use the D67 wrapper with strict input.
**Why:** Standing rules.

---

## Implementation Instructions

Before starting implementation:

1. Read this entire file.
2. Identify any contradictions or unresolved ambiguities.
3. Do not silently change any business rule.
4. If a critical ambiguity remains, ask me before implementing the affected functionality.
5. Treat demo assumptions as configurable rather than permanent business rules.
6. Propose the database schema, API contracts and application architecture based on these decisions.
7. Identify important edge cases and write test cases for pricing, GST, schemes, inventory, credit and order lifecycle.
8. Preserve the core scope and do not start implementing deferred features unless explicitly requested.
9. Maintain this file as the single source of truth for business decisions.
10. Append new decisions to Section D instead of overwriting existing decisions.

**Important:** Prioritize a polished, mobile-first retailer experience and a fully working end-to-end ordering workflow over unnecessary features or architectural complexity.

## Phase 6 implementation decisions (2026-11-09)
Made under the deadline instruction "make reasonable implementation decisions consistent with existing documentation"; each follows an existing decision.

| Date | Decision | Choice | Why |
|---|---|---|---|
| 2026-11-09 | D101 Desk edits | Desk changes paid cases or removes a line; only that line is re-priced at today's price and scheme (D22). Swapping a line's SKU is deferred: the desk rejects with a reason and the retailer re-orders. The last line can't be removed (reject instead). | Smallest safe slice of D22/D32; quantity edits cover the common "cut lines" case |
| 2026-11-09 | D102 Material change (D32) | Any edit that raises the order total sets `awaitingRetailerAck`; approval is refused on the server until the retailer taps "Accept changes". Decreases don't block. | D32 rule; no SKU swaps in D101, so "increase" is the only material case |
| 2026-11-09 | D103 Credit at approval (D33) | Approve re-checks credit without counting the order twice; over the limit → system moves it to CREDIT_HOLD with an event. "Release hold and approve" is the desk's explicit override. | D33, D30 |
| 2026-11-09 | D104 Tally CSV contract (D11, D29) | Sales voucher per order, one row per line; IST date DD-MM-YYYY; party ledger "code shop"; "Sales @ r%" and intra-state "Output CGST/SGST @ r/2%" ledgers (CGST = floor(GST/2)); cases with a separate free-qty column; per-order reconciliation, any mismatch aborts the batch; the desk confirms the previewed count and total; formula-safe cells. | Documented, checkable format; not a native Tally import |
| 2026-11-09 | D105 Capture → order link | The device cart remembers the capture it came from; placement links it (own, CONFIRMED, unlinked capture only) and sets source AI_CAPTURE, so the desk sees the original message and line resolutions. | Brief: desk "only has to check" messages turned into orders |
| 2026-11-09 | D106 Desk language | Desk screens English only; retailer screens Hindi + English. | D11 scope trim |
| 2026-11-09 | D107 Production Gemini model (refines D95) | `gemini-3.5-flash` via `GEMINI_MODEL` (code default updated to match) | On 9 Nov `gemini-3.8-flash` returned 503 "high demand" or exceeded 8 s on every live call. After switching, the live check of the brief's message gave 3/3 correct lines in 4.4 s. Chosen by me when asked. |
