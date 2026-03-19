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

## Stars payout checklist (how you get paid)
Use this checklist whenever you want to withdraw earnings from your bot's Stars revenue.

### 1) Confirm what counts as earnings
- You earn when users pay your bot invoice in `XTR` (Telegram Stars).
- Users simply buying Stars for themselves does **not** pay you until they spend those Stars on your bot.

### 2) Confirm live payment setup is healthy
- `TELEGRAM_BOT_TOKEN` is set in production.
- Webhook can answer `pre_checkout_query` within 10 seconds.
- Invoices are created with `currency: "XTR"` and empty `provider_token` for digital goods.
- You only grant rewards after successful verification (`/api/stars/claim` paid status).

### 3) Check balance and withdrawable amount
- Open your bot/channel profile in Telegram.
- Go to the Monetization/Balance section.
- Check:
  - `Total balance` (all earned Stars)
  - `Available balance` (Stars currently withdrawable)
  - `withdrawal_enabled` status
- If available balance is low, wait for more revenue to clear into withdrawable balance.

### 4) Withdraw to TON wallet (Fragment)
- Start withdrawal from Telegram Monetization/Balance.
- Telegram opens a Fragment withdrawal page.
- Enter/select your TON wallet address.
- Confirm withdrawal.

### 5) Common blockers
- Not the bot owner account.
- Telegram 2FA password not set/confirmed.
- Withdrawals not enabled yet for the account.
- Available balance below Telegram minimum withdrawal amount.
- Revenue still in pending/hold period before becoming withdrawable.

### 6) Ops best practices
- Keep `game.js` and `api/_lib/stars-catalog.js` prices in sync.
- Keep a small manual test purchase SKU for production health checks.
- Keep `telegram_payment_charge_id` / transaction IDs for refunds and support.
- Never commit bot tokens or secrets to GitHub.

### Official references
- Telegram Stars API: <https://core.telegram.org/api/stars>
- Bot payments with Stars: <https://core.telegram.org/bots/payments-stars>

## Bot Phase 1 foundation
Phase 1 adds command/menu/webhook scaffolding so your bot can reliably handle the core Telegram bot interactions.

### Added endpoints
- [`api/telegram/webhook.js`](api/telegram/webhook.js)
  - Handles:
    - `pre_checkout_query` (required for payments)
    - `successful_payment` (ack)
    - commands from `message`, `channel_post`, and `business_message`
    - `callback_query` button actions
    - `inline_query` responses
- [`api/telegram/setup.js`](api/telegram/setup.js)
  - One-call setup for:
    - webhook
    - bot command list (private + group scopes)
    - chat menu button (Web App if configured)

### Supported commands
- `/start`
- `/help`
- `/settings`
- `/play`
- `/stars`
- `/status`

### New environment variables
- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_WEBHOOK_SECRET` (recommended)
- `TELEGRAM_MINI_APP_URL` (recommended for menu + launch buttons)
- `TELEGRAM_SETUP_KEY` (recommended to protect setup endpoint)
- `TELEGRAM_WEBHOOK_URL` (optional override if host auto-detect is not correct)

### Configure bot (Phase 1)
After deploy, call setup endpoint once:

```bash
curl -X POST "https://<your-domain>/api/telegram/setup?key=<TELEGRAM_SETUP_KEY>"
```

If `TELEGRAM_SETUP_KEY` is not set, the endpoint still works, but setting a key is strongly recommended.

### BotFather toggles to verify
- Enable Inline Mode for the bot.
- Set Main Mini App for the bot.
- Confirm Menu Button points to your Mini App (or commands).

### Notes
- The setup endpoint can be safely re-run after env changes.
- Payments still require your webhook to keep answering `pre_checkout_query` within 10 seconds.
