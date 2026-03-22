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
