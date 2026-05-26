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

**Spiral.** (In the Appearance section.) Degrees of per-cell lean, applied to each clone's grid offset around the source center — think "how much do successive cells turn". Leave it flat at 0 for straight lines and rectangular grids; a flat line at 5 to 30 degrees curls a line into a spiral or swirls a grid. It's a **ramp**, so you can also start small and end large: the curl then tightens along the loop (a logarithmic-style spiral) instead of turning at a constant rate.

**Twist / Scale / Fade / Random (per axis).** Each of Column, Row, and Layer carries these four as **ramps**, not single numbers. A ramp is a little curve with stops you drag: left to right is position along the axis (first clone → last), up and down is the value. Drag the dots, press the track to add a stop, or type an exact value in the number beside each stop. Twist adds rotation, Scale grows or shrinks, Fade drops opacity, Random adds seeded position jitter — each shaped across that axis by its stops. A flat line means no effect (a flat line above zero, for Random, means even jitter everywhere).

## Position (X step / Y step)

Both the **Column** and **Row** sections carry an **X step** and a **Y step** — how far each clone moves along each direction. For a plain grid, a column moves along X and a row along Y. But give a column some **Y step** (or a row some **X step**) and the whole grid shears into an oblique or isometric lattice. Steps are scaled to your selection (±2× the shape's width/height), so a 16-px icon and a 1200-px illustration get the same slider feel. Try the **Isometric** pattern in the library to see it in action.

Each axis's primary step (Column's X step, Row's Y step) has its own **`fx`** button for formula-driven positioning. The cross-axis step (Column's Y step, Row's X step) is a plain slider — and if you need to write the full position by hand, the `x` / `y` formula in `fx` mode is the escape hatch for any lattice you can describe.

Rotation and size used to live here as per-step sliders. They now live in **Appearance** as ramps — see below.

## Modulation

Where things stop being grids and start being interesting. See [Modulation](./modulation.md) for the full story.

**Random ±.** A ramp per property — Rotation, Size X, Size Y, Opacity — sampled along the loop. Raise it above 0 to add seeded per-clone jitter to that property; a flat line means even jitter everywhere, a rising line means more jitter toward the end. (Position jitter lives in the Column / Row / Layer sections as their **Random** ramp.)

**Sinusoidal: Rotation.** A sine wave on rotation. Three knobs: amplitude (how wide), frequency (how many waves across the loop), phase (where the wave starts).

**Sinusoidal: Scale.** Same, for size.

## Appearance

Each clone's look. Every numeric row here is a **ramp** — the same little curve as the per-axis Twist/Scale/Fade: stops you drag along the loop (left = first clone, right = last), up and down is the value. Press the track to add a stop, drag a dot to move it, type an exact value beside each stop, right-click a dot (or its `×`) to remove it. A flat line means "the same everywhere". Every row also has an **`fx`** button — see Formula mode below.

**Spiral.** Per-cell lean of the grid offset (see Iterations above). As a ramp, a small→large curve tightens the spiral along the loop; a flat line is a uniform spiral.

**Rotation.** Degrees of clone rotation, shaped along the loop. A `0 → 90` ramp turns later clones progressively.

**Size X / Size Y.** Pixel change to each clone's size, shaped along the loop. Positive grows, negative shrinks. Scaled to your selection.

**Opacity.** Per-clone opacity (%), shaped along the loop. A `100 → 0` ramp fades the loop out.

**Fill.** Optional colour gradient. Click the strip to add a stop, click a stop to recolour. Swept across the loop (or by an `fx` factor — see below).

**Stroke.** Same idea, for the stroke colour.

**Stroke width.** Per-clone stroke weight, shaped along the loop.

**Easing chip.** Top-right of the section. It curves the **colour** sweep (Fill / Stroke) across the loop — `linear`, `ease`, `easeIn`, `easeOut`. The numeric ramps shape themselves with their own stops, so easing doesn't touch them.

## History

A collapsible section near the bottom of the sidebar, just above the library. Open it to find:

**Seed.** A number you can scrub. Whenever the loop uses randomness, the seed determines the exact "random" outcome. Same seed gives the same result, always. Change it and the dice get rerolled.

**Recent seeds.** A row of little dots, one per recent configuration. Swift Loop quietly remembers your recent rerolls; click any dot to jump back to that seed. They wrap onto more lines as you accumulate them.

## Presets and Library

Bottom of the sidebar.

**Presets.** Three quick built-in starting points (Linear fade, Spin, Grid wave). Click and the whole UI rearranges to that configuration.

**Library.** Opens a full-screen overlay of every library pattern with thumbnails. Click any one to apply. Hover for the description.

## Formula mode (`fx`)

Every ramp and gradient row has its own little **`fx`** button. Press it to reveal a formula box: type a free-form math expression and it takes over that one property, leaving the rest as-is. For a numeric row the formula *is* the value (e.g. `rotation = t * 90`); for a colour gradient it returns a `0..1` position to sample along the stops (e.g. `t`, `tx`, `rand()`). Clearing the box hands control back to the stops — the ramp is kept the whole time, so toggling fx never loses your curve or your formula. Library patterns lean on this to express themselves. See [Formulas for designers](./formulas.md) for the gentle introduction.

## Snapshots and undo

A few things to know about state.

Snapshots are automatic. Every time you change the seed or apply a library pattern with a new seed, Swift Loop saves a snapshot in the **History** section. You can return to any of the recent ones.

Cmd/Ctrl+Z works everywhere. The undo stack lives inside the plugin, so you can step back through every change you've made in this session.

Closing the plugin without clicking **Generate** throws away the in-progress preview but keeps your snapshots for next time.
