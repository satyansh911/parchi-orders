# Parchi Orders: deployment and reviewer guide

- **Repository:** https://github.com/satyansh911/parchi-orders
- **Live app:** https://parchi-orders.vercel.app

Parchi Orders is a Next.js (App Router) app with PostgreSQL on Neon through Prisma. It is deployed on Vercel in the `sin1` (Singapore) region, next to a Singapore Neon database.

---

## 1. Demo logins (live app)

Login is a **mock OTP**. Enter the phone number, tap **Get code**, then enter the demo code **123456**. No SMS is sent.

| Role | Phone | Notes |
|---|---|---|
| Order desk | `9999900001` | Opens the order desk (queue, approval, Tally export) |
| Retailer R-0001 | `9999900101` | Gupta Kirana Store, standard tier |
| Retailer R-0007 | `9999900107` | Already at the credit limit, so any order shows the credit-hold path |
| Other retailers | `9999900102` – `9999900120` | 20 fictional shops with different tiers, credit and order history |

All names and phone numbers are fictional.

Retailer screens open in **Hindi**. Use the **English / हिंदी** toggle in the header to switch language; the choice is remembered per user.

---

## 2. Reviewer walkthrough

### Retailer: catalogue → cart → order
1. Log in as `9999900101`.
2. **Catalogue (सामान):** search (e.g. `chai patti 250`), filter by category, and add cases with the + / − stepper.
   - Prices are this retailer's case prices **excluding GST**, and the GST rate is shown.
   - Stock shows as a badge, never the full inventory.
   - Offers show as a badge, e.g. "Buy 10 cases get 1 free".
3. **Cart (कार्ट):** the server prices the cart with the same scheme engine used at placement.
   - The cart shows free cases, discounts, GST per rate and the total payable including GST.
   - A nudge such as "add 3 more, get 1 free" appears where it applies.
   - Credit available is shown, and an over-limit order must be confirmed (it then goes on credit hold).
4. **Place the order.** It appears under **Orders (ऑर्डर)** with its status. **Order again** copies an old order into the cart.

### Retailer: order from a WhatsApp-style message (AI capture)
1. Open the **पर्ची / Order slip** tab and paste a message, for example:
   `bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti`
2. Tap **ऑर्डर समझें / Read my order**. Each line then shows:
   - the retailer's **original words**;
   - a **confidence chip** (Sure, Please check, Choose product, Needs your answer);
   - the suggested product, with up to **two alternatives**;
   - a case quantity, with **unit and pack questions** where the message was unclear.
3. Correct any line (pick another product or change cases) or remove it. Lines that aren't "Sure" need a tap on **Looks right** (सही है). Out-of-stock items are flagged.
4. **Add to cart.** Nothing is ordered until the cart is placed as usual. The order is linked to the original message for the desk.
5. If the AI can't read the message, the screen says **"Couldn't read this message"** and offers **Add items myself**. This happens on a timeout, invalid output or a missing key.

### Order desk: review → approve → Tally export
1. Log in as `9999900001` to open the **Queue**.
   - Filters: **Needs action**, **Credit hold**, **Awaiting retailer**, **Approved**, **Exported**, **Cancelled**.
2. Open an order. The page shows:
   - the retailer and their current credit (limit, outstanding, open orders, available);
   - frozen lines with scheme, discount and GST, plus totals;
   - the original message for captured orders;
   - the full event history.
3. Actions:
   - **Approve.** Credit is re-checked; an order now over the limit moves to Credit hold instead.
   - **Release hold and approve** (for credit-hold orders).
   - **Reject** (reason required) releases the reserved stock.
   - **Cancel** an approved order (reason required) restores the stock.
   - **Edit cases or remove a line.** Only that line is re-priced at today's price and scheme.
     - If the total goes up, the retailer must press **Accept changes** on their order before the desk can approve.
4. **Tally export:**
   - The page shows the count and total of approved, not-yet-exported orders.
   - **Export N orders to CSV** creates one batch and marks those orders EXPORTED.
   - **Download CSV** re-downloads any past batch byte-identically.
   - An order can never be exported twice.

---

## 3. Local setup

### Prerequisites
- Node.js 24 or later (see `.nvmrc`) and pnpm 11 (pinned in `packageManager`).
- A PostgreSQL database. We use Neon. Production uses a Singapore project; tests use a **separate Neon branch**.
- Optional: a Google Gemini API key for live AI capture.

### Install and configure
```bash
git clone https://github.com/satyansh911/parchi-orders.git
cd parchi-orders
pnpm install                # also runs `prisma generate`
cp .env.example .env        # then fill in the values (never commit .env)
openssl rand -base64 32     # use the output as QUOTE_SIGNING_KEY
```

### Database
```bash
pnpm db:deploy              # apply all migrations (prisma migrate deploy)
pnpm db:seed                # 38 SKUs (incl. the brief's 3), 20 retailers, past orders, desk user
```

### Run
```bash
pnpm dev                    # http://localhost:3000
```
For local AI capture without a Gemini key, set `AI_CAPTURE_PROVIDER=fake`. This uses the scripted test provider and is **refused on Vercel**.

### Checks and tests
```bash
pnpm check                  # typecheck + ESLint + unit tests (no database)
pnpm test:db:init           # one-off: prepare the guarded test branch
pnpm test:integration       # integration tests on TEST_DATABASE_URL only
pnpm test:e2e               # Playwright at 360 px; builds the app against the test branch
```
Integration and E2E runs **refuse to start** unless all three hold:
- `TEST_DATABASE_URL` is set;
- it differs from `DATABASE_URL` and `DIRECT_URL`;
- its host is not listed in `PROTECTED_DATABASE_HOSTS`.

They also check for a marker table that only the test branch has. Don't run integration tests and E2E at the same time, because both reset the same test branch.

---

## 4. Environment variables (names only)

| Name | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | app, Vercel | Pooled Postgres URL for the app (`sslmode=verify-full`) |
| `DIRECT_URL` | migrations, Vercel | Direct (non-pooled) Postgres URL for `prisma migrate` (`sslmode=verify-full`) |
| `QUOTE_SIGNING_KEY` | app, Vercel | Base64, at least 32 random bytes. HMAC key for cart quotes; placement fails closed without it |
| `AUTH_DEMO_OTP` | app, Vercel | Must be exactly `true` to accept the demo code 123456. Anything else refuses every login (no real SMS provider) |
| `GEMINI_API_KEY` | app, Vercel | Server-side only. Without it, capture shows the "add items manually" path |
| `GEMINI_MODEL` | app, Vercel | Gemini model name (we use `gemini-3.5-flash`; see D107) |
| `AI_CAPTURE_PROVIDER` | local / tests only | `fake` selects the scripted provider; refused when `VERCEL=1` |
| `TEST_DATABASE_URL` | tests only | Neon **test branch** URL for integration and E2E |
| `PROTECTED_DATABASE_HOSTS` | tests only | Comma-separated hosts that tests must never touch |

No secrets are committed. `.env*` is git-ignored except `.env.example`, which lists names only.

---

## 5. Deployment (Vercel)

How it is deployed:
- The GitHub repository is connected to the Vercel project `parchi-orders`. Every push to `main` deploys to production.
- `vercel.json` pins the functions to the **`sin1`** region, next to the Neon Singapore database (ap-southeast-1).
- The build command is `pnpm build` (`prisma generate && next build`).

To reproduce:
1. Create a Neon project in **AWS ap-southeast-1**, then copy the pooled and direct connection strings. Append `sslmode=verify-full` to both.
2. Run the migrations and the seed once against it from your machine (§3).
3. On Vercel, import the GitHub repo (framework: Next.js). Set the env vars from §4 for **Production**:
   - `DATABASE_URL`, `DIRECT_URL`, `QUOTE_SIGNING_KEY`, `AUTH_DEMO_OTP=true`, `GEMINI_API_KEY`, `GEMINI_MODEL`;
   - do **not** set `AI_CAPTURE_PROVIDER`.
4. Deploy. Or use the CLI:
   ```bash
   vercel link
   vercel env add <NAME> production
   vercel deploy --prod
   ```
5. Smoke test: log in as a retailer and as the desk (§1), place an order, approve it, then export and download the CSV.

Migrations are **not** run during the Vercel build. Apply new migrations with `pnpm db:deploy` before deploying code that needs them.

---

## 6. AI capture configuration

- **Model call:** one structured-output call to Gemini through `@google/genai` (pinned 2.32.0).
  - `responseMimeType: application/json` with a JSON schema, temperature 0, low thinking;
  - an 8-second timeout and **no SDK retries**.
- **Prompt context:** catalogue names, pack and case sizes; this retailer's past-ordered products; their aliases; and the Hinglish glossary.
  - **No** prices, stock, credit or personal data are sent.
- **Treated as untrusted:** the model output is validated strictly, then mapped to active SKUs in code.
  - Confidence, unit and pack questions, and stock flags are decided by deterministic code, not by the model.
- **Rate limits** (database-backed, atomic): 5 messages per minute and 40 per day per user, plus 300 per day across the whole app.
- **Failures** (no key, timeout, busy, invalid JSON, empty) are saved as FAILED captures, and the user sees the manual path.

---

## 7. Tally CSV export

The format is our documented contract (see the TDD). It is **not** a native Tally XML import, and it has not been tested against a live Tally installation.

| Aspect | Contract |
|---|---|
| Rows | One row per order line, with a header row |
| Voucher type | `Sales` |
| Voucher number | The order number |
| Date | `DD-MM-YYYY` in IST |
| Party ledger | `<retailer code> <shop name>` |
| Sales ledger | `Sales @ <GST>%` |
| Tax ledgers | `Output CGST @ <GST/2>%` and `Output SGST @ <GST/2>%` (intra-state: Madhya Pradesh) |
| Quantity unit | Cases; free cases in a separate column with no value |
| Money | Rupees with 2 decimals; amounts exclude GST until `Line Total` / `Order Total`, which include it |

Columns, in order:

`Batch, Voucher Type, Voucher No, Voucher Date, Party Code, Party Ledger, Area, Item Code, Item Name, Unit, Paid Qty, Free Qty, Rate, Taxable Value, Discount %, Discount, Sales Ledger, GST %, CGST Ledger, CGST, SGST Ledger, SGST, Line Total, Scheme, Order Total`

- **Reconciliation:** each order is checked before export: taxable − discount + GST = line total, and the sum of line totals = order total. Any mismatch aborts the whole batch, so no order is marked exported.
- **Formula safety:** cells starting with `= + - @` are prefixed with `'` so spreadsheets won't run them.
