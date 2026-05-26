# Formulas for designers

Okay, so the sliders aren't enough. You want a spiral, or a sunflower, or a perfectly hexagonal lattice, and no combination of "X = 40 with a bit of rotation" is going to get you there.

That's what `fx` mode is for. And honestly? If you've ever written a CSS animation, played with Desmos, or stared at a generative art piece and thought "wait, I could do that", you can do this. Promise.

## Turning it on

Every Appearance row — and the colour gradients — has its own little `fx` button. Click it and that property's curve is replaced by a text field where the formula lives. The primary step on each axis (Column's X step, Row's Y step) has `fx` too; the cross-axis steps (Column's Y step, Row's X step) are plain sliders. If you need to describe a lattice entirely in math, the `x` / `y` formula fields are the full escape hatch.

Each property is independent: you can drive Rotation with a formula while Size stays a hand-drawn curve. The curve isn't thrown away either — clear the formula and your stops come right back.

## The shape of a formula

Every formula has the same skeleton:

```
propertyname = <some math>
```

So:

```
x = i * 30
```

means "for clone number `i`, X is 30 times that". With 10 clones, you get X = 0, 30, 60, 90, etc. Which is exactly what dragging the X slider to 30 already does. So why bother?

Because the right side can be anything. Like:

```
x = cos(i / 5) * 100
```

Which is "for clone number `i`, X is the cosine of (i over 5) times 100". That's a wave. You can't get that from sliders.

## The variables you have to work with

In every formula, these variables are defined for you:

`i` is the clone's index. 0 for the first clone, 1 for the second, all the way up.

`n` is the total number of clones.

`c` is the clone's column index.

`r` is the clone's row index.

`l` is the clone's layer index — the depth (Z) axis. It's 0 unless you set Layers above 1, which turns the grid into a Columns × Rows × Layers cube. Use it to write your own 3D projection, or start from the **Cube** library preset.

`cols`, `rows`, and `layers` are the grid dimensions (layers is the depth axis).

`t` is the most useful one. It's `i / (n - 1)`, so it goes from 0 to 1 across the whole loop. If you want anything to happen "smoothly across the loop", multiply or scale by `t`.

`tx` and `ty` are the same thing but for columns and rows. Smooth 0-to-1 horizontally and vertically. `tz` is the same across layers — 0 at the back, 1 at the front.

`w` and `h` are the source shape's width and height in pixels. Use these for tight tiling.

`seed` is the random seed. You probably won't reference it directly, but `rand()` uses it internally.

## The functions you have

All the usual suspects.

Trig: `sin`, `cos`, `tan`, and their inverses `asin`, `acos`, `atan`, `atan2`.

Roots and powers: `sqrt`, `pow`, `^` (the same as pow but shorter).

Logs and exp: `log`, `exp`.

Basic: `abs`, `min`, `max`, `floor`, `ceil`, `round`, `mod`.

And one wild card: `rand()`. Returns a fresh random number between 0 and 1 every time it's called. The seed makes this reproducible.

## Constants

`PI` is π.

`E` is Euler's number.

`TAU` is 2π, the size of a full circle in radians. You'll use this a lot. Anytime you're going around a circle, multiply by TAU.

## A few patterns to keep in your back pocket

**Spreading evenly across the loop.** Use `t`. `x = t * 400` puts the first clone at 0 and the last at 400.

**Going around a circle.** Polar coordinates: `x = cos(angle) * radius` and `y = sin(angle) * radius`. The angle is usually `t * TAU` (one full circle) or `t * TAU * k` (k full circles).

**Waves.** `sin(t * TAU * freq) * amplitude`. Pick the frequency (how many waves) and the amplitude (how tall).

**Distance from the center of a grid.** `sqrt((c - cols/2)^2 + (r - rows/2)^2)`. Useful for radial falloff in grid patterns.

**Alternating.** `i mod 2` gives you 0, 1, 0, 1. Multiply by something to turn it into an alternation.

**Random within a range.** `(rand() - 0.5) * width` gives you a number from `-width/2` to `+width/2`.

## A worked example

You want a spiral. Let's build it.

A spiral is "going around a circle, but with the radius growing as you go". Going around a circle is `cos(angle), sin(angle)`. We want the angle to be the loop progress, so `angle = t * TAU * 3` would go around three times.

Radius grows with `t`. So `radius = t * 200`.

Put it together:

```
x = cos(t * TAU * 3) * (t * 200)
y = sin(t * TAU * 3) * (t * 200)
```

Drop these into the X and Y formula fields in `fx` mode. Set cols to 60. You should see a spiral. The `3` controls how many turns, the `200` controls how wide.

That's everything you need to make a spiral. You just wrote a generative art pattern.

## When the formula fails

If you write something the engine can't evaluate (a typo, a divide by zero, a missing parenthesis), you'll see a red error message in the formula row and the clone for that property will fall back to its previous value. Fix the typo, the preview comes back.

## When you want to share what you made

If you've come up with something cool, you can save it as a library pattern. See [Contributing](../CONTRIBUTING.md) or paste the [LLM authoring guide](./llm-pattern-guide.md) into ChatGPT and have it write the JSON for you.

## Final encouragement

You don't need to understand all this at once. The best way to learn `fx` mode is to apply a Library pattern, turn on `fx`, and look at the formulas it's using. Tweak a number. See what changes. Tweak another. That's the whole pedagogy. Have fun.
