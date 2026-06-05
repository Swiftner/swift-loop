# Swift Loop

**Turn one shape into a hundred. In Figma. While you type.**

Swift Loop is a faithful rebuild of the classic [Looper](https://github.com/kuldar/figma-looper) plugin — same panel, same controls, same instant "oh that's nice" — on a modern engine that keeps up with today's Figma.

You can play with it right now, no Figma required:

→ **[Live playground in your browser](https://swift-loop.com/)**

Or jump straight to the real thing:

→ **[Install in Figma](https://github.com/Swiftner/swift-loop/releases/latest)**

## Why rebuild Looper?

Because the original was lovely, and it's been quiet for a while. The Figma Plugin API has moved on — dynamic-page is the new normal — and the old plugin has started to creak. Swift Loop keeps the part everyone loved:

**One panel, no learning curve.** Iterations, Position, Rotation, Scale, Opacity, Fill, Stroke. If you've used Looper, you already know Swift Loop.

**Live on the canvas.** With Auto-update on, every value you type updates the loop as you go. No generate-undo-retry cycle.

**Undo that works.** One undo, one step back. There are visible Undo/Redo buttons too, so you don't have to trust the keyboard.

Same spirit as Looper. New engine underneath.

## Install

The easy way:

1. Grab the latest `swift-loop-vX.Y.Z.zip` from the [Releases page](https://github.com/Swiftner/swift-loop/releases).
2. Unzip it somewhere safe.
3. In Figma desktop, go to *Plugins, Development, Import plugin from manifest…*, and pick the `manifest.json` you just unzipped.

That's it. The plugin lives in your *Plugins, Development* menu from now on.

If you'd rather build from source:

```bash
git clone https://github.com/Swiftner/swift-loop.git
cd swift-loop
bun install
bun run build
```

Then do the same Figma import step on the cloned folder's `manifest.json`.

## Using it

Pick something on your canvas. A Vector, a Shape, some Text, a Group, whatever you've got.

Run **Plugins, Development, Swift Loop**.

Set how many copies you want — tap a quick chip (5 to 40) or type a number.

Give the copies somewhere to go: **Position** X/Y is how far each copy moves from the last one. **Rotation** turns each copy a little more than the one before. **Scale** grows (or shrinks) each copy by a few pixels. **Opacity** fades from a start value to an end value. **Fill** and **Stroke** blend from one colour to another across the whole loop.

Each section has a **Random** toggle when tidy isn't the vibe.

With **Auto update** on (it starts on), the canvas follows along as you type. Turn it off if you'd rather set everything up first and commit with **Create**.

And undo always works — buttons in the panel, or Cmd/Ctrl+Z.

For the longer tour: [Getting started](./docs/getting-started.md).

## Docs

- [Getting started](./docs/getting-started.md) for install and your first loop.
- [Troubleshooting](./docs/troubleshooting.md) for when things look weird.
- [Changelog](./CHANGELOG.md) for what landed in each release.

## Looking for the formula version?

An earlier direction of Swift Loop grew grids, custom formulas, modulation, and a 38-pattern library. We've set it aside to ship the focused Looper experience first — the whole thing is preserved on the [`main-archive-2026-06`](https://github.com/Swiftner/swift-loop/tree/main-archive-2026-06) branch if you want to explore it.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

ISC. Fork it, ship it, sell it. Just keep the credit line.

## Credits

Standing on shoulders:

[**Looper**](https://github.com/kuldar/figma-looper) by [Kuldar Kalvik](https://github.com/kuldar), the original, and still a great idea.

[**Looper Legacy**](https://github.com/girafic/figma-looper), a fork by [Stas Haas](https://github.com/girafic) that kept it alive.

**Swift Loop**, rebuilt for modern Figma by [Swiftner](https://swiftner.com).
