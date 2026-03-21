# Desktop Builds

Durabull's Electron app is a thin native shell around the existing production web and Bun API builds.

## Why this structure

- The current API server is Bun-native, so the desktop app ships a bundled Bun runtime and starts the already-built API locally.
- The API keeps serving the existing Vite build over `http://127.0.0.1:<port>`, which preserves the current routing, auth, cookies, and `/api` behavior.
- Local-first defaults are applied only inside the desktop shell:
  - `DURABULL_AUTHLESS=true`
  - `DURABULL_ENV_CONNECTIONS=false`
  - persistent `DURABULL_PGLITE_DIR` under Electron `userData`
  - a stable local secret for encrypted saved Redis connection URLs

## Commands

From the repo root:

```bash
bun run build:desktop
bun run start:desktop
bun run dist:desktop
```

Artifacts are emitted from `apps/desktop/release/`.

## macOS build and release

### Build a local mac app

From the repo root on macOS:

```bash
bun run build:desktop
bun run dist:desktop
```

This produces the packaged desktop artifacts in `apps/desktop/release/`, including the macOS `.dmg` and `.zip` targets configured in `apps/desktop/package.json`.

If you only want the unpacked app bundle for a quick local sanity check, run:

```bash
bun run dist:desktop:dir
```

### Release the mac app

- Tagged releases are built in GitHub Actions by `.github/workflows/desktop-build.yml`.
- Pushing a tag like `v1.2.3` runs `bun run dist:desktop`, which uses Turborepo to build the desktop app plus its dependent `@durabull/api` and `@durabull/web` workspaces before uploading the generated desktop artifacts from `apps/desktop/release/` to the matching GitHub Release assets in CI.
- Manual `workflow_dispatch` runs build the desktop artifacts and upload them as workflow artifacts without publishing a GitHub Release.

If you need to publish directly from a macOS machine instead of CI, run this from `apps/desktop` with a GitHub token available as `GH_TOKEN`:

```bash
bun run dist:publish
```

That uses `electron-builder`'s direct GitHub publish path and targets the configured GitHub release provider.
