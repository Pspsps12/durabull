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
