# Pattern gallery

The 20 patterns that ship with Swift Loop , with what they look like and when to reach for them. Patterns are grouped roughly by feel, not by alphabetical order, because that's actually useful.

A few of the radial patterns now use the **Angle** field instead of `cos`/`sin` in their formulas — same look, simpler math, and you can scrub the Angle slider after applying them.

If you want to see them live, open the plugin and click through the Library. There are thumbnails. It's faster than reading.

## Grids and tilings

The well-behaved ones. Predictable, uniform, easy to combine with other things.

**Grid.** Uniform rectangular tiling. The plainest possible loop. Useful as a base.

**Brick.** Masonry pattern. Every other row is offset by half a step, like brickwork.

**Hex Tile.** Honeycomb. Every other row shifts by half a column, and rows are squished vertically to the proper hex ratio.

**Diamond.** Isometric rotated grid. Rows and columns project at 45 degrees.

**Checker.** Uniform grid with alternating opacity. Half the cells are visible, half are ghosted.

## Radial and circular

Things that arrange themselves around a point.

**Radial Burst.** Shapes arranged in a circle, each rotating outward. The classic petal layout.

**Pinwheel.** A radial arrangement where each cell is also rotated, giving it spin.

**Curl.** A straight line curled into a spiral via per-cell angle. Shows what the Angle slider does on its own. Scrub Angle from 0 upward and watch the line bend.

**Starburst.** Radial rays from the origin. Alternating long and short arms make it look like a sea urchin or a sun icon.

**Polar Grid.** Concentric rings with evenly spaced spokes. `cols` is spokes, `rows` is rings.

**Spiral.** Expanding logarithmic spiral. Set `cols` higher for tighter coiling.

**Phyllotaxis.** Sunflower seed pattern using the golden angle. The most satisfying pattern in the library to crank up. Try 200 cols.

## Waves and curves

When you want softness, motion, organicness.

**Wave.** Sinusoidal Y displacement across columns. Looks like a string section.

**Ribbon.** Wave with phase drift across rows, so each row offsets a little, making a flowing ribbon shape.

**Ripple.** Grid with Y displaced by a sine wave radiating from the center. Drop a stone in a pond.

**Damped Wave.** Sine wave whose amplitude shrinks across the row. Like a struck tuning fork.

**Lissajous.** Interlocking sine curves on both axes. The textbook math curve, infinitely tweakable.

## Falloffs and gradients

Patterns where things get smaller, fainter, or sparser toward an edge.

**Halftone.** Grid where cells shrink and fade with distance from the center. Newsprint dot vibes.

**Fountain.** Parabolic arc, like something tossed in the air with gravity bringing it down. Try this with text characters.

## Chaos

For when uniformity is the enemy.

**Confetti.** Heavy random jitter on position and rotation. Mess in a bottle.

## How to use this list

Most of the time, the workflow is:

Find the pattern in this list that's closest to what you want.

Apply it. Adjust `cols` and `rows` until the density feels right.

Tweak the size parameters in the formula (the highlighted numbers in `fx` mode).

If you want to combine ideas, copy the formulas of one pattern, apply another pattern, and paste the bits you wanted. The library is meant to be a starting point, not a destination.

## Want more?

The library is community-driven. If you've got a pattern that isn't here yet, add it. See [Contributing](../CONTRIBUTING.md), or paste the [LLM authoring guide](./llm-pattern-guide.md) into your favorite chat assistant and describe what you want.
