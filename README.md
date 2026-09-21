# Xanh Arcade — Gaming Edition 2.0

Vietnamese gaming hub built for Xanh, with original cinematic artwork, a charcoal/copper interface, playable arcade games and server-authoritative online caro.

## Games

- **Robot phiêu lưu:** jump over stone obstacles, collect coins, accelerating difficulty, locally stored best score, keyboard and touch.
- **Phá gạch quỹ đạo:** mouse, touch or keyboard paddle; 3 lives, 3 stages, durable bricks, collision particles and local best score.
- **Cờ caro:** local two-player or online. 15 × 15 board; five or more consecutive stones wins, including blocked ends. First two room members play X/O; up to six spectators. Both players ready, host starts. Server validates every move; a departing player aborts the match.
- **Cờ vua:** artwork and catalog entry only, clearly marked upcoming.

Sound effects are synthesized locally with Web Audio after the sound button is enabled. Sound defaults to off; games pause when the page loses focus. There is no third-party music.

## Run and verify

Requires Node.js 22 or newer. No third-party dependencies.

```sh
npm run check
node test.mjs
npm start
```

Open http://localhost:3000. Set PORT to override the port. The integration test uses port 3187 and stops its server on completion.

## Render

Existing service: https://xanh-arcade.onrender.com/

Build: `npm run check`. Start: `npm start`. Health: `/health` (version 2.0.0).
Use one instance: rooms and matches are in memory and reset on server restart. Sessions expire after two minutes offline. No accounts, persistent rankings or cross-device saved scores yet. SSE carries room state; cookies are HttpOnly/SameSite, POSTs validate Origin and rates and body lengths are bounded.

## Artwork catalog

`graphics-manifest.json` lists six optimized WebP images used directly by the site. Original images were created with the built-in image generator. Cover prompts: premium stylized 3D robot explorer in warm ancient mountain ruins; ceramic orbital breakout with Earth; walnut caro in a cozy study; marble chess in a royal library. Background prompts: detailed empty mountain valley and dark orbital observation deck, without game objects. All prompts exclude neon, text, logos and watermarks.

Google Drive folder requested by Xanh: `1GA0XDxvuOaL4453jnQ0YnQ_SHaaMseZS`. Upload was rejected with `insufficientParentPermissions`; no Drive upload is claimed. Runtime images are served with the app and do not depend on Drive permissions.

`so-do.svg` is the updated project diagram. The external Canva design has not been edited because its editing permission was unavailable.

## Xanh Battle — BETA 0.3

`/battle` is an original top-down 2D survival shooter. Three classes, 24 bots that fight each other, cover and projectile collision, shrinking zone, dash/shield/pulse abilities, reloads, medkits, armor, kill-based leveling, pause, sound toggle, minimap and dual touch controls. Single-player only; no online PvP yet. WASD/arrows move, mouse aims and fires, Space dash, Q shield, E pulse, R reload, P pause.

`/shop` is a clearly labeled local beta economy: 300 starting coins, 75 daily coins, 15 per Battle kill and 30 for winning (max150 per match). Six cosmetic items can be purchased/equipped and used in Battle, Runner, Breakout and Caro. Data lives in localStorage, may be modified by the local user, is not authoritative, and is not synced with accounts. No real-money purchases. Clearing browser data loses the save. Account/Supabase integration remains separate unfinished work and is not deployed with this beta.

## Account beta setup (not activated yet)

Routes: `/account` for email signup/login/profile and cloud cosmetics; `/battle` for the shooter. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on Render after provisioning a dedicated project and executing `database/setup.sql`. Never commit credentials. Configure Supabase Auth Site URL as the live website and enable email confirmation; production signup requires an appropriate SMTP configuration. No service-role key is required.

Authentication uses HttpOnly cookies, provider-validated users, origin checks, bounded bodies and rate limiting. Profiles/inventory have owner-only RLS; currency changes use guarded private functions. Email identifies the account; nicknames are display names, not unique login IDs. Battle currently awards guest browser coins, not cloud currency. Guest balances are never imported as trusted money. Cloud equipment takes priority after account lookup. Password recovery and multiplayer Battle are not implemented.

Run `npm test`. Account tests use a mock provider; live signup, email delivery and database policies must be verified after provisioning before announcing accounts as active.


## Battle BETA 0.3 — Thanh Van Island
- 4,800 × 4,800 map (7.1× previous area), nine named districts, original procedural 2D art.
- Plane route, manual J/touch jump, steerable parachute, 24 bots.
- Five weapons, finite ammo, two slots (1/2), F/touch pickup, B backpack, H healing. Full weapon slots replace the active gun and drop it on the ground.
- Bots use A* navigation, line of sight, reaction delay, velocity-leading aim, range-based weapon switching, cover while reloading/low health, loot, medkits and zone rotation. No wall penetration or instant perfect aim.
- Terrain pattern cached; off-camera art culled; bot planning staggered; HUD updates at 10Hz.
- Single player BETA. Accounts still require a configured Supabase project and database/setup.sql. No plaintext-password or temporary-server-file account fallback.
- npm test covers landing, ammunition conservation, inventory, bot lethality, cover/pathfinding, and existing account/shop/caro regressions.


### Hosted account setup (2026-09-20)
Supabase project rclvffhlscuuptpmhiej (Singapore) now has the xa_* tables and RLS. Render has SUPABASE_URL and its public publishable key configured. Transactional live-database checks passed for wallet, duplicate purchases, ownership, daily limits and cross-user isolation. Public email signup is not production-ready until custom SMTP and the Auth Site URL are configured. Default SMTP only sends to organization team addresses. Do not disable confirmation to disguise this limitation.


## Battle BETA 0.3
- Original top-down survival island: 16,000 × 16,000 world units, 9 districts and 24 bots. Not a real-world distance measurement.
- 25-second flight, 18-second parachute descent, slower ground speed, 220–260 HP, reduced weapon damage and temporary landing protection (firing removes it).
- Three difficulty levels control bot damage, aim spread, reaction delay and fire cadence.
- G deploys a destructible 55-second glue wall; V enters/exits nearby vehicles. Vehicles have collision, health and finite fuel. Two gun slots, sniper rifle, supplies and five shrinking-zone phases.
- Full island overview, remappable keyboard controls, local top-20 results (50 retained), difficulty filter. Rankings are device-only and untrusted; they are not an online competitive leaderboard.
- Account backend is connected, but external signup requires configuring custom SMTP and verifying Supabase Auth redirect settings with the project owner's account.


## Fortnite Z — native BETA 01
Separate route `/fortnite-z`, adapted from the user-supplied 78 MB TurboWarp HTML. No embedded source scripts or Scratch VM are run. The original HTML and Drive source are unchanged.

Implemented: original 12×12 map tiles and collision silhouettes, eight selectable original skins, 18 weapon specifications, six weapon slots, finite ammo/reloading, 24 bots, gliding, loot/chests, tree harvesting, wood walls, grenades/rockets, four vehicle types with fuel/health, launchpads, storm, touch controls, pause, synthesized sound, and local rankings.

The native BETA is an adaptation, not a byte-for-byte Scratch conversion: original cloud multiplayer, trailers, emotes, full cosmetic economy and Scratch save codes are not migrated. Source credits remain in FORTNITE-CREDITS.md; original creator FunnyAnimatorJimTV is credited in the game footer.

Fixes: restart resets stale project state; removed tombstone-based unbounded bullet lists; bounded bullets/effects/loot; fixed timestep with capped catch-up; swept projectile collision; air/vehicle loot lockout; collision-safe landing; six-slot ammo conservation; paused-tab input reset; safe DOM display of nicknames; errors/timeouts for loading assets. Static text/SVG/JSON assets use gzip and cache revalidation.


## Multiplayer rooms — BETA 2.5

Open `/rooms?game=battle` or `/rooms?game=fortnite`. Both existing game renderers now support live room matches using server-authoritative simulation (20 Hz), SSE snapshots (10 Hz) and bounded HTTP input (10 Hz). Clients submit only movement, aim and action names; positions, damage, inventory, bot behavior and outcomes are computed by the server. Static artwork remains cached, and nearby loot, bullets and effects are filtered per player.

- Invite by room code/link; 25 total actors. Empty slots become bots at start.
- Solo or squads: six teams of up to four and a final one-slot team, preserving the requested 25 total. Players select teams before starting; bots fill unoccupied positions. Friendly fire, including occupied allied vehicles, is disabled.
- Only the host changes difficulty/mode or starts. Other members must be ready. Difficulty/mode/team/join changes are rejected by the server during a match.
- Host ownership transfers on leaving. A departed player's character becomes a bot. Reconnecting within the 120-second session grace retains the same actor and input sequence. Matches continue when a browser is hidden; controls expire after 600 ms without input.
- Guest nicknames are not registered accounts. Matches/rooms are temporary in-memory state and are lost on restart/deploy. Initial free-instance guardrail: four active matches. This is not a claim of load-tested capacity for 100 concurrent humans. No revive/knockdown system yet.
- `node shooter-test.mjs` tests both games' room permissions, capacity, bot fill, independent input, snapshots, friendly fire and host migration; existing single-player suites remain in `npm test`.
