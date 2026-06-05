# Contributing to Swift Loop

Pull requests welcome. Small ones especially — a fixed typo, a clearer label, a bug squashed.

## Getting set up

```bash
git clone https://github.com/Swiftner/swift-loop.git
cd swift-loop
bun install
bun run build
```

Import the repo's `manifest.json` into Figma desktop (*Plugins, Development, Import plugin from manifest…*) to run your build, or use the browser playground:

```bash
bun run dev
```

That builds everything and serves the playground at `http://localhost:4173/` — the real panel and engine on a fake canvas, no Figma needed.

## Before you open a PR

```bash
bun run lint
bun run test
```

Both should be clean. If you changed behaviour, give the relevant doc a quick look too — the docs are short on purpose, so it's usually a one-line edit.

## A note on scope

Swift Loop is deliberately a faithful rebuild of the classic Looper panel. If your idea adds a new control or a new concept to the panel, open an issue first so we can talk about it — it might be wonderful, and it might belong in the [formula-flavoured branch](https://github.com/Swiftner/swift-loop/tree/main-archive-2026-06) instead.

Happy looping.
