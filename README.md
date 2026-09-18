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
