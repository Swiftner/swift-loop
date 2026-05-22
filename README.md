# Swift Loop

**Turn one shape into a hundred. In Figma. While you drag.**

Swift Loop is a Figma plugin for making patterns. Spirals, grids, waves, phyllotaxis, halftone, hex tiles, basically anything you can describe with a little math. Pick a shape, pick a pattern, drag a slider, and watch it bloom in real time.

You can play with it right now, no Figma required:

→ **[Live preview in your browser](https://swiftner.github.io/swift-loop/)**

Or jump straight to the real thing:

→ **[Install in Figma](https://github.com/Swiftner/swift-loop/releases/latest)**

## Why another loop plugin?

Because the original [Looper](https://github.com/kuldar/figma-looper) was lovely, and it's been quiet for a while. The Figma Plugin API has moved on, dynamic-page is the new normal, and there were a few things we kept wishing for:

A **live preview** that re-renders as you drag, so you're not stuck in a "Generate, undo, try again" loop.

**Grids, not just chains.** Set `cols × rows` and watch your shape tile.

**Spirals without a math degree.** A single **Angle** slider curls a line into a spiral or swirls a grid, no formula required.

**A formula library** with 20 patterns to start from, browsable right in the UI.

**Custom formulas** for when a slider won't cut it. Drop into `fx` mode and write the math yourself.

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

Set columns and rows. Leave rows at 1 if you want a line. Crank both if you want a grid. Bump the **Angle** slider a few degrees and the line curls into a spiral, the grid swirls.

Drag X, Y, rotation, scale, opacity. The preview updates as you go.

Want chaos? Open **Modulation** for randomness and sine waves.

Want a head start? Hit a **Preset** or browse the **Library**.

When you're happy, click **Generate** to commit it to the canvas. Undo always works, so iterate freely.

## The Library

20 patterns ship with the plugin:

Brick, Checker, Confetti, Curl, Damped Wave, Diamond, Fountain, Grid, Halftone, Hex Tile, Lissajous, Phyllotaxis, Pinwheel, Polar Grid, Radial Burst, Ribbon, Ripple, Spiral, Starburst, Wave.

Each one is a tiny JSON file in [`library/`](./library) with the formulas inline. No code, no rebuild, just the math. If you want to add your own, it's one file and one PR. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the schema.

## Docs

If you want the full tour:

- [Getting started](./docs/getting-started.md) for first-time setup.
- [Controls reference](./docs/controls.md) for every slider, in plain language.
- [Pattern gallery](./docs/pattern-gallery.md) for what each built-in pattern looks like and when to reach for it.
- [Recipe cookbook](./docs/recipes.md) for "I want to make X" with step-by-step settings.
- [Modulation](./docs/modulation.md) for randomness and sine waves.
- [Formulas for designers](./docs/formulas.md) for `fx` mode without the math-textbook vibes.
- [Troubleshooting](./docs/troubleshooting.md) for when things look weird.

And one for the robots:

- [Pattern authoring guide for LLMs](./docs/llm-pattern-guide.md). Paste this into Claude or ChatGPT and it'll help you write new library patterns from a plain-English description.
- [Changelog](./CHANGELOG.md). What landed in each release.

## Custom formulas

Click the `fx` pill in the top-right of the UI and each property turns into a math expression you can edit live:

```
x        = cos(t * TAU) * 200
y        = sin(t * TAU) * 200
rotation = t * 360
scale    = 0.4 + 0.6 * sin(t * PI)
```

You can use: `i` (index), `n` (total), `c` (column), `r` (row), `cols`, `rows`, `t` (0 to 1), `tx`, `ty`, `w`, `h`, `seed`.

Functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sqrt`, `pow`, `exp`, `log`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `mod`, `rand()`.

Constants: `PI`, `E`, `TAU`.

If you've used Desmos or written a shader, you already know the dialect.

## Contributing

PRs welcome. Patterns especially. If you've got a layout you keep redrawing by hand, that's a contribution waiting to happen. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

ISC. Fork it, ship it, sell it. Just keep the credit line.

## Credits

Standing on shoulders:

[**Looper**](https://github.com/kuldar/figma-looper) by [Kuldar Kalvik](https://github.com/kuldar), the original, and still a great idea.

[**Looper Legacy**](https://github.com/girafic/figma-looper), a fork by [Stas Haas](https://github.com/girafic) that kept it alive.

**Swift Loop**, modernized, gridded, and formula-fied by [Swiftner](https://swiftner.com).
