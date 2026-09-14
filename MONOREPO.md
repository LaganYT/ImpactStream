# ImpactStream monorepo

ImpactStream is organized as a pnpm workspace so each platform can evolve independently while sharing code when it is actually reused.

## Apps

- `apps/web` — Next.js web app and API routes.
- `apps/mobile` — Expo / React Native app for iOS and Android.
- `apps/roku` — Roku SceneGraph / BrightScript app.

## Packages

- `packages/shared` — platform-neutral code that is currently shared between apps. Keep code here only once more than one app genuinely needs it.

## Commands

Run commands from the repository root with pnpm:

```bash
pnpm install
pnpm dev:web
pnpm dev:mobile
pnpm build
pnpm typecheck
```

The Roku app uses Roku's native toolchain rather than the JavaScript workspace runtime.

## Adding another platform

Add JavaScript/TypeScript apps under `apps/<platform>` and consume shared packages with `workspace:*`. Native platforms that cannot consume TypeScript directly should use the same backend/API contracts while keeping platform-specific UI and playback code inside their app directory.
