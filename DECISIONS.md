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
| — | — | — | — |

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
