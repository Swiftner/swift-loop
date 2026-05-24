# Pattern gallery

The 37 patterns that ship with Swift Loop, with what they look like and when to reach for them. Patterns are grouped roughly by feel, not by alphabetical order, because that's actually useful.

A few of the radial patterns lean on the **Spiral** control (in Appearance) instead of `cos`/`sin` in their formulas — same look, simpler math, and you can scrub the Spiral ramp after applying them.

If you want to see them live, open the plugin and click through the Library. There are thumbnails. It's faster than reading.

## Grids and tilings

The well-behaved ones. Predictable, uniform, easy to combine with other things.

**Grid.** Uniform rectangular tiling. The plainest possible loop. Useful as a base.

**Brick.** Masonry pattern. Every other row is offset by half a step, like brickwork.

**Hex Tile.** Honeycomb. Every other row shifts by half a column, and rows are squished vertically to the proper hex ratio.

**Diamond.** Isometric rotated grid. Rows and columns project at 45 degrees.

**Checker.** Uniform grid with alternating opacity. Half the cells are visible, half are ghosted.

**Concentric Squares.** Nested square rings expanding outward — the polar trick, but snapped to a square instead of a circle. `cols` is points per ring, `rows` is rings.

**Truchet.** A uniform grid where each tile is randomly turned by a multiple of 90°. With the right source shape (a quarter-arc or diagonal) the cells join into winding, maze-like paths. Scrub the seed for a new layout.

## Radial and circular

Things that arrange themselves around a point.

**Radial Burst.** Shapes arranged in a circle, each rotating outward. The classic petal layout.

**Pinwheel.** A radial arrangement where each cell is also rotated, giving it spin.

**Curl.** A straight line curled into a spiral via per-cell lean. Shows what the Spiral ramp does on its own. Scrub Spiral from 0 upward and watch the line bend.

**Vortex.** Tight inward spiral with shapes shrinking and fading toward the center. The most dramatic of the spiral family.

**Starburst.** Radial rays from the origin. Alternating long and short arms make it look like a sea urchin or a sun icon.

**Polar Grid.** Concentric rings with evenly spaced spokes. `cols` is spokes, `rows` is rings.

**Spiral.** Expanding logarithmic spiral. Set `cols` higher for tighter coiling.

**Square Spiral.** The same outward spiral, snapped to right angles — a squared-off coil. Good for circuit-board and maze vibes.

**Whirl.** A line wound into a spiral that *tightens* as it travels, with the tail fading out. Its Spiral and Opacity curves are hand-drawn (no formula), so drag their stops in Appearance to reshape the coil.

**Phyllotaxis.** Sunflower seed pattern using the golden angle. The most satisfying pattern in the library to crank up. Try 200 cols.

**Rose.** Five-petal `r = cos(kθ)` curve. Change the `5` in the formula to any odd number for a different petal count (even numbers give twice as many).

**Mandala.** Concentric rings, each rotated by the golden angle from the next. Layered radial symmetry without any tedious by-hand placement.

**Heart.** A cardioid traced by the cells, the classic Valentine curve. Crank `cols` for a smooth outline; the highlighted size numbers in `fx` mode stretch it wider or taller.

## Three dimensions

These use the **Layers** axis — the grid becomes a Columns × Rows × Layers lattice, projected to 2D with depth cues (near dots larger and brighter, far ones smaller and dimmer). Raise **Layers** to add depth.

**Cube.** A 3D lattice of dots in oblique projection. The cleanest demonstration of the Layers axis.

**Cylinder.** A tube — columns wrap around, rows climb its height, layers add inner shells.

**Sphere.** A ball — columns as longitude, rows as latitude, layers nesting inward as shells.

**Torus.** A donut seen at a tilt, columns around the ring and rows around the tube.

**Helix.** A coil climbing the canvas. Set Layers to the strand count: 2 is a double helix (DNA), more a twisted rope.

**Spiral Tower.** Rings of dots stacked up the canvas, each rotated a little further — a helical tower. Layers is its height.

**Ring Tunnel.** Concentric rings receding into depth, near ones wide and bright, far ones small and dim. A tunnel to fly into.

**Wave Field.** A sheet of dots rippling as it recedes backward in depth. Layers is how far back it goes.

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

**Comet.** A trail of shapes that shrink and fade behind a bright head. Motion frozen in place. Great for tails, speed lines, and trailing UI states.

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
