# ImpactStream

ImpactStream is a multi-platform streaming project organized as a pnpm monorepo.

## Apps

- `apps/web` — Next.js web app and API routes.
- `apps/mobile` — Expo / React Native app for iOS and Android.
- `apps/roku` — Roku SceneGraph / BrightScript app.

## Shared code

- `packages/shared` — platform-neutral code that is genuinely reused by more than one app.

Keep UI, navigation, playback integrations, and device-specific behavior inside each app. Move code into `packages/shared` only when multiple apps actually consume it.

## Requirements

- Node.js 22.13 or newer.
- pnpm 12.
- A TMDB API key.

## Setup

```bash
git clone https://github.com/LaganYT/ImpactStream.git
cd ImpactStream
pnpm install
```

Create `apps/web/.env.local`:

```env
TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
```

Optional web configuration:

```env
NEXT_PUBLIC_DOWNLOAD_API_URL=https://downloads.shegu.st
```

## Development

Run commands from the repository root:

```bash
pnpm dev:web
pnpm dev:mobile
pnpm build
pnpm typecheck
```

The Roku app uses Roku's native development and sideloading workflow rather than the JavaScript workspace runtime.

## Repository structure

```text
ImpactStream/
├── apps/
│   ├── mobile/
│   ├── roku/
│   └── web/
├── packages/
│   └── shared/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Web app

The web app provides movie, TV, anime, and live-TV browsing, TMDB metadata, embedded playback, continue-watching state, program-guide data, and direct download options where available.

## Adding another platform

Add JavaScript or TypeScript clients under `apps/<platform>` and use workspace packages with `workspace:*`. Platforms that cannot consume TypeScript directly should share API contracts while keeping their native UI and playback code platform-specific.
