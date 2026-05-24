# Swift Loop: pattern authoring guide for LLMs

> **For designers:** copy this whole file into your favorite LLM chat (Claude, ChatGPT, Gemini, whichever you like) before asking it to design a Swift Loop pattern with you. It contains everything the model needs in one place. Then say something like *"I want a pattern that looks like X. Walk me through it and give me the final JSON."*

---

## What Swift Loop is

Swift Loop is a Figma plugin that takes one shape and stamps `cols × rows` copies of it across the canvas. Each copy can be moved, rotated, scaled, and faded individually. The fun starts when those per-copy values come from **formulas**, which are short math expressions that compute a property based on the copy's index, column, row, and so on.

A **library pattern** is a tiny JSON file (a few hundred bytes) that bundles a set of formulas under a name. Users click the pattern in Swift Loop's Library and get an instant arrangement on the canvas.

You, the LLM reading this, are helping a designer write a new library pattern. Your output, ultimately, is one JSON file that conforms to the schema below.

## The schema

```json
{
  "id": "my-pattern",
  "name": "My Pattern",
  "description": "One sentence. What does it visually look like?",
  "tags": ["radial", "organic"],
  "author": "@username",
  "cols": 24,
  "rows": 1,
  "angle": 0,
  "showFirst": true,
  "formulas": {
    "x": "x = ...",
    "y": "y = ...",
    "rotation": "rotation = ...",
    "scaleX": "scaleX = ...",
    "scaleY": "scaleY = ...",
    "opacity": "opacity = ..."
  },
  "ramps": {
    "opacity": { "stops": [{ "value": 100, "position": 0 }, { "value": 0, "position": 1 }] }
  },
  "angleRamp": { "stops": [{ "value": 3, "position": 0 }, { "value": 24, "position": 1 }] }
}
```

### Field rules

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Lowercase kebab-case, matches `^[a-z0-9-]+$`. Becomes the filename: `library/<id>.json`. |
| `name` | yes | 1 to 40 chars. Title-case, human-readable. |
| `description` | recommended | 200 chars max. One sentence. Describe what it looks like, not how the math works. Good: *"Concentric rings expanding from the center."* Bad: *"Polar coordinates with t as the angle."* |
| `tags` | recommended | Up to 8 strings. Reuse existing tags when you can (see below). |
| `author` | recommended | `@handle` form. |
| `cols` | yes | Integer 1 to 100. The default column count when the pattern loads. |
| `rows` | yes | Integer 1 to 100. The default row count. Use `1` for linear or radial patterns. |
| `layers` | optional | Integer 1 to 100. Depth layers (Z) — turns the grid into a Columns × Rows × Layers lattice. Each cell's `l`/`layers`/`tz` are exposed to formulas, which project it to 2D (there is no built-in projection). Default `1` (flat). See the `Cube` preset. |
| `angle` | optional | Number, -360 to 360. Per-cell rotation in degrees applied to the grid offset around the source center, *after* the formulas compute `x` and `y`. Cell `i` is rotated by `angle * i`. Lets a pattern declare a spiral or swirl without folding the rotation into every formula. Default `0`. See "Using `angle`" below. |
| `showFirst` | optional | Defaults to `true`. Set to `false` only for radial or spiral patterns where the `i=0` clone naturally lands away from the origin, and you want the source shape to stay visually centered. See "showFirst" below. |
| `formulas` | yes | Object. Any subset of `x`, `y`, `rotation`, `scaleX`, `scaleY`, `opacity`. Omit properties that should stay at their default. |
| `ramps` | optional | Object. Pre-built multi-stop curves for `rotation`, `scaleX`, `scaleY`, `opacity`, or `strokeWeight` — a hand-drawn fade or taper instead of a formula. Each is `{ "stops": [{ "value": n, "position": 0..1 }, …] }`, sampled along loop progress (one stop = a constant). Applied with fx off; a `formula` for the same property wins. |
| `angleRamp` | optional | A `{ "stops": […] }` curve for the **Spiral** lean. Cell `i` leans by `ramp(t_i) * i`, so a small→large curve tightens the spiral along the loop. Supersedes the scalar `angle`. |

### Existing tags (please reuse)

`radial`, `grid`, `wave`, `curve`, `linear`, `random`, `chaos`, `spiral`, `polar`, `rotation`, `scale`, `tiling`, `organic`, `arc`, `physics`, `3d`.

Only invent a new tag when nothing existing fits.

## The formula language

Each formula is a single expression that assigns to its property: `propertyname = <expression>`. The `propertyname = ` prefix is mandatory.

### Variables in scope

Every formula has access to these:

| Var | Meaning | Range |
|---|---|---|
| `i` | Linear clone index | `0` to `n-1` |
| `n` | Total clones | `cols * rows * layers` |
| `c` | Column index | `0` to `cols-1` |
| `r` | Row index | `0` to `rows-1` |
| `l` | Layer index (depth/Z) | `0` to `layers-1` |
| `cols` | Column count | from config |
| `rows` | Row count | from config |
| `layers` | Layer count | from config |
| `t` | Normalized index | `i / (n-1)`, so `0` to `1` across the whole loop |
| `tx` | Normalized column | `c / (cols-1)`, so `0` to `1` across columns |
| `ty` | Normalized row | `r / (rows-1)`, so `0` to `1` across rows |
| `tz` | Normalized layer | `l / (layers-1)`, so `0` to `1` from back to front |
| `w` | Source shape width | px |
| `h` | Source shape height | px |
| `seed` | Random seed | integer, user-controllable |

### Functions

`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sqrt`, `pow`, `exp`, `log`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `mod`, `rand`.

Notes:

All trig functions take **radians**, not degrees.

`rand()` returns a fresh number in `[0, 1)` each call. It's deterministic per `seed`, so the same seed gives the same arrangement.

`mod` works as a function (`mod(a, b)`) or an infix operator (`a mod b`). Both fine.

`^` is the power operator. `x^2` is `x` squared.

### Constants

`PI`, `E`, `TAU` (which is 2π).

### Property output ranges

| Property | Unit | Sensible range |
|---|---|---|
| `x`, `y` | pixels offset from source | hundreds, typically |
| `rotation` | degrees | usually 0 to 360, or multiples |
| `scaleX`, `scaleY` | multiplier | 0 is invisible, 1 is original size, 2 is double |
| `opacity` | percent | 0 to 100 (the engine clamps) |

### Tweakable parameters: `{x:N}` placeholders

A formula can contain `{x:200}` or `{y:150}` literals. These are **default values** that the user can scrub in the UI without losing the formula. Use this when your pattern has a natural "size" knob the user might want to adjust:

```json
"x": "x = cos(t * TAU) * {x:200}"
```

The `200` is the default. The `x:` prefix tells the UI which slider scope it belongs to. Use `{x:N}` for X-axis sizes and `{y:N}` for Y-axis sizes. The number can be any positive integer.

## Using `angle`

`angle` is shorthand for "rotate each cell's offset by `angle * i` degrees around the source center, after the formulas compute it". It's evaluated *outside* the formula language, so you don't need trig in your formulas to make a spiral.

When to use it:

- **A line that should curl into a spiral.** Set `cols` high, `rows: 1`, give `x` a linear formula like `x = c * 14`, then set `angle: 18`. The line bends into a spiral. The math is doing exactly the same thing as `x = cos(c * 18deg) * c * 14` / `y = sin(c * 18deg) * c * 14`, but without the trig and without coupling the two formulas. Easier to read, easier for the user to tweak in the slider.
- **A rectangular grid that should swirl.** Give `x = c * w` and `y = r * h`, set `angle: 6`. The grid rotates progressively as `i` grows. Looks like a fingerprint.

When *not* to use it:

- The pattern is already polar (`x` and `y` are `cos(...)` and `sin(...)`). Adding `angle` rotates *that* arrangement on top, which usually looks muddled. Leave `angle: 0`.
- The pattern has formulas that explicitly want to define the geometry. `angle` exists for the cases where you'd otherwise have to write trig you don't want to write.

`angle` composes with everything. Random jitter, sinusoidal layers, scale changes all still apply per cell. The rotation happens last, on the final `(x, y)` offset.

## `showFirst`

By default, Swift Loop renders a clone at `i=0`, which is the user's source shape sitting at its original position. For most grid-style patterns this is exactly right.

For radial patterns where `i=0` is offset away from the center (like `x = cos(t * TAU) * 150`, which puts `i=0` at `(150, 0)`), the source shape would visually sit *off* the arrangement, which looks broken. Set `showFirst: false` for these. The source then represents the visual center, and only `i=1...n-1` clones get rendered in the preview.

Quick heuristic: if your formula uses `cos(...)` or `sin(...)` or `atan2(...)` for both `x` AND `y`, you probably want `showFirst: false`.

## Worked examples

### A spiral

```json
{
  "id": "spiral",
  "name": "Spiral",
  "description": "Expanding logarithmic spiral.",
  "tags": ["spiral", "radial"],
  "author": "@swiftner",
  "cols": 60,
  "rows": 1,
  "formulas": {
    "x": "x = cos(t * TAU * 4) * (t * {x:200})",
    "y": "y = sin(t * TAU * 4) * (t * {y:200})",
    "rotation": "rotation = t * 720"
  }
}
```

What's going on: the angle sweeps four full turns (`t * TAU * 4`), and the radius grows linearly with `t`. Rotation spins each clone twice over the full loop.

### A spiral via `angle` (no trig needed)

```json
{
  "id": "curl",
  "name": "Curl",
  "description": "Linear arrangement curled into a spiral via per-cell angle.",
  "tags": ["spiral", "radial"],
  "author": "@swiftner",
  "cols": 40,
  "rows": 1,
  "angle": 18,
  "formulas": {
    "x": "x = c * {x:14}",
    "y": "y = 0",
    "rotation": "rotation = c * {rotation:18}"
  }
}
```

Compare to the trig-based `spiral` pattern: same shape family, but you can keep the formulas linear and the user can scrub Angle directly. Useful when the visual idea is "a straight thing that curls".

### A sunflower (phyllotaxis)

```json
{
  "id": "phyllotaxis",
  "name": "Phyllotaxis",
  "description": "Sunflower seed pattern via golden angle (~137.5°).",
  "tags": ["radial", "organic"],
  "author": "@swiftner",
  "cols": 100,
  "rows": 1,
  "formulas": {
    "x": "x = cos(i * 2.39996) * sqrt(i) * 18",
    "y": "y = sin(i * 2.39996) * sqrt(i) * 18"
  }
}
```

`2.39996` is the golden angle in radians. The `sqrt(i)` radius keeps the seed density uniform, which is the whole trick.

### A hex tiling

```json
{
  "id": "hex-tile",
  "name": "Hex Tile",
  "description": "Offset every other row for hexagonal packing.",
  "tags": ["grid", "tiling"],
  "author": "@swiftner",
  "cols": 8,
  "rows": 8,
  "formulas": {
    "x": "x = c * w + (r mod 2) * w / 2",
    "y": "y = r * h * 0.866"
  }
}
```

Notice this uses `w` and `h` (the source shape's size), so it tiles tightly regardless of how big the user's shape is. `0.866` is roughly √3/2, the vertical packing ratio for hexagons.

### A randomized burst

```json
{
  "id": "confetti",
  "name": "Confetti",
  "description": "Heavy random jitter on position and rotation.",
  "tags": ["random", "chaos"],
  "author": "@swiftner",
  "cols": 40,
  "rows": 1,
  "formulas": {
    "x": "x = (rand() - 0.5) * 400",
    "y": "y = (rand() - 0.5) * 400",
    "rotation": "rotation = rand() * 360",
    "opacity": "opacity = 40 + rand() * 60"
  }
}
```

`rand() - 0.5` centers the random range around zero. Multiply for spread.

### A halftone grid

```json
{
  "id": "halftone",
  "name": "Halftone",
  "description": "Grid where cells shrink and fade with distance from the center.",
  "tags": ["grid", "scale", "radial"],
  "author": "@swiftner",
  "cols": 10,
  "rows": 10,
  "formulas": {
    "x": "x = c * w",
    "y": "y = r * h",
    "scaleX": "scaleX = 1 - sqrt((c - cols / 2)^2 + (r - rows / 2)^2) / 8",
    "scaleY": "scaleY = 1 - sqrt((c - cols / 2)^2 + (r - rows / 2)^2) / 8",
    "opacity": "opacity = 100 - sqrt((c - cols / 2)^2 + (r - rows / 2)^2) * 12"
  }
}
```

`sqrt((c - cols/2)^2 + (r - rows/2)^2)` is the standard distance-from-center expression. You'll use it often.

## Useful idioms

Distance from center:

```
sqrt((c - cols/2)^2 + (r - rows/2)^2)
```

Angle from center (polar coordinate):

```
atan2(r - rows/2, c - cols/2)
```

Wave across rows:

```
sin(tx * TAU * <frequency>) * <amplitude>
```

Decay (fading toward the edges):

```
exp(-i * <decay-rate>)
```

Alternation (every other one):

```
(i mod 2)        // 0, 1, 0, 1, ...
(-1)^i           // -1, +1, -1, +1, ...
```

Evenly distributing N items around a full circle:

```
i * TAU / n
```

Or, equivalently, using the `angle` field instead of trig:

```json
"cols": <n>, "angle": 360 / <n>,
"formulas": { "x": "x = <radius>", "y": "y = 0" }
```

## Quality checklist

Before finalizing a pattern, check:

The pattern looks coherent at the default `cols` and `rows`. Don't ship something that only works when the user cranks `cols` to 80.

It's visually distinct from existing patterns. Diversify the library.

The description matches what the eye sees, not what the math does.

No references to undefined variables or functions. Only use what's listed in this doc.

Output magnitudes are reasonable. `x = i * 1000` is 80,000px for 80 clones, way off screen.

`showFirst` is set correctly (see the heuristic above).

Tags use existing terms where possible.

## Validation

Once the designer has the JSON, they can validate locally with `bun run test library`. As long as your output respects the schema and only uses the listed variables and functions, CI will pass.

## How to help the designer

Designers usually describe what they want visually, not mathematically. Your job is translation. Here's the kind of conversation you should be having:

> **Designer:** "I want shapes that fly outward from the center, getting smaller as they go."

You should hear: radial layout, with scale shrinking as distance from center grows. Sketch the math:

`x = cos(angle) * radius`

`y = sin(angle) * radius`

where `angle = t * TAU` and `radius = t * <some-size>`

and `scaleX = scaleY = 1 - t * 0.8`

Then show the JSON and explain in one sentence what each formula does. Offer to iterate: *"Want the shrinking to be more dramatic? Change `0.8` to `0.95`."*

Don't dump pure math. Use words. Show, then explain.

When the designer says "make it more X" (more chaotic, more compact, more circular), find the **one number** in the formula that controls that, and propose a change to just that number. That's the whole game.

---

That's everything. The schema, the language, the idioms, the examples, the vibe. You're ready to help.
