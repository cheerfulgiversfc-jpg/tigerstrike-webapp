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

## Bot Phase 2A
Phase 2A adds channel-growth tooling directly in your webhook: admin posting commands, referral links, and referral start tracking.

### New commands (webhook)
- Public:
  - `/ref` - Generates a personal referral link in format `https://t.me/<bot>?start=ref_<userId>`
- Admin-only:
  - `/admin`
  - `/post_play`
  - `/post_stars`
  - `/post_premium`
  - `/post_campaign`

### New environment variables (Phase 2A)
- `TELEGRAM_ADMIN_IDS` (recommended)
  - Comma-separated Telegram user IDs allowed to run admin commands.
  - Example: `123456789,987654321`
- `TELEGRAM_CHANNEL_ID` (recommended for posting)
  - Target channel for `/post_*` commands when command is sent from private chat/group.
  - Use numeric channel id (e.g. `-1001234567890`) or `@channelusername`.
- `TELEGRAM_REF_LOG_CHAT_ID` (optional)
  - If set, referral starts (`/start ref_*`) are logged to this chat/channel for tracking.
- `TELEGRAM_COMMUNITY_CHAT_ID` or `TELEGRAM_GROUP_ID` (optional)
  - Official Tiger Strike group used for Join Group buttons and verified-member referral rewards.
  - Instead of setting an environment variable, a group administrator can run `/setcommunity` once inside the official group.
- `TELEGRAM_COMMUNITY_INVITE_URL` or `TELEGRAM_GROUP_INVITE_URL` (optional)
  - Explicit group invite URL. If omitted, the bot uses the public group username or creates an invite link when it has invite permission.

### Phase 2A usage
1. Add env vars above in Vercel.
2. Redeploy.
3. Re-run setup:
   ```bash
   curl -X POST "https://<your-domain>/api/telegram/setup?key=<TELEGRAM_SETUP_KEY>"
   ```
4. In Telegram (from an admin account in `TELEGRAM_ADMIN_IDS`), run `/admin`.
5. Use `/post_play`, `/post_stars`, `/post_premium`, `/post_campaign` to publish channel posts.
6. In the official Tiger Strike group, run `/setcommunity` once to connect Join Group buttons and membership verification.

### Security notes
- Keep `TELEGRAM_WEBHOOK_SECRET` enabled.
- Keep `TELEGRAM_SETUP_KEY` as a strong secret after setup.
- Never commit bot token/admin secrets into GitHub.

## V5.0 Live Squad Operations

Operation Night Fang is a private two-player Telegram co-op mission:

- The leader creates a six-character squad room and shares a native Telegram invitation.
- The invited player opens the Mini App with `startapp=squad_<CODE>` and joins the same room.
- Both players synchronize movement, roles, health, rescue progress, Alpha damage, revives, connection state, and extraction readiness through `/api/squad/session`.
- The room is capped at two signed Telegram users, expires automatically, and only the leader can start it.
- Rewards use a per-player server receipt so the same mission cannot be claimed twice.

Reliable live rooms require the existing Upstash/Vercel KV environment (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the equivalent `UPSTASH_REDIS_REST_*` variables). Without KV, the development-only in-memory fallback does not persist across serverless instances.

### V5.1 Shared Story Co-op

Live Squad now uses a Story-style shared district instead of the original placeholder arena. Both Telegram players see the same four human civilians, roaming tiger pack, Night Fang Alpha, soldier avatars, extraction zone, shared health/progress, and six-minute mission clock. Action buttons explain whether the player is in range, and the lobby includes a plain four-step guide for two-player play.

### V5.2 Reliable Live Squad Join

- Live Squad invitations discover the public Telegram bot username directly from the Bot API when the deployment variable is missing.
- Manual joining uses a stable six-character code field with a normal letter keyboard, Paste button, and clearer grouped code display.
- Failed join attempts keep the entered code in place so the player can correct it instead of starting over.
- The large lobby code is now a copy button, and invitation sharing falls back to a plain squad-code message if a deep link is unavailable.

### V5.3 Live Squad Control Repair

- Live Squad command buttons now receive direct pointer, touch, and click activation with duplicate-event protection, avoiding Telegram iOS tap loss.
- Each command has its own pending lock, so a slow invitation can no longer freeze roles, copy controls, Start Mission, or Leave Squad.
- A, S, D, and W movement shortcuts are ignored while the squad-code input is focused, allowing every valid code character to be typed.
- Role selection highlights immediately, Leave Squad closes immediately, and Start Mission gives visible `1/2` guidance instead of behaving like a dead disabled button.

### V5.4 Co-op Field Lives

- Each player starts Operation Night Fang with one personal field life. The first knockout automatically returns that player to Base Camp after three seconds with full health.
- After a player spends that field life, the teammate can still revive them normally. If both players are down and out of lives, the mission becomes a clear Squad Wipe instead of getting stuck.
- The squad leader receives a Restart Mission button. Restart restores both players, both field lives, all civilians, all tiger health, extraction progress, and the six-minute clock without requiring a new room code.
- The shared battlefield is now a larger 1200×1100 Story-style district with more terrain, buildings, roads, trees, a river crossing, Base Camp, Medical Post, and clearer mission landmarks.
- The recovery, wipe, restart, and post-restart completion paths are server-authoritative so both phones see the same result.

## Bot Phase 3B + 3C
Phase 3B adds conversion analytics. Phase 3C adds scheduled LiveOps campaign posts.

### Phase 3B (analytics)
Tracked metrics include:
- invoice creation success/error
- claim paid/pending/error
- pre-checkout confirmations
- successful payment updates
- liveops post counts

Admin commands:
- `/stats_today` - same-day funnel snapshot
- `/stats_7d` - 7-day funnel snapshot

Storage mode:
- If Vercel KV/Upstash is connected (`KV_REST_API_URL` + `KV_REST_API_TOKEN`), stats persist across deploys.
- Otherwise, stats use in-memory fallback (temporary, not durable across cold starts).

### Phase 3C (liveops automation)
Added endpoint:
- `GET/POST /api/telegram/liveops-cron`

Behavior:
- Posts one rotating campaign template per day to `TELEGRAM_CHANNEL_ID`
- Rotation order: campaign -> premium -> stars -> play
- Skips if already posted that UTC day
- Manual admin trigger via `/liveops_now`

### New env vars for Phase 3B/3C
- `TELEGRAM_LIVEOPS_KEY` (recommended)
  - Secret for calling `/api/telegram/liveops-cron` manually.
- `CRON_SECRET` (recommended for Vercel Cron)
  - Vercel sends this as `Authorization: Bearer ...` on cron requests.
- `KV_REST_API_URL` (optional, recommended for persistent stats)
- `KV_REST_API_TOKEN` (optional, recommended for persistent stats)

### Vercel cron
`vercel.json` now schedules:
- `/api/telegram/liveops-cron` at `0 16 * * *` (daily)

### Deploy checklist (Phase 3B/3C)
1. Upload changed files.
2. Add new env vars in Vercel.
3. Redeploy.
4. Re-run setup endpoint:
   ```bash
   curl -X POST "https://<your-domain>/api/telegram/setup?key=<TELEGRAM_SETUP_KEY>"
   ```
5. Test in Telegram:
   - `/stats_today`
   - `/liveops_now`
