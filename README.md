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

### V5.5 Flexible Shared Story

- The World Map now gives a clear Solo or Two Player choice for Story Mission 1. Solo remains the safe default, while the two-player route opens a private Shared Story squad.
- Shared Story is protected by a feature switch and limited to the Mission 1 pilot so later Story progress and old saves remain untouched while the shared campaign is expanded one mission at a time.
- Solo Story on phones now uses the brighter co-op district look: green terrain, clearer roads, real houses, richer trees, and the same visual language as the shared map.
- A held touch joystick is no longer mistaken for abandoned input. Stability recovery preserves a real finger hold, slow-frame motion compensation is stronger, and player unstick recovery reacts sooner.
- Decorative ground ovals were removed from Story and co-op tigers while combat telegraphs remain intact.

### V5.6 Real Shared Story

- Corrects the V5.5 wording and behavior: Story Mission 1 Two Player no longer launches the fixed Operation Night Fang mission. It creates a Story Mission 1 room with the Story objective, two required villager escorts, two Story tigers, shared extraction, and Story Mission 2 unlock on completion for each claimant.
- The private room screen is labeled `Story Mission 1 — Two Player`; it is the required invite/join lobby, not the separate Night Fang operation.
- Story rendering now calls the same bright district foundation used by the shared mission on phones and larger screens: the same green palette, cross roads, river, bridge, houses, and trees. Larger Story worlds repeat that fixed-size district instead of stretching its buildings. The dull cinematic tint, weather wash, and grading overlays are skipped on this renderer.
- This update makes Mission 1 the real shared-Story pilot. Missions 2–100 remain Solo until their exact objectives and progression are converted; the interface does not claim they are already co-op.

### V5.7 Co-op Home + Auto Resume

- Live Squad is the single multiplayer home. Its opening screen lets players choose the real two-player Story Mission 1 or the original Operation Night Fang before creating a room.
- The World Map teammate button opens Story Mission 1 inside that same Live Squad home. It no longer changes the main game into Story gameplay or deploys a hidden Solo mission behind the co-op screen.
- Claiming a completed co-op reward returns that player to the Live Squad mission menu. Leaving a squad also returns to that menu, while Close returns to Base HQ instead of resuming a hidden field mission.
- Each Telegram player stores only their current six-character room reference locally. Reopening Tiger Strike automatically checks that room and restores its waiting, active, failed, or completed state if the server room is still valid; expired rooms are cleared safely.
- Story Missions 2–100 remain Solo. This release does not claim that later missions have already been converted.

### V5.8 Shared Story 1–5 + Mission Clarity

- Live Squad now offers Story Missions 1–5. Each mission keeps a separate title, civilian requirement, tiger set, completion receipt, reward, and next-mission unlock for both players.
- Mission 1 gameplay is unchanged. Missions 2–5 add Farm Road Rescue, First Tiger Encounter, Jungle Hut Rescue, and Jungle Trail Escort. Missions 6–100 remain Solo until their shared objectives are converted and tested.
- Solo Story's bright district roads now keep yellow center dashes and white edge lines even when a phone switches to the lightweight renderer.
- The invisible-wall bug is fixed by removing legacy landmark collision from the bright Shared Story district. Closed route gates remain real blockers; decorative scenery no longer blocks movement from an unseen layout.
- Mission 72 is now a curated five-civilian/six-tiger ambush with live `NEXT` instructions that say whether to rescue, clear remaining tigers, or enter extraction. The same live next-step wording is shown across every Solo Story mission.
- Tapping a named map location now has a result: distant locations become navigation targets, while nearby locations rally waiting civilians and expose nearby threats. Existing alarms, barriers, caches, bridges, vehicles, generators, gates, and route traps retain their gameplay effects.

### V5.9 Live Squad Gear Access

- Shop and Inventory are now directly available from the Live Squad mission picker, waiting room, active shared mission, and end-state screen.
- Opening either gear screen during an active mission creates a synchronized squad pause. The shared mission clock, tiger movement, hazard damage, player movement, and field-life respawn timer stop for both players.
- If both players open gear screens, the mission remains paused until both have returned. The co-op screen identifies who has Shop or Inventory open.
- A disconnected player cannot trap the room in pause forever: an abandoned gear pause clears automatically after the player has been offline for 30 seconds.
- Purchases, equipment choices, and inventory changes use the existing Tiger Strike profile and save normally. Co-op combat balance remains role-based.

### V6.0 Expanded Co-op Worlds

- Live Squad no longer displays the full fixed 1,200 × 1,100 arena at once. Shared Story Mission 1 starts at 3,840 × 2,160, and Missions 2–5 grow progressively larger up to 4,416 × 2,480.
- Each phone now follows its own soldier with an independent smooth camera, so teammates can explore different parts of the same synchronized world.
- The expanded district adds multiple marked roads, bridges, river routes, houses, trees, a world boundary, and Story-style travel spacing without reintroducing invisible decorative collision.
- A live minimap shows both players, civilians, active tigers, extraction, roads, and the current camera area. An edge arrow shows the direction and distance to an off-screen teammate.
- Civilians, tigers, player spawns, and extraction are scaled across the larger mission space while mission completion, reconnecting, field lives, restart, rewards, Shop, Inventory, and synchronized pause keep their existing server rules.

### V6.1 Co-op Campaign Paths

- Live Squad now opens into two honest, separate paths: `Story Campaign` and `Special Operations`.
- Story Campaign lets the player select a mission and then choose Solo or Two Players. Solo keeps every unlocked Story mission available; Two Player is accurately marked ready for converted Story Missions 1–5.
- Operation Night Fang now lives under Special Operations. Its badge and payout stay separate and never skip, replace, or unlock Story progress.
- A squad code can be entered from either path and automatically restores the correct mission type. Existing reconnect, revive, restart, synchronized Shop/Inventory pause, reward dedupe, cameras, minimap, and expanded worlds remain intact.
- Future operations are shown only as a roadmap preview; they are not presented as working buttons until their real gameplay is built.

### V6.2 Tiger Den Assault

- Tiger Den Assault is the second fully playable Special Operation, with its own durable room identity instead of reusing the Night Fang mission.
- The Cave Wilds operation uses a 4,560 × 2,560 rocky den map, an eight-minute mission timer, two trapped field specialists, three den guards, and the new 1,600 HP Stoneclaw Alpha boss.
- Both players must rescue the specialists, defeat or capture every tiger, and reach extraction together. Existing reconnect, field lives, revives, squad-wipe restart, Shop, Inventory, and synchronized pause rules work unchanged.
- Tiger Den invitations name the correct mission and objectives. Each player receives a separate deduplicated receipt, $8,200, two perk points, 16 season points, and the `Stoneclaw Den Breaker` badge.
- Tiger Den completion never advances Story progress and does not alter Operation Night Fang rewards or rooms.

### V6.3 Village Siege

- Village Siege is the third fully playable Special Operation and has its own durable `village-siege` room identity, invitation, mission state, reward receipt, and reconnect path.
- The bright 4,680 × 2,640 Suncrest Village battlefield uses marked roads, homes, a central safehouse, village barricades, and a nine-minute mission timer.
- Both players must rescue five named villagers, clear four siege tigers, defeat or capture the 1,800 HP Ironmane Alpha, and reach extraction together.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, and synchronized pause rules work unchanged.
- Each player receives a separate deduplicated receipt, $9,600, two perk points, 20 season points, and the `Suncrest Village Shield` badge. Village Siege does not advance Story progress or alter Night Fang and Tiger Den rooms.

### V6.4 Convoy Rescue

- Convoy Rescue is the fourth fully playable Special Operation and has its own durable `convoy-rescue` room identity, Telegram invitation, reconnect path, mission state, and reward receipt.
- The 4,800 × 2,720 Redwood Convoy Route is the widest supported co-op battlefield and includes marked highways, bridges, convoy trucks, wreckage, route checkpoints, trees, and roadside buildings.
- Both players must rescue the stranded driver, medic, mechanic, and dispatcher, clear four ambush tigers, defeat or capture the 2,000 HP Roadclaw Alpha, and reach extraction together within ten minutes.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, and synchronized pause behavior work unchanged.
- Each player receives a separate deduplicated receipt, $11,200, three perk points, 24 season points, and the `Redwood Convoy Guardian` badge. Convoy Rescue does not advance Story progress or alter the first three Special Operations.

### V6.5 Alpha Hunt

- Alpha Hunt is the fifth fully playable Special Operation and has its own durable `alpha-hunt` room identity, Telegram invitation, reconnect path, mission state, and reward receipt.
- The 4,800 × 2,800 Moonshadow Highlands uses the full supported co-op world, with moonlit terrain, mountain peaks, marked roads, sparse ranger buildings, and Ghoststripe's hunting range.
- Both players must rescue two injured trackers, clear three elite tigers, defeat or capture the 2,300 HP Ghoststripe Alpha, and reach extraction together within eleven minutes.
- Ghoststripe has a unique pale coat and dark stripes. The old decorative oval surrounding Alpha tigers has been removed while health bars and boss names remain visible.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, and synchronized pause behavior work unchanged.
- Each player receives a separate deduplicated receipt, $13,000, three perk points, 28 season points, and the `Ghoststripe Apex Hunter` badge. Alpha Hunt does not advance Story progress or alter the first four Special Operations.

### V6.6 Storm Extraction

- Storm Extraction is the sixth fully playable Special Operation and has its own durable `storm-extraction` room identity, Telegram invitation, reconnect path, mission state, and reward receipt.
- The 4,800 × 2,800 Tempest Coast uses the full supported co-op world with severe rain, lightning flashes, flooded ground, storm shelters, marked roads, bridges, and a dedicated helicopter extraction pad.
- Both players must rescue the stranded evacuation pilot, rescue engineer, and weather officer, clear four storm-pack tigers, defeat or capture the 2,600 HP Tempest Alpha, and reach storm extraction within twelve minutes.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, and synchronized pause behavior work unchanged.
- Each player receives a separate deduplicated receipt, $15,000, four perk points, 32 season points, and the `Tempest Coast Lifeline` badge. Storm Extraction does not advance Story progress or alter the first five Special Operations.

### V6.7 Endless Survival

- Endless Survival is the seventh fully playable Special Operation and has its own durable `endless-survival` room identity, Telegram invitation, reconnect path, wave state, and deduplicated reward receipt.
- The 4,800 × 2,800 Last Stand Basin uses the full supported co-op world with marked roads, a fortified survival ring, defensive outposts, rally camp, and a reward extraction zone.
- Each wave contains three tigers and the Relentless Alpha. Enemy health rises by 22% every wave, and the squad receives a twelve-second regroup period after each clear.
- After clearing Wave 3, both players may enter extraction to bank $13,500, two perk points, 22 season points, and the `Last Stand Survivor` badge. Staying for later waves increases cash by $2,500 and season points by four per wave, with an additional perk point every three waves.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, and synchronized pause behavior work unchanged. Restart returns the squad to Wave 1, and Endless Survival never advances Story progress.

### V6.8 Shared Story Missions 6–10

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–10. Solo remains available for every unlocked Story mission; Missions 11–100 remain accurately labeled Solo-only until their co-op versions are built.
- Mission 6 is the Tall Grass Ambush with three hidden-grass tigers. Mission 7 escorts one injured villager through a two-tiger attack. Mission 8 requires weakening and capturing the research tiger. Mission 9 defends the village gate from four tigers. Mission 10 ends Chapter 1 against the 1,000 HP Village Alpha.
- Missions 6–10 use expanded 4,500–4,740 × 2,520–2,680 Story districts with mission-specific tall grass, field clinic, research beacon, village-gate barricades, and Alpha territory details.
- Both players must complete the mission and enter extraction together. Each receives a separate, deduplicated reward receipt and unlocks the next Story mission independently; Mission 10 unlocks Mission 11 for each player.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, synchronized pause behavior, Solo Story progress, and all seven Special Operations remain unchanged.

### V6.9 Shared Story Chapter 2

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–20. Solo remains available for every unlocked Story mission; Missions 21–100 remain accurately labeled Solo-only until their co-op versions are built.
- Missions 11–20 follow the existing `Blood in the Jungle` campaign: Narrow Path Escort, Blood Aggression, Double Research Capture, Protect Doctor Amara, Caravan Ambush, Forest Escort, Village Children Rescue, Aggressive Pack Capture, High-Aggression Swarm, and the Blood Tiger boss.
- All Chapter 2 missions use the full 4,800 × 2,800 co-op world with mission-specific escort paths, blood-aggression warnings, research capture zones, clinic protection, caravan wrecks, forest routes, village search areas, swarm territory, marked roads, buildings, and Blood Tiger territory.
- Mission 12 has a functional consequence system: every tiger killed adds two close-range damage to the surviving pack, while captures do not raise aggression. Mission 18 begins with an aggressive-pack damage bonus. Mission 19 has nine tigers, a four-damage bonus, and a faster attack interval.
- Mission 13 and Mission 18 each require two real captures and cannot be completed by simply defeating every tiger. Mission 20's 1,800 HP Blood Tiger enters Blood Rage below 35% health, attacks faster, and adds six more close-range damage.
- Rescued civilians now remain visible and follow the player who reached them until extraction. Doctor Amara and all four village children are mandatory mission targets rather than decorative map objects.
- Missions 11, 15, and 16 use sequential shared route checkpoints that both players must reach. Mission 15's protected caravan advances to each saved route point, and a field-life respawn or squad-wipe restart returns the team to its latest checkpoint without deleting the saved escort progress.
- Both players complete and extract together, receive separate deduplicated reward receipts, and unlock the next Story mission independently. Mission 20 awards the `Blood Tiger Breakers` badge and unlocks Mission 21 for each player.
- Existing field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, synchronized pause behavior, Solo Story progress, Missions 1–10, and all seven Special Operations remain unchanged.

### V7.0 Real Extraction Endings

- River Extraction now uses the same visible river geometry as the bright Story map. The boat, pickup circle, civilian boarding point, and soldier pickup are placed in water with a shore-accessible boarding radius; a boat route can no longer silently relocate onto a road.
- Helicopter extractions show a real helicopter, board the soldier, and use a longer lift-off and fly-away sequence before the mission result appears.
- Convoy, SUV, bus, and plane extractions use Story road lanes and visibly drive or taxi away. Boats travel along the river rather than across land.
- Evacuated civilians board the named transport and disappear from the ground when it departs. The final soldier is also removed from the ground and shown as a cyan passenger inside the departing transport.
- Generic safe-house artwork is suppressed whenever a named transport is active, preventing a safe-house marker from appearing under a boat, helicopter, or vehicle.

### V8.1 Shared Story Chapter 3

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–30. Solo remains available for every unlocked mission; Missions 31–100 remain accurately labeled Solo-only until their co-op versions are built.
- Missions 21–30 follow the existing `The Deep Jungle` campaign: Research Team Escort, Tall Grass Predators, Veil Tiger Capture, River Trail Escort, Jungle Bridge Ambush, Lost Hunter Rescue, Abandoned Camp Escort, Large Pack Attack, Helicopter Evacuation, and the Stealth Tiger boss.
- Every Chapter 3 mission uses the full 4,800 × 2,800 co-op world and has its own objective population, tiger pack, time limit, danger tuning, and mission-specific map landmarks.
- Mission 23 requires the named Veil Tiger to be captured alive. Capturing another tiger cannot satisfy the objective, and a Real-ammo hit still permanently blocks that tiger from capture for the current run.
- Escort missions use shared route checkpoints that both players must reach. Mission 29 requires all seven civilians and ends at a clearly marked helicopter extraction zone.
- Mission 28 contains eight coordinated tigers. Mission 30 ends Chapter 3 against the 2,200 HP Stealth Tiger boss using Stalker behavior.
- Each player completes, claims a separate deduplicated reward, and unlocks the next Story mission independently. Mission 30 awards the `Stealth Tiger Breakers` badge and unlocks Mission 31.
- Field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, synchronized pause, Real/Rubber ammunition, persistent bodies and cages, government audits, Solo Story progress, Missions 1–20, and all seven Special Operations remain available.

### V8.2 Shared Story Chapter 4

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–40. Solo remains available for every unlocked mission; Missions 41–100 remain accurately labeled Solo-only until their co-op versions are built.
- Missions 31–40 follow the existing `Abandoned Villages` campaign: Abandoned Home Search, Village Street Patrol, Survivor Safe Route, Triple Research Capture, Evacuation Convoy Ambush, Doctor Imani's Samples, Burning Village Rescue, Town Center Swarm, Massive Village Pack, and the Twin Alpha boss fight.
- Mission 31 has four shared home-search checkpoints that can be completed before the survivors begin following. Both players must inspect every home and rescue all four survivors.
- Mission 34 requires three real live captures. Real-ammo hits still permanently disqualify the struck tiger from capture during that run.
- Mission 35 advances a visible evacuation convoy through three shared checkpoints. Mission 36 protects Doctor Imani while both players secure three sample sites.
- Mission 37 adds four server-authoritative fire zones. Entering a burning zone deals eight damage every 1.4 seconds; the marked route lets players avoid the flames.
- Mission 38 contains a ten-tiger town-center swarm. Mission 39 contains a massive twelve-tiger pack.
- Mission 40 contains two separate 1,850 HP Alpha bosses: Ashclaw and Ruinstripe. The HUD switches to the surviving twin when one falls, and that survivor gains three additional damage.
- Both players claim separate deduplicated rewards and unlock the next mission independently. Mission 40 awards the `Twin Alpha Breakers` badge and unlocks Mission 41.
- Existing Solo Story progress, Missions 1–30, all seven Special Operations, field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, ammunition modes, cages, bodies, and government systems remain available.

### V8.3 Shared Story Chapter 5

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–50. Solo remains available for every unlocked mission; Missions 51–100 are accurately labeled Solo-only until their co-op versions are built.
- Missions 41–50 follow the existing `River Territory` campaign: Broken Bridge Escort, Riverbank Attack, River Tiger Capture, Wounded Water Escort, River Crossing Ambush, River Supply Convoy, River Camp Escort, Rescue Boat Defense, River Delta Pack, and the Giant River Tiger boss.
- River channels are actual visible map areas and slow soldiers who enter them. Each mission uses a safe bridge, shallow crossing, or marked route so the water never creates an invisible blocker.
- Mission 41 requires six civilians and both soldiers to cross three broken-bridge checkpoints. Mission 44 escorts one wounded VIP through three water safety points.
- Mission 43 requires the named Currentstripe River Tiger to be captured alive. Real-ammo hits still permanently disqualify it from capture during that run.
- Missions 46 and 47 add shared convoy and river-camp routes. Mission 48 places the extraction zone in the water beside a visible rescue boat after the four-person crew and all seven threats are secured.
- Mission 49 contains an eleven-tiger river-delta pack. Mission 50 contains the 2,850 HP Giant River Tiger boss with a low-health River Rage phase.
- Both players claim separate deduplicated rewards and unlock the next mission independently. Mission 50 awards the `Giant River Tiger Breakers` badge and unlocks Mission 51.
- Existing Solo Story progress, Missions 1–40, all seven Special Operations, field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, ammunition modes, cages, bodies, and government systems remain available.

### V8.4 Shared Story Chapter 6

- Story Campaign now offers a real Solo or Two Players choice for Missions 1–60. Solo remains available for every unlocked mission; Missions 61–100 are accurately labeled Solo-only until their co-op versions are built.
- Missions 51–60 follow the existing `Mountain Edge` campaign: Mountain Village Escort, Cliffside Attack, Silverpeak Capture, Climber Rescue, Mountain Road Pack, Canyon Caravan, Whiteout Patrol, Mountain Air Rescue, Mountain Swarm, and the Mountain Alpha boss.
- Missions 51, 54, 55, and 56 use ordered shared ridge, descent, road, and canyon checkpoints that both soldiers must secure.
- Mission 53 requires the named Silverpeak Mountain Tiger to be captured alive. Real-ammo hits still permanently disqualify it from capture during that run.
- Mission 57 adds an actual snowstorm overlay that cuts map visibility to 22 percent until both players clear the seven hidden tigers and activate all three visibility beacons.
- Mission 58 protects a five-person rescue crew and shows two rescue helicopters at the mountain landing zone. Both soldiers must board the helicopter extraction after the LZ is secure.
- Mission 59 contains a highly aggressive twelve-tiger mountain swarm. Mission 60 contains the 3,200 HP Mountain Alpha Tiger with a low-health Summit Rage phase.
- Both players claim separate deduplicated rewards and unlock the next mission independently. Mission 60 awards the `Mountain Alpha Breakers` badge and unlocks Mission 61.
- Existing Solo Story progress, Missions 1–50, all seven Special Operations, field lives, teammate revives, squad-wipe restart, reconnect, Shop, Inventory, ammunition modes, cages, bodies, and government systems remain available.

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
