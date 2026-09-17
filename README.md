# Xanh Arcade — foundation v0.1

Vietnamese game hub with a responsive layout, game categories, search, local favorites, and live waiting rooms. The four catalog games are clearly marked as planned and are **not playable yet**.

## Run

Node.js 22 or newer. No third-party dependencies.

```sh
npm start
```

Open http://localhost:3000. Set PORT for another port.

## Render

Create a Node Web Service from this repository. Build command: `npm run check`. Start command: `npm start`. Health check: `/health`. Use one instance: room state is held in memory and resets when the server restarts. This is a foundation prototype, not a persistent account system. Do not enter sensitive information in public room names or nicknames.

## Live foundation

Server-Sent Events synchronize waiting rooms, participants and ready status. Session cookies are HttpOnly and SameSite=Lax; mutations validate Origin; body sizes, request rates, room capacity and session counts are bounded. Inactive sessions expire after two minutes. Source files: `server.mjs`, `index.html`, `style.css`, `app.js`, `favicon.svg`.
