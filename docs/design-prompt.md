# Prompt for Claude Design: Parchi Orders UI redesign

Copy everything below the line into Claude Design.

---

## Who you are designing for

**Parchi Orders** is an ordering app for a packaged-goods distributor in Jabalpur, India. It serves about 1,800 small grocery shops ("kirana" stores) for four fictional brands:

- **Rewa Foods**: biscuits and snacks
- **Kanha Chai**: tea
- **Bhedaghat Masale**: spices
- **Sitara Home Care**: detergents and cleaners

It has three kinds of user:

1. **Shopkeepers (retailers).** They order on cheap Android phones over slow 3G, between customers, often in Hindi. They need to see stock, their own price and the current offer, and order in under a minute.
2. **Salesmen.** They visit shops and take orders on a phone, often with no signal. The app works offline and sends orders when signal returns.
3. **The order desk.** Office staff on a desktop. They review orders, release credit holds, export to Tally (accounting software) and print van loading lists.

The app works today, but it looks plain and generic. Redesign it to feel **polished, warm, trustworthy and minimal**: something a busy shopkeeper enjoys opening. Keep it fast on a ₹7,000 Android phone on 3G.

## Non-negotiable constraints

**Performance**
- First paint under 3 seconds on slow 3G.
- **No new JavaScript libraries.** No animation libraries (Framer Motion, Lottie, GSAP), no icon fonts, no web fonts beyond the system stack, no raster product photos.
- **All motion is CSS only:** animate `transform` and `opacity`, 120–250 ms, `ease-out`. Everything must respect `prefers-reduced-motion` (motion off, instant state change).
- **Product images are inline SVG, at most about 2.5 KB each.** They are built from a few shared shapes and recoloured per brand and category, never one heavy drawing per product.
- The added CSS stays small: one design-token layer plus utilities. Tailwind v4 is in use.

**Readability**
- **Mobile first at 360 px:** no horizontal scroll, tap targets at least 48 px (44 px absolute minimum), thumb-reachable primary actions.
- **Hindi (default) and English.** Devanagari runs about 30% wider and taller than Latin, so layouts must survive long Hindi labels. Numbers use Latin digits with Indian grouping (₹1,16,177.00).
- **Money must be unmistakable.** Every price says whether GST is included: "+ GST" on catalogue prices, "incl. GST" on totals.
- **Contrast:** WCAG AA everywhere. Shopkeepers use phones in bright sunlight, so design light mode first; dark mode is not needed.
- **Nothing on screen without a purpose:** no decorative clutter, no stock photography, no gradients for their own sake.

**Behaviour**
- Keep every existing screen, state and rule. This is a visual redesign, not a feature change.
- Every screen has **loading** (skeleton), **empty** and **error** states.

## Design direction

- **Mood:** clean and calm, like a modern Indian fintech or quick-commerce app, but quieter. Generous white space, clear hierarchy, one confident accent.
- **Palette:** keep a restrained base with one accent. The current accent is teal `#0f766e`; you may refine it but keep the meaning. Semantic colours:
  - green: in stock, free goods, success;
  - amber: low stock, credit hold, needs attention;
  - red: out of stock, errors only;
  - a soft tint of the accent: offers.

  Use brand colours only inside product illustrations, never in the UI chrome.
- **Type:** the system stack with Noto Sans Devanagari. Define a tight scale (for example 12 / 14 / 16 / 20 / 24 / 32). Case price is the biggest element on a product card. Use tabular numerals for money.
- **Shape:** 12–16 px radius on cards, fully rounded steppers and chips, one subtle shadow level for raised elements only (sticky bars, bottom sheets), hairline borders elsewhere.
- **Icons:** a single consistent 24 px stroke icon set, drawn inline: items, order slip, orders, cart, camera, microphone, phone, van, print, download, offline cloud.

## Product illustrations (important)

Design an SVG illustration system so each product **looks like the real pack type it is**, so a shopkeeper recognises it at a glance. Pack shapes in use:

| Shape | Used for |
|---|---|
| `pouch` | tea leaf, spices, namkeen |
| `carton` | detergent powder, tea bags |
| `bottle` | liquid detergent, cleaners, phenyl |
| `packet` | biscuits, chips |
| `box` | cookies, crackers |
| `bag` | large detergent, bulk namkeen |
| `bar` | detergent bar, dishwash bar |

Rules:
- **Recognisable but fictional.** A biscuit packet with a biscuit window, a tea pouch with a leaf, a detergent carton with a bubble swirl, a cleaner bottle with a trigger or cap, a chilli on the red chilli powder pouch, turmeric yellow for haldi. Use fictional brand marks only (Rewa, Kanha, Bhedaghat, Sitara). **Do not imitate real brands' logos, colours or pack designs** (no Parle-G, Surf Excel, Tata Tea look-alikes).
- **Built from parts:** one base path per shape, a brand colour band, a small category motif and a pack-size label area. All at 1:1, rendered at 88 px on mobile and 120 px on desktop.
- **Light shading only:** one highlight and one shadow tone; flat with a little depth.
- Show how the system covers all 38 products. Spell out the full set of motifs: biscuit, cookie, cracker, namkeen, chips, tea leaf, tea bag, masala, turmeric, chilli, coriander, detergent swirl, dishwash, floor, toilet, glass, phenyl.

## Pricing display improvements (must design)

1. **Discounts:** show the original price struck through and the discounted price next to it.
   - **Example:** detergent powder 1 kg is ₹2,030.00 per case, with 3% off at 5 or more cases. At 5 cases the cart line shows ~~₹10,150.00~~ **₹9,845.50**, a small "3% off" chip and "+ GST".
   - **The moment the stepper reaches the threshold**, animate the strike-through (a line drawing across in about 200 ms) and fade in the new price.
   - **On the catalogue card,** once the quantity qualifies, show the per-case price as ~~₹2,030.00~~ **₹1,969.10** / case.
2. **Free goods:** "10 + 1 free" with a "FREE" chip and the value saved ("worth ₹777.60"). When the 10th case is added, the free case gets a small celebratory pop: a scale from 0.8 to 1 plus a tiny confetti of 3–4 dots, CSS only.
3. **Nudge:** "Add 3 more cases → get 1 free" as a tappable pill that adds them. Show progress to the offer, for example a thin progress bar from 7 to 10 cases.
4. **Totals panel:** items before GST, discount (shown as savings, in green), GST by rate, and **Total payable (incl. GST)** in the largest type. Add a "You save ₹X" line when discounts or free goods apply.
5. **Credit:** an available-credit meter (a bar, not just text). When an order would go over the limit, show a clear amber callout with the exact amount over.

## Micro-interactions (subtle, cheap)

- Stepper: the number flips or slides by 4 px when it changes; the + button gets a scale-down press state.
- Add to cart: the cart badge in the bottom nav bumps once.
- Placing an order: the button turns into a spinner, then a check that draws itself; a success screen shows the order number.
- Skeletons: a soft shimmer at most, or a static grey; no heavy animated gradients on long lists.
- Bottom sheets (credit confirmation, replace-or-add cart): slide up 16 px and fade.
- AI capture:
  - while reading: gently pulsing "reading your order…" dots;
  - review cards stagger in 40 ms apart;
  - confidence chips use colour and a short label, never colour alone.
- Salesman offline: when the connection drops, the online/offline banner changes colour with a short slide.
  - Each waiting order shows a small clock icon.
  - When it sends, the clock morphs into a check.

## Screens to design (mobile 360 px and desktop 1280 px)

### Retailer
Mobile: bottom navigation with 4 tabs (सामान Items · पर्ची Order slip · ऑर्डर Orders · कार्ट Cart). Desktop: top bar plus a **two-pane layout**: the catalogue grid on the left and a sticky live cart summary on the right.

1. **Login:** phone number, then 6-digit OTP. A "Demo mode, code 123456" banner. Hindi/English toggle.
2. **Catalogue (Items):**
   - search ("chai patti 250" works) and category chips (Biscuits, Snacks, Tea, Spices, Detergent, Cleaners);
   - product cards with illustration, Hindi name with pack size, case price "+ GST", per-piece price, MRP small, stock badge ("In stock" / "Only 12 cases left" / "Out of stock"), offer chips and the stepper;
   - header showing the shop name and available credit.
   - Desktop: a grid of 3–4 cards per row.
3. **Cart:**
   - lines with illustration, cases and free cases, the struck-through or discounted price, the offer applied, and "also eligible: …" when two offers compete;
   - the nudge, the totals panel and the credit meter;
   - a sticky **Place order · ₹total** button;
   - when free goods don't fit in stock: a two-option chooser ("9 cases + 0 free" vs "10 cases with 3% off");
   - a credit-hold confirmation sheet;
   - an "Order placed" success state.
4. **Orders list:** status chips (Pending review, Credit hold, Approved, Exported, Cancelled), date and total.
5. **Order detail:** frozen lines and totals, status timeline, **Order again**, Cancel / Request cancellation. An "Office changed your order: new total ₹X (was ₹Y)" banner with **Accept changes**.
6. **Order slip (AI capture):** three segmented tabs, Type / Photo / Voice.
   - Type: a large textarea with a character counter.
   - Photo: a camera or choose-photo area with a preview.
   - Voice: a big record button with a 60-second timer and level animation (CSS), playback, and "or choose a voice-note file".
7. **Capture review:**
   - the original words or transcript at the top ("You wrote" / "The photo says" / "The voice note says");
   - a card per line: the retailer's words in quotes, a confidence chip (Sure / Please check / Choose product / Needs your answer), a product picker, two alternative chips, a case stepper, a reason line ("You wrote packets; orders are in cases: 1 case = 96"), and **Looks right** / **Remove**;
   - a sticky footer: "Check every line first (2 left)", then **Add 3 items to cart**;
   - a failure state: "Couldn't read this message", with Try again and Add items myself.

### Salesman (mobile first; a tablet layout is enough for desktop)
8. **Shops:**
   - an online/offline banner and "Prices and stock as of 4:10 pm · Ready offline";
   - the outbox list, with each order's status: Waiting for signal / Sending / Sent · order #96 / Changed: new total ₹X, Accept and send / Stock changed: Edit;
   - shop cards with name, area, credit meter, a "No order in 17 days" flag and a Call button;
   - an "only inactive shops" filter.
9. **Take order at a shop:** a compact catalogue list with the shop's own prices, steppers, the strike-through discount, a sticky total and a **Save order · ₹X** button. When the order is over the credit limit, a confirmation checkbox: "I told the shop: place on hold".

### Order desk (desktop first; must still work at 360 px)
Left sidebar navigation: Queue · Van loading · Inactive 14d · Tally export.

10. **Queue:**
    - filter tabs with counts (Needs action, Credit hold, Awaiting retailer, Approved, Exported, Cancelled);
    - dense but calm rows: order number, shop, total, number of lines, time, and flags such as "From message", "Salesman", "Over by ₹X" and "Cancel requested".
11. **Order detail:**
    - retailer card and live credit card side by side;
    - a lines table with inline case editing and repricing;
    - totals;
    - a decision panel: Approve, Release hold and approve, and Reject with reason;
    - the original message with each line's resolution and a **Save as alias** button;
    - an audit timeline.
12. **Van loading lists:** a date picker and a section per van: total cases per item (paid, free, total) and a numbered drop list per shop. **Print-friendly**: one van per page, no navigation chrome.
13. **No order in 14 days:** a list sorted by days since last order, each row with phone/Call, area, salesman and outstanding amount.
14. **Tally export:** "12 approved orders · ₹1,42,300", an export button, the result message and the batch history with Download CSV.

## What to deliver

1. **Design tokens** as CSS custom properties for a Tailwind v4 `@theme` block: colours, type scale, spacing, radii, shadow, motion durations and easings.
2. A **component sheet** showing every state (default, pressed, disabled, loading, error):
   - button, stepper, chip and badge, price block (normal / discounted / free goods), product card, cart line, totals panel, credit meter;
   - bottom nav, sidebar, segmented tabs, bottom sheet, banner, toast;
   - capture line card, outbox item, table row, skeletons.
3. **All screens above** at 360 px and 1280 px, in Hindi (the primary language). Also show three screens in English to prove the layout handles both.
4. **The SVG illustration set:** the 7 base shapes, the motif set and 6 example products fully composed (glucose biscuit 75 g, tea leaf 250 g, detergent powder 1 kg, floor cleaner 1 L, turmeric 100 g, aloo bhujia 200 g). Include the SVG code, each file at most about 2.5 KB.
5. A **motion spec:** each animation's trigger, property, duration, easing and reduced-motion fallback.
6. **Performance notes:** confirm the design needs no new JS dependencies and estimate the added CSS size.

Keep it minimal and premium, but practical. A shopkeeper should find the price, the offer and the total within two seconds of looking.
