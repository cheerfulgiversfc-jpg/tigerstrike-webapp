# tigerstrike-webapp
Telegram Mini App for Tiger Strike: scan regions, engage tiger packs, capture or kill, earn rewards, and track stats.

## Telegram Stars (in-app invoices)
This project now includes a `Stars` tab in the in-game shop, wired to Telegram in-app invoice checkout.

### What was added
- Frontend Stars flow in [`game.js`](game.js):
  - Opens invoices with `Telegram.WebApp.openInvoice(...)`
  - Calls backend to create invoice links
  - Claims/validates completed purchases and grants in-game cash
- Vercel API routes:
  - [`api/stars/create-invoice.js`](api/stars/create-invoice.js)
  - [`api/stars/claim.js`](api/stars/claim.js)

### Required env var
- `TELEGRAM_BOT_TOKEN`

### Important bot requirement
Your bot still must handle payment updates in its webhook/update loop:
- Receive `pre_checkout_query`
- Reply with `answerPreCheckoutQuery` within 10 seconds
- (Recommended) process `successful_payment` for your own accounting/refunds

If your current bot backend already does this, you are good.

### How this flow works
1. Mini App calls `/api/stars/create-invoice` with `initData` + SKU.
2. Backend validates `initData`, creates Telegram invoice link (`XTR`), returns link.
3. Mini App opens invoice in-app (`openInvoice`).
4. Mini App calls `/api/stars/claim`.
5. Backend validates `initData`, checks bot Star transactions for matching `invoice_payload`, then returns the grant.
6. Game applies grant to `S.funds`.

### Notes
- Offers are defined in both frontend and backend:
  - [`game.js`](game.js)
  - [`api/_lib/stars-catalog.js`](api/_lib/stars-catalog.js)
- Keep them in sync when changing prices or rewards.
- The `/api/stars/claim` route scans recent Star transactions (up to 800 records) for matching `invoice_payload`.
- Device-side duplicate protection is local (`localStorage`). For strict anti-fraud, move claiming/idempotency to a persistent DB on your bot backend.
