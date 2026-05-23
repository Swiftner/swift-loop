# Controls reference

This is every slider, every chip, every clickable thing in the Swift Loop UI, in roughly the order you'll encounter it. Skim once, come back when you hit something confusing.

## The top bar

This is the strip across the top of the plugin window. It's about your loop as a whole, not any one property.

**Seed.** A number you can scrub. Whenever the loop uses randomness, the seed determines the exact "random" outcome. Same seed gives the same result, always. Change it and the dice get rerolled.

**Reroll.** A dice icon. Picks a new random seed for you. Useful when you've got a pattern with randomness and just want to keep flipping through variations.

**Reset.** Wipes everything back to a true blank slate: 1x1 grid (just the source, no clones), every transform dial at zero, no angle. Useful when you've made a mess and want to dial in from nothing. The first time you open the plugin you still see the readable 10x10 grid; Reset is what collapses it.

**Snapshots.** Little squares of recent configurations. Swift Loop quietly remembers your last few rerolls. Click any snapshot to jump back to it.

## Iterations

The first section. This is where you set the count.

**Cols.** How many columns. 1 to 100.

**Rows.** How many rows. 1 to 100. Leave at 1 for linear and radial patterns.

**Angle XY.** Degrees of per-cell rotation in the screen plane, applied to each clone's grid offset around the source center. Leave at 0 for straight lines and rectangular grids. Bump it 5 to 30 degrees and a line curls into a spiral, a grid swirls. Crank it past 90 to wrap the pattern back around on itself. Think "how much do successive cells lean".

**Angle Z.** Degrees of per-cell tilt into depth, applied after Angle XY. The tool is flat 2D, so there's no real depth axis — instead each clone's offset is tilted toward/away from you and projected back onto the canvas, which foreshortens it. Leave at 0 to stay flat. Dial it up and a flat spiral leans into a cone or helix, a ring squashes into an ellipse seen at an angle. Because it's a projection, the result is still plain 2D positions, so it exports and round-trips like everything else.

**Depth.** How hard to sell the 3D illusion, 0 to 100%. With Angle Z doing the tilt, this scales and fades each clone by how far it leans toward or away from you: the near side grows and stays bright, the far side shrinks and dims. It does nothing on its own — you need a nonzero Angle Z for there to be any depth to shade. At 0% you get pure projection (shapes keep their size); crank it up and the cone or helix reads as genuinely three-dimensional. Note this rides on top of your Scale and Opacity sliders, so a cell's final size is the slider value times the depth factor.

If you've applied a library pattern, you'll also see a little pill showing its name. Click it to jump back to the library and pick something else.

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

## Presets and Library

Bottom of the sidebar.

**Presets.** Three quick built-in starting points (Linear fade, Spin, Grid wave). Click and the whole UI rearranges to that configuration.

**Library.** Opens a full-screen overlay of every library pattern with thumbnails. Click any one to apply. Hover for the description.

## Formula mode (`fx`)

Top-right corner of the plugin. The `fx` pill toggles formula mode. When it's on, every transform property turns into a free-form math expression you can edit. See [Formulas for designers](./formulas.md) for the gentle introduction.

## Snapshots and undo

A few things to know about state.

Snapshots are automatic. Every time you click Reroll or apply a library pattern with a new seed, Swift Loop saves a snapshot. You can return to any of the last eight.

Cmd/Ctrl+Z works everywhere. The undo stack lives inside the plugin, so you can step back through every change you've made in this session.

Closing the plugin without clicking **Generate** throws away the in-progress preview but keeps your snapshots for next time.
