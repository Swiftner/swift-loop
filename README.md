# Swift Loop

A Figma plugin for creating iterated and grid-arrayed graphics. Drag sliders, watch shapes multiply in real time.

> Swift Loop is a modernized fork of [Looper](https://github.com/kuldar/figma-looper) by **Kuldar Kalvik**, with later contributions from the [girafic fork](https://github.com/girafic/figma-looper). Rebuilt on Figma's current Plugin API with a formula-first engine, live slider preview, and a `cols × rows` grid mode.

## Install (no build needed)

1. Download the latest `swift-loop-vX.Y.Z.zip` from the [Releases page](https://github.com/swiftner/swift-loop/releases)
2. Unzip anywhere
3. In Figma desktop → *Plugins → Development → Import plugin from manifest…* → pick `manifest.json`

## Usage

1. Select a Vector, Shape, Text, or Group
2. Open Swift Loop
3. Set columns and rows (or leave rows=1 for a linear chain)
4. Adjust X, Y, rotation, scale, opacity — preview updates as you drag
5. Open Modulation to add randomness or sinusoidal waves
6. Apply a preset or browse the **Library** for community-contributed patterns
7. Click Generate to commit

## Formula Library

Swift Loop ships with a Library of formula patterns (radial, spiral, phyllotaxis, hex, wave, more) browsable from the Presets section. Each pattern is a small JSON file in `library/` with a procedural SVG thumbnail rendered from its own formulas.

**Contribute a pattern:** see [CONTRIBUTING.md](./CONTRIBUTING.md). One JSON file + one PR.

## Custom formulas

Click the `fx` pill in the top-right to switch into formula mode. Each property becomes a math expression you can edit freely:

```
x = cos(t * TAU) * 200
y = sin(t * TAU) * 200
rotation = t * 360
```

Available scope: `i`, `n`, `c`, `r`, `cols`, `rows`, `t`, `tx`, `ty`, `w`, `h`, `seed`
Available functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sqrt`, `pow`, `exp`, `log`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `rand()`
Constants: `PI`, `E`, `TAU`

## Install from source

```bash
git clone https://github.com/swiftner/swift-loop.git
cd swift-loop
bun install
bun run build
```

Then same Figma import step.

## License

ISC. See `LICENSE`.

## Credit

Based on Looper by [Kuldar Kalvik](https://github.com/kuldar). Looper Legacy fork by [Stas Haas (@girafic)](https://github.com/girafic). Modernized by [Swiftner](https://swiftner.com).
