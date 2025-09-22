# Polaris Player (Next.js + Tailwind + shadcn)

Reusable, framework‑friendly video player for HLS / MP4 (and optional DASH) with a clean UI and sensible defaults. Designed for Next.js apps that already use Tailwind and shadcn‑style primitives.

---

## ✨ Features

- **HLS & MP4** out of the box (HLS via `hls.js`)
- **Optional DASH** (via Shaka Player, opt‑in)
- **Mobile‑first UI**, i18n provider, captions, thumbnails (VTT / JSON)
- **Autoplay `smart/on/off`**, PiP, fullscreen, buffered bar, overlays
- **Extensible ports** for analytics & storage
- **Tree‑shakeable** ESM + CJS + types

---

## 📦 Install

```bash
npm i polaris-player
# or: pnpm add polaris-player / yarn add polaris-player
```

### Peer dependencies (install in your app)

At minimum you’ll need:  
`react`, `react-dom`, `next`, `tailwindcss`, `hls.js`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `@radix-ui/react-slot`.

If you kept the full vendor UI set, you may also need a handful of Radix packages (accordion, dialog, popover, slider, …), `react-hook-form`, `framer-motion`, etc. Install missing ones on demand (the error will name them).

**DASH (optional):**

```bash
npm i shaka-player
```

---

## ⚙️ Configure Tailwind & Next

**`tailwind.config.cjs`**

```js
const { join } = require("path");

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", join(process.cwd(), "node_modules/polaris-player/**/*.{js,ts,jsx,tsx}")],
  presets: [require("polaris-player/tailwind-preset")],
};
```

**`app/layout.tsx` (or `_app.tsx`)**

```ts
import "polaris-player/styles.css";
```

**`next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["polaris-player"],
};
export default nextConfig;
```

---

## 🚀 Quick Start

```tsx
"use client";

import { VideoPlayer } from "polaris-player";

export default function Demo() {
  return (
    <div className="p-6">
      <VideoPlayer
        source={{
          id: "demo",
          type: "hls", // 'hls' | 'mp4' | 'dash'
          url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          poster: "https://dummyimage.com/1280x720/000/fff.jpg&text=Polaris",
          thumbnails: { url: "/thumbs/demo.vtt", format: "vtt" },
        }}
        analyticsEndpoint="/api/polaris-analytics" // your endpoint (or a stub)
        embedCtx={{ multimediaId: 1, streamingId: 1 }}
        autoplayMode="smart"
      />
    </div>
  );
}
```

> The page that renders the player must be a **client component**. The player itself already uses `'use client'` internally.

---

## 🧩 Props & Types

Key types live in `src/polaris/ports.ts` and are exported from the package.

### `VideoPlayer` props (essential subset)

```ts
type Props = {
  source: SourceDescriptor;
  analyticsEndpoint: string;
  hasAnalytics?: boolean;
  embedCtx: {
    sessionId?: string;
    origin?: string;
    iframeSrc?: string;
    multimediaId: number;
    streamingId: number;
    forbidden?: boolean;
  };
  playerVersion?: string; // default: 'v2.7-refactor-final'
  autoplayMode?: "off" | "on" | "smart";
  autoplayVolume?: number; // 0..1 (default 1)
  locale?: string; // default: 'en'
  onFirstVideoLoaded?: (info: FirstLoadedPayload) => void;
  className?: string;
};
```

### `SourceDescriptor` (core fields)

```ts
export type SourceType = "hls" | "mp4" | "dash";

export interface SourceDescriptor {
  id: string;
  type: SourceType;
  url: string; // HLS: .m3u8, MP4: .mp4, DASH: .mpd
  poster?: string;
  durationHint?: number;
  thumbnails?: {
    url: string;
    format: "vtt" | "json-sprite";
    baseUrl?: string;
  };
  // ...see package typings for advanced fields
}
```

---

## 📡 Analytics & Storage (Ports)

Wire your own analytics & persistence through ports:

- **AnalyticsPort**: implement or use provided adapters (console/noop).  
  Pass `analyticsEndpoint` and set `hasAnalytics` if you emit events.

- **StoragePort** (optional) for user prefs & resume:

---

## 🧪 Local testing (before publishing)

**Pack + install:**

```bash
# in the library
npm run build
npm pack   # produces e.g. polaris-player-0.1.0.tgz

# in your Next.js app
npm i ../path/to/polaris-player-0.1.0.tgz
```

**Link (dev):**

```bash
# in the library
npm link

# in the app
npm link polaris-player
```

---

## 🛠 Development

```bash
npm i
npm run build             # builds to /dist (esm + cjs + d.ts)
```

**Project structure**

```
src/
  polaris/                # player source
    ui/                   # UI components (VideoPlayerV2, overlays, controls)
    core/                 # machine, state, events
    adapters/             # hls/shaka, analytics, thumbs, ads, etc.
    providers/            # i18n, player-provider
    hooks/                # internal hooks
    ports.ts              # public types for extensibility
  vendor/                 # vendored shadcn/Radix ui + helpers
index.ts                  # exports from ./polaris
```

---

## 🧰 Troubleshooting

- **No styles / broken UI**  
  Ensure Tailwind `content` includes the package path and you imported `polaris-player/styles.css`.  
  Also enable `transpilePackages` in Next config.

- **“Module not found: shaka-player…”**  
  Install `shaka-player` in the **app** or remove DASH usage.

- **“Module not found: @radix-ui/…”**  
  Install the missing Radix package (or remove the specific vendor UI component).

- **First tap on mobile doesn’t play**  
  Use `autoplayMode="smart"` (unmutes on interaction) and confirm iOS policies.

---

## 🔖 Versioning & Publishing

- Bump version: `npm version patch|minor|major`
- Publish: `npm publish --access public`
- View: `npm view polaris-player version`

---

## 📜 License

MIT © You

---

## 🙋 FAQ

**Why is `styles.css` so small?**  
It just includes Tailwind layers. Visuals come from Tailwind classes and the preset (CSS variables).

**Can I use it without Tailwind?**  
It’s built for Tailwind. You could replace classes, but that’s non‑trivial.

**Does it support server components?**  
The player is a **client** component; wrap it in a client boundary when used inside RSC.
