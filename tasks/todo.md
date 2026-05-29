# Current Task

- [x] Remove the full-width mac desktop bar and restore the base layout.
- [x] Add a thin mac-only sidebar strip with small back/forward buttons that pushes sidebar content below the traffic lights.
- [x] Rerun lint/typecheck/tests, restart the desktop app, and confirm the updated build is served.

## Notes

- The mac desktop treatment should live inside the left navigation area only.
- The strip should be compact, around 40px tall, with small back and forward buttons.

## Result

- Replaced the full-width mac chrome with a sidebar-only `h-10` strip above the sidebar header.
- Rebuilt `apps/web/dist`, restaged the desktop runtime, and restarted the Electron app.

## Current Task

- [x] Add graceful desktop shutdown so the local Bun API closes PGlite cleanly before Electron exits.
- [x] Verify the desktop/API shutdown path with targeted lint/typecheck and a persistence sanity check.

## Result

- Added an explicit child-runtime shutdown handshake so Electron asks the local API to close PGlite before falling back to `SIGTERM` or `SIGKILL`.
- Verified the flow with a spawned Bun API process using a temp PGlite dir: saved a connection, shut down via stdin, restarted on the same dir, and confirmed the connection persisted.

## Current Task

- [x] Make the Electron desktop app identify as `Durabull` instead of `Electron` on macOS launch.
- [x] Verify the desktop package metadata/build still works after the branding fix.

## Result

- Added top-level `productName: "Durabull"` to `apps/desktop/package.json` so Electron's runtime app metadata can use the branded name during `electron .` launches, not just packaged builds.
- Revalidated the desktop package with `bun run typecheck && bun run build:main`.

## Current Task

- [x] Replace the macOS desktop dev launcher so it runs a branded app bundle instead of the stock `Electron.app`.
- [x] Verify the generated dev bundle metadata uses `Durabull` and that the desktop package still builds cleanly.

## Result

- Replaced the macOS desktop `start` flow with `apps/desktop/scripts/start.ts`, which copies Electron's runtime app bundle into `dist/dev-macos/Durabull.app`, rewrites the bundle metadata to `Durabull`, renames the executable, and launches that wrapper.
- Verified the generated `Info.plist` now reports `CFBundleDisplayName`, `CFBundleName`, and `CFBundleExecutable` as `Durabull`, and revalidated the desktop build/typecheck flow.

## Current Task

- [x] Fix the branded macOS dev launcher so the desktop runtime still resolves `dist/bin` and `dist/app-bundle`.
- [x] Revalidate the desktop build after the launcher-path fix.

## Result

- Added an explicit `DURABULL_DESKTOP_RESOURCE_ROOT` override from the macOS launcher and taught the Electron main process to honor it before falling back to packaged `process.resourcesPath`.
- Revalidated the desktop package with `bun run typecheck && bun run build`.

## Current Task

- [x] Add web unit tests covering the Electron/mac desktop chrome pieces (`use-electron-shell`, drag strip, mac sidebar controls).
- [x] Add desktop unit tests around the branded launcher/resource-root behavior that previously regressed startup.
- [x] Run the targeted web and desktop test suites plus lint/typecheck for touched files.

## Result

- Added web unit tests for Electron/mac shell detection, the top drag strip, and the mac sidebar back/forward controls, including custom history-stack behavior and native Navigation API availability.
- Extracted shared desktop launcher helpers and added Bun tests covering the mac app-bundle plist branding plus the resource-root override wiring that previously broke startup.
- Verified with `apps/web` Vitest + typecheck + lint and `apps/desktop` Bun tests + typecheck + lint.

## Current Task

- [x] Add README documentation for building and releasing the macOS desktop app.

## Result

- Expanded `apps/desktop/README.md` with explicit macOS local build, unpacked app-bundle, CI tag-release, and direct `dist:publish` instructions.
- Added a root `README.md` link to the desktop build/release guide so the release docs are easy to find.

## Current Task

- [x] Ensure CI uploads macOS desktop build artifacts to GitHub Release assets on tagged releases.

## Result

- Updated `.github/workflows/desktop-build.yml` so tag builds produce desktop artifacts locally, wait for the matching GitHub Release, and explicitly upload `apps/desktop/release/*` as release assets instead of relying on implicit `electron-builder` publish behavior.
- Aligned `apps/desktop/README.md` with the new CI release-asset upload flow.

## Current Task

- [x] Add docs coverage for desktop installation across macOS, Windows, and Homebrew.
- [x] Update the docs landing page and homepage CTAs/copy to reflect the new platform availability and direct macOS download.
- [x] Verify the docs app with targeted lint and typecheck.

## Result

- Added a dedicated `Desktop Apps` guide with direct macOS and Windows download links, the Homebrew cask command, first-launch verification steps, and release-note links.
- Updated the docs homepage, docs hub, footer, FAQ, and SEO metadata so desktop availability is now clearly represented alongside browser and self-hosted paths.
- Verified the docs app with `bun run lint`, `bun run typecheck`, and `bun run build` in `apps/docs`.

## Current Task

- [x] Audit the alerting implementation on the current branch against `PLAN-ALERTING-SYSTEM.md` and `main`, and document the real gaps.
- [x] Fix backend alerting correctness issues discovered in review, including route-safe alert URLs and stricter rule validation.
- [x] Build a production-grade alerts frontend in `apps/web` with an org-level alert center, a connection-scoped alert workspace, shared hooks/components, and navigation badging.
- [x] Add focused backend and web tests for the alerting flow and validate touched packages with lint, typecheck, and targeted test runs.

## Notes

- The current branch appears to have most backend alerting pieces but no usable web UI, so the feature is not complete until the frontend is wired into the shell.
- The web implementation should match existing Durabull dashboard patterns, not a bolt-on admin screen.

## Result

- Audited `PLAN-ALERTING-SYSTEM.md` against the working tree and confirmed phases 1-6 were mostly present while the frontend was entirely absent, leaving the feature unusable end to end.
- Fixed backend correctness gaps by validating merged rule updates on PATCH, correcting alert email links to the real org-scoped app routes, and adding focused alert evaluator/notifier tests.
- Added a complete alerts experience in `apps/web`: typed alert hooks, org-level alert center, connection-scoped alert workspace with rule CRUD/test/mute/delete flows, shared event/rule UI, sidebar alerts navigation with live badging, and route tree generation for the new pages.
- Validated with `@durabull/web` typecheck, build, and focused unit tests plus `@durabull/api` typecheck, lint, and focused Bun tests. Web lint still reports one unrelated pre-existing warning in `apps/web/src/routes/$orgSlug.c.$connectionId.queues.$queueName.tsx`.

## Current Task

- [x] Replace the alert-rule dialog flow with a dedicated full-page rule builder.
- [x] Redesign the rule authoring UX to be flatter, clearer, and more developer-oriented.
- [x] Add searchable queue multi-select behavior and richer notification routing UX with disabled `coming soon` options.
- [x] Revalidate the web package after the authoring-flow redesign.

## Result

- Replaced the modal-based alert authoring flow with dedicated `alerts/new` and `alerts/$ruleId` pages backed by a shared full-page builder.
- Redesigned the builder into a flatter, more developer-oriented workflow with step-based sections, selected rule-type toggles, queue search + multi-select, clearer inline guidance, and a right-rail summary/tips panel.
- Added multi-queue create behavior that generates one queue-scoped rule per selected queue, plus richer notification routing rows for multiple email destinations and disabled `Slack` / `Linear` placeholders tagged as coming soon.
- Revalidated with `@durabull/web` typecheck, unit tests, build, and lint. The only remaining web lint warning is the same unrelated pre-existing warning in `apps/web/src/routes/$orgSlug.c.$connectionId.queues.$queueName.tsx`.

## Current Task

- [x] Add substantial backend alerting tests covering evaluator edge cases, monitor lifecycle behavior, and alert API route integration.
- [x] Add substantial frontend alerting tests covering form helpers, hooks, components, and route-level orchestration.
- [x] Revalidate the touched alerting suites with targeted and package-level test/lint/typecheck runs.

## Result

- Added deep backend alerting coverage: evaluator edge cases, notifier URL encoding, monitor state-machine behavior, connection-scoped alert route integration, and org-level alert summary/history integration.
- Added deep frontend alerting coverage: rule-form validation/serialization helpers, alert query/mutation hooks, queue multi-select interactions, alert events table rendering, builder-page flows, workspace rule/history actions, and `alerts/new` / `alerts/$ruleId` route orchestration.
- Verified with `apps/api` full `bun test`, `bun run typecheck`, and `bun run lint`, plus `apps/web` full `bun run test:unit`, `bun run typecheck`, and `bun run lint`.
- `apps/web` lint still reports the same pre-existing unrelated warning in `apps/web/src/routes/$orgSlug.c.$connectionId.queues.$queueName.tsx`.

## Current Task

- [ ] Execute the MCP delivery via the sequential PR stack in `tasks/mcp-pr-execution-playbook.md`.
- [ ] Use `tasks/mcp-implementation-master-plan.md` as the technical source of truth for implementation details.
- [ ] Ensure each PR links to a Linear issue and includes complete verification evidence before merge.
- [ ] Keep the running history ledger in `tasks/mcp-pr-execution-playbook.md` updated as each agent completes handoff.

## Current Task

Post-#108 telemetry/analytics follow-ups (see `tasks/handoff-analytics-mcp-telemetry.md`). PR #108 landed all P0 hardening; a four-lens parallel review of merged `main` surfaced one real correctness bug plus robustness/hygiene gaps.

- [x] Fix MCP identified-event organization `$groups` double-hash (pass raw org id; capture hashes once).
- [x] Add 5s fetch timeout to PostHog batch + cloud forward; `redirect: 'manual'` on cloud forward (SSRF parity).
- [x] Single-flight + eager-bootstrap anonymous instance id; drop redundant cold-start SELECT.
- [x] Clamp client-supplied `/collect` timestamps to server time ±24h (anti-pollution).
- [x] `try/catch` `resolveAnonymousInstanceId` in `/events` → 503 instead of unhandled 500.
- [x] Hygiene: drop dead `DEFAULT_POSTHOG_BATCH_HOST` in `config.ts`; remove deprecated `getTelemetryHmacSecret` export; add `AnalyticsProperties.REDACTION_COUNT`; unify `McpPrincipalType` from `@durabull/dal`.
- [x] Tests: new `capture.test.ts` (single-hash `$groups`, timestamp clamp pass/clamp); updated mcp-analytics + collect tests.

## Result

- Verified suite green: 40 pass across the prescribed telemetry files (`validate`, `identifiers`, `posthog-batch`, `capture`, `telemetry`, `telemetry-collect`, `mcp-analytics`).
- Telemetry/MCP source typechecks clean; Biome lint clean on changed files (formatting normalized to repo style).
- Note: `apps/api/src/app.test.ts` "api app config" cases fail only in this sandbox shell (missing `MCP_AUTHLESS_BEARER_TOKEN`, `CI=true`) — unrelated to this diff (failures originate in MCP auth assertion / `enabled` env gate, not telemetry).

### Deferred to dedicated follow-up PRs (documented, not hacked)

- [x] `/collect` authentication / signed batches — also resolves OSS→cloud forwarded-runtime re-stamping fidelity loss and unauthenticated abuse (PR #110).
- [x] Rate-limit `X-Forwarded-For` trust (High security; cross-cutting `rate-limit.ts`, needs trusted-proxy config) (PR #110).
- [x] Async `/collect` (202 + bounded worker) and single-batch PostHog coalesce; bounded `/events` queue (PR #112).
- [x] Require dedicated `DURABULL_TELEMETRY_HMAC_SECRET` (remove `BETTER_AUTH_SECRET` fallback; env coordination).
- [x] `/collect` signature replay LRU within the HMAC tolerance window.
- [x] Extract shared `createBoundedAsyncQueue`; queue-drop metric; root barrel migration to `/browser`; telemetry signal docs (P3).

## Current Task

Analytics/MCP telemetry P3 follow-up from `tasks/handoff-analytics-mcp-telemetry.md`.

- [x] Map existing bounded queue implementations and telemetry metric patterns.
- [x] Extract a shared `createBoundedAsyncQueue` helper and cover queue-drop behavior.
- [x] Migrate browser-side analytics imports away from the root package barrel where appropriate.
- [x] Document telemetry signals, privacy boundaries, and required environment variables.
- [x] Run focused tests/lint/typecheck for the touched analytics/API surface.

## Result

- Extracted `/collect`, `/events`, and MCP analytics queue backpressure into a shared bounded async queue helper.
- Added `telemetry_queue` / `queue_dropped` stdout operational metrics and tests for queue-full behavior.
- Migrated browser analytics imports to `@durabull/analytics/browser` and constants to `@durabull/analytics/events`.
- Documented telemetry queue signals, required telemetry env vars, and HTTP telemetry backpressure behavior.
- Verified focused telemetry tests, affected web tests, web typecheck, and docs lint. API/docs package-wide typecheck still has unrelated current-main failures noted in the handoff.
- Ran the four-lens parallel review loop, fixed the High queue reset/in-flight correctness finding, and reran the review. Security, performance, correctness, and maintainability reviewers reported no remaining Critical/High issues.
