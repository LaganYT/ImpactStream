# ImpactStream monorepo

ImpactStream is organized as a pnpm workspace so each client can evolve independently while sharing platform-neutral contracts.

## Layout

- `apps/web` — existing Next.js website and API routes.
- `apps/mobile` — Expo / React Native app for iOS and Android.
- `apps/roku` — Roku SceneGraph / BrightScript client.
- `packages/shared` — TypeScript types and cross-platform API helpers.

Future clients can follow the same pattern, for example `apps/android-tv`, `apps/tvos`, or `apps/fire-tv`.

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:mobile
pnpm build
pnpm typecheck
```

The Roku client does not run through Node or Turbo; package and sideload `apps/roku` using the Roku developer workflow.

## Architecture guidance

Keep HTTP contracts, media models, validation, and other platform-neutral logic in `packages/shared`. Keep rendering, navigation, playback integrations, filesystem access, and device APIs inside each app.

The existing Next.js API routes currently remain in `apps/web/pages/api`. As native and TV clients mature, consider extracting those endpoints into a dedicated backend app or stable public API so every client can call the same service without depending on web-only page code.
