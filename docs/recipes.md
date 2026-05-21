# Recipe cookbook

A bunch of "I want to make X" recipes. Each one is short, with the exact settings to dial in. Copy, adapt, ship.

## A row of icons that fades to the right

Useful for ghosted UI states, breadcrumbs, motion-trail effects.

Start a row of 12. Set Cols to 12, Rows to 1.

Transform: X = 32, all others 0.

Appearance: Opacity start 100, end 0. Easing `easeOut`.

That's it. The trick is the start/end opacity.

## A pulsing circle of dots

The default "loading" pattern.

Apply the **Radial Burst** pattern.

Cols around 16. Rows 1.

Optional: open Modulation and set the Scale wave to amplitude 0.3, frequency 1. Now the circle breathes.

## A grid with random rotations

Looks hand-placed without being hand-placed.

Start with a plain grid. Cols 8, Rows 8, X = 30, Y = 30.

On the Rotation slider, set the random (`±`) to 30.

Reroll the seed until you find a layout you like. Save snapshots as you go.

## A spiral of shrinking shapes

Vortex effect.

Apply the **Spiral** pattern.

Cols 80, Rows 1.

Tweak the `{x:N}` and `{y:N}` placeholders in the spiral formula to control radius growth.

In Transform, set Scale X and Scale Y start 1, end 0 with `easeIn` easing.

## A wave of text

Each character of a word floating in a sine wave.

You'll need to convert your word to one shape first. Easiest path: type the word, then *Type, Flatten* (or *Object, Outline Stroke*) so the whole word is one Vector.

Actually you want individual characters, so... type each character as its own text node, group them, then ungroup. Or use a plugin that splits a text node into letters. (Yeah, this part is a little fiddly. Not Swift Loop's fault.)

Pick one character. Open Swift Loop. Apply the **Wave** pattern.

Generate. Move the resulting loop so the wave sits where you want it.

Repeat for each character, offsetting the seed to make each one land differently.

## A polar dot grid (sci-fi radar)

Concentric rings, evenly spaced spokes.

Apply **Polar Grid**.

Cols controls spokes, Rows controls rings. Try 24 cols, 8 rows.

Optional: in Appearance, fade opacity from 100 to 30 with `easeOut` for a "signal weakens at the edges" feel.

## An organic scatter (no chaos, but no grid)

Phyllotaxis is the answer. It's the densest possible non-overlapping arrangement of points, and it looks completely natural.

Apply **Phyllotaxis**.

Cols 100 to 200. Rows 1.

The bigger you go, the more sunflower it looks.

## A starfield

Sparse, randomized, varying sizes.

Start with a small dot (a 4px circle).

Apply **Confetti** for randomness on position.

In Transform, set Scale X/Y random to 0.5 so dots vary in size.

Boost the X and Y range inside the formula if you want a wider field.

## A grid where every cell is a different color

Apply any grid pattern (Grid, Halftone, Hex Tile).

In Appearance, click the Fill swatch. Pick two colors. The fill now interpolates from color 1 to color 2 across the loop.

For a less linear feel, switch easing to `ease` and try `easeIn` versus `easeOut`.

## A radial halftone (faded edge circle)

Apply **Halftone**.

It's already radial-falloff by default. The interesting move is to also apply Phyllotaxis or Polar Grid first, then layer halftone-like scaling on top via formulas. Save that for when you're feeling adventurous.

## A clock face

12 rotating ticks around a circle.

Pick a thin rectangle (the "tick" shape).

Apply **Radial Burst**.

Set Cols to 12.

Each tick is now spaced 30 degrees apart, rotating outward. Done.

## When in doubt

The fastest design move with Swift Loop: pick a Library pattern that's about 60% of what you want, then tweak. Don't start from scratch in `fx` mode unless you really want to. The library is there for a reason.
