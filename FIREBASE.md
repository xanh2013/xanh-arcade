> **Hosting hiện tại: Render (quyết định ngày 26/09/2026).** Tiếp tục dùng service `xanh-arcade` tại https://xanh-arcade.onrender.com/ và repository `xanh2013/xanh-arcade`, nhánh `main`. Xanh tự triển khai trên Render; trợ lý cập nhật mã trên GitHub. Hướng dẫn Koyeb/Firebase chỉ lưu để tham khảo, không phải yêu cầu chuyển host. Thay đổi ghi chú này không xác nhận một bản triển khai mới.

# Xanh Arcade — Firebase deployment

Archived migration option: Firebase + Cloud Run. Active hosting target: Render.
Status: preparation only; no Firebase project, billing activation or deployment is confirmed.

## Architecture

Firebase Hosting provides the public entry URL and temporarily redirects visitors to the actual Cloud Run game URL. The address bar changes to the Cloud Run domain. Cloud Run serves the complete existing Node application, including assets, accounts and multiplayer APIs on the same origin.

Do not proxy the existing app through Hosting rewrites: Hosting limits forwarded requests to 60 seconds and removes incoming cookies except `__session`. The current app uses several HttpOnly session cookies and long-lived SSE connections. A simple rewrite would break authentication and interrupt rooms. This preparation intentionally does not claim that the game itself runs on the web.app domain.

Existing Supabase accounts and shop data remain on the same project. This is a hosting migration, not a Firebase Auth/Firestore migration.

## Deploy the game service

1. Select/create the intended Firebase project. Cloud Run requires linked billing (Blaze); review cost and activate billing yourself. Do not paste credentials into source files or chat.
2. In Google Cloud Run for that same project, deploy the repository Dockerfile. Use service name `xanh-arcade`, port `8000`, one region near players (for example Singapore), 1 CPU and 512 MiB RAM as an initial beta configuration, request timeout 3600 seconds, and maximum 1 instance. Choose concurrency with load testing; start with 80. Each open SSE connection consumes request concurrency.
3. Set `NODE_ENV=production`, `SECURE_COOKIES=true`, `MEMORY_LIMIT_MB=512`, and the existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in service environment settings. Preserve any existing `ADMIN_BOOST_ACTIVE` setting. Never put a Supabase service-role key in browser code.
4. Allow public access to the game HTTP service; app-level authentication still protects account/admin APIs. Use the existing Docker start command. Configure HTTP startup check `/health` on port 8000.
5. Copy the exact HTTPS service URL from Cloud Run and verify `/health`, login, shop, and two-browser room play directly on it before publishing Hosting.

Rooms/sessions currently live in process memory. Maximum one instance reduces split-room risk but does not guarantee persistence: deployments, restarts and overlapping revisions can disconnect players. Deploy between matches. Multiple instances require a shared session/match architecture first. Do not market this beta as highly available.

## Publish the Firebase entry URL

Install the official Firebase CLI and log in on your own machine. From the repository root, supply the real project ID and Cloud Run URL:

```sh
node prepare-firebase.mjs YOUR_PROJECT_ID https://YOUR_ACTUAL_SERVICE.run.app
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

The generator writes only a dedicated `firebase-public` folder, `firebase.json` and `.firebaserc`. It never uploads the repository root as public files. No project ID or service URL is guessed. The generated rules use temporary redirects so future hosting changes are not permanently cached.

Update the existing Supabase Site URL/allowed redirects to the actual Cloud Run game origin if email confirmation is enabled. Accounts persist when using the same database, but cookies and browser localStorage do not migrate across domains. Players must sign in again. Old local scores/keymaps may remain only on the old origin.

## Acceptance checks

- Firebase entry opens the real game; room invite paths and query parameters survive navigation.
- Existing account login/logout, shop inventory and admin permissions work on the new origin.
- Two players join the same room, start, and stay connected beyond 60 seconds.
- Reconnection after the Cloud Run request timeout recovers appropriately; test before public release.
- Battle, Fortnite Z and Zombie run; measure actual FPS and RTT on player hardware.
- Review Cloud Run memory, CPU, errors, concurrency and billing usage. Quotas/free allowances are not a promise of zero cost.
- Keep the old service available until the new deployment passes checks.

Official references:
- https://firebase.google.com/docs/hosting/cloud-run
- https://firebase.google.com/docs/hosting/manage-cache
- https://firebase.google.com/docs/hosting/full-config
