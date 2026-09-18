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

## Xanh Battle — BETA 0.1

`/battle` is an original top-down 2D survival shooter. Three classes, 8 bots that fight each other, cover and projectile collision, shrinking zone, dash/shield/pulse abilities, reloads, medkits, armor, kill-based leveling, pause, sound toggle, minimap and dual touch controls. Single-player only; no online PvP yet. WASD/arrows move, mouse aims and fires, Space dash, Q shield, E pulse, R reload, P pause.

`/shop` is a clearly labeled local beta economy: 300 starting coins, 75 daily coins, 15 per Battle kill and 30 for winning (max150 per match). Six cosmetic items can be purchased/equipped and used in Battle, Runner, Breakout and Caro. Data lives in localStorage, may be modified by the local user, is not authoritative, and is not synced with accounts. No real-money purchases. Clearing browser data loses the save. Account/Supabase integration remains separate unfinished work and is not deployed with this beta.

## Account beta setup (not activated yet)

Routes: `/account` for email signup/login/profile and cloud cosmetics; `/battle` for the shooter. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on Render after provisioning a dedicated project and executing `database/setup.sql`. Never commit credentials. Configure Supabase Auth Site URL as the live website and enable email confirmation; production signup requires an appropriate SMTP configuration. No service-role key is required.

Authentication uses HttpOnly cookies, provider-validated users, origin checks, bounded bodies and rate limiting. Profiles/inventory have owner-only RLS; currency changes use guarded private functions. Email identifies the account; nicknames are display names, not unique login IDs. Battle currently awards guest browser coins, not cloud currency. Guest balances are never imported as trusted money. Cloud equipment takes priority after account lookup. Password recovery and multiplayer Battle are not implemented.

Run `npm test`. Account tests use a mock provider; live signup, email delivery and database policies must be verified after provisioning before announcing accounts as active.
