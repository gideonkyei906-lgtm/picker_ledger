# Daily Picks independent collector

Upload this folder's contents to the root of the Cloudflare-connected `picker-ledger` repository. The missing entrypoint is now declared by `wrangler.jsonc` as `src/index.js`. Build/install using npm ci; deploy using npx wrangler deploy.

The daily cron prepares a Durable Object alarm at 05:55 UTC; the alarm starts collection at 06:00 Ghana time. Browser lifetime is limited to eight minutes. The Cloudflare Free browser quota is ten minutes/day shared with all account usage. No paid plan is enabled by this source.

Configure SITE_TOKEN as an encrypted Worker secret for the existing private Daily Picks service. Confirm its validity/lifetime. Configure ADMIN_TOKEN separately for the private /status endpoint. Never put credentials in source, screenshots or chat. SITE_URL is pinned to the existing private ledger origin. Public /health shows configuration status but exposes no records or secrets; there is no public manual trigger.

Each day and scenario is captured once. Missing data, blocked pages, expired access and changed layouts stay explicit failures. No inferred odds, CAPTCHA bypass, proxy, or fabricated empty response. The existing Site's strict minute gate stays active, so late server alarms are reported as missed. No exact-second SLA is promised.

Run npm test and npm run check. Bundling is not live browser validation. After deployment verify /health, authenticated /status and the saved Site readback of the first actual scheduled run. Retire the older chat-based collector only after production validation. Existing score-check automation is separate.

This source has not yet been installed into the user's Cloudflare account. Account access, encrypted secrets, quota compatibility and the first scheduled run still require verification. Do not claim this is deployed solely because a build succeeds.
