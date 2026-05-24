# Controls reference

This is every slider, every chip, every clickable thing in the Swift Loop UI, in roughly the order you'll encounter it. Skim once, come back when you hit something confusing.

## The top bar

This is the strip across the top of the plugin window. It's about your loop as a whole, not any one property.

**Reset.** On the left. Wipes everything back to a true blank slate: 1x1 grid (just the source, no clones), every transform dial at zero, no angle. Useful when you've made a mess and want to dial in from nothing. The first time you open the plugin you still see the readable 10x10 grid; Reset is what collapses it.

**Library.** On the right, a `library →` button (once you've applied a pattern, it shows that pattern's name instead). Click it to open the pattern library and pick something, or swap to a different pattern.

**Help.** The `i` icon, far right. Version info and links.

(The seed and your recent seeds now live in their own **History** section near the bottom — see below.)

## Iterations

The first section. This is where you set the count.

**Cols.** How many columns. 1 to 100.

**Rows.** How many rows. 1 to 100. Leave at 1 for linear and radial patterns.

**Layers.** Depth layers (Z), 1 to 50. The grid becomes a Columns × Rows × Layers cube of clones. On its own it just stacks more copies in place — the 3D look comes from a formula (or a library preset like **Cube**) that reads the layer index `l`. Leave at 1 for a flat 2D pattern.

**Spiral.** (In the Appearance section.) Degrees of per-cell rotation, applied to each clone's grid offset around the source center. Leave at 0 for straight lines and rectangular grids. Bump it 5 to 30 degrees and a line curls into a spiral, a grid swirls. Crank it past 90 to wrap the pattern back around on itself. Think "how much do successive cells lean".

**Twist / Scale / Fade / Random (per axis).** Each of Column, Row, and Layer carries these four as **ramps**, not single numbers. A ramp is a little curve with stops you drag: left to right is position along the axis (first clone → last), up and down is the value. Drag the dots, press the track to add a stop, or type an exact value in the number beside each stop. Twist adds rotation, Scale grows or shrinks, Fade drops opacity, Random adds seeded position jitter — each shaped across that axis by its stops. A flat line means no effect (a flat line above zero, for Random, means even jitter everywhere).

## Transform

How each clone gets moved relative to the previous one.

All Transform sliders are scaled to your selection: ±2x the shape's width/height for X/Y, ±1x for Scale. A 16-px icon and a 1200-px illustration get the same slider feel, not the same absolute pixel range.

**X.** Horizontal offset per step. Drag right to spread the loop horizontally.

**Y.** Vertical offset per step. Drag down to spread it vertically.

**Rotation.** Degrees of rotation added per step. 36 with `cols=10` gives a full 360 across the loop.

**Scale X / Scale Y.** Per-step change to scale. A positive value means clones grow, a negative value means they shrink.

Each of these has two numbers, a **start** and an **end**. Drag the right-side number to enable end interpolation, which makes the value transition from start to end across the whole loop. This is how you get fade-and-shrink effects.

## Modulation

Where things stop being grids and start being interesting. See [Modulation](./modulation.md) for the full story.

**Rotation wave.** Adds a sinusoidal jiggle to rotation. Three knobs: amplitude (how wide), frequency (how many waves across the loop), phase (where the wave starts).

**Scale wave.** Same as above but for scale.

**Random on each property.** Every Transform slider also has a `±` random control. Set it above 0 to introduce per-clone jitter on that property.

## Appearance

Color and opacity stuff.

**Opacity.** Per-clone opacity. Has start/end like Transform.

**Fill.** Optional gradient between two colors, applied across the loop. Click the swatch to enable.

**Stroke.** Same idea but for the stroke color. Click to enable.

**Stroke weight.** Per-clone stroke weight. Start/end supported.

**Easing chip.** Top-right of the section. Controls how start-to-end interpolations curve. `linear` is uniform, `ease` is smooth in and out, `easeIn` accelerates, `easeOut` decelerates.

## History

A collapsible section near the bottom of the sidebar, just above the library. Open it to find:

**Seed.** A number you can scrub. Whenever the loop uses randomness, the seed determines the exact "random" outcome. Same seed gives the same result, always. Change it and the dice get rerolled.

**Recent seeds.** A row of little dots, one per recent configuration. Swift Loop quietly remembers your recent rerolls; click any dot to jump back to that seed. They wrap onto more lines as you accumulate them.

## Presets and Library

Bottom of the sidebar.

**Presets.** Three quick built-in starting points (Linear fade, Spin, Grid wave). Click and the whole UI rearranges to that configuration.

**Library.** Opens a full-screen overlay of every library pattern with thumbnails. Click any one to apply. Hover for the description.

## Formula mode (`fx`)

Top-right corner of the plugin. The `fx` pill toggles formula mode. When it's on, every transform property turns into a free-form math expression you can edit. See [Formulas for designers](./formulas.md) for the gentle introduction.

## Snapshots and undo

A few things to know about state.

Snapshots are automatic. Every time you change the seed or apply a library pattern with a new seed, Swift Loop saves a snapshot in the **History** section. You can return to any of the recent ones.

Cmd/Ctrl+Z works everywhere. The undo stack lives inside the plugin, so you can step back through every change you've made in this session.

Closing the plugin without clicking **Generate** throws away the in-progress preview but keeps your snapshots for next time.
