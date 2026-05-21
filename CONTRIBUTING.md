# Contributing to Swift Loop

Pull requests welcome. By a wide margin, the most useful thing you can do is **add a pattern to the library**. We'd love that.

## Adding a pattern

Anyone can do this. There's no TypeScript and no build step, just one JSON file.

1. Fork this repo.
2. Make a new file at `library/<id>.json`. The `<id>` is a lowercase, hyphenated slug, like `radial-burst` or `flower-of-life` or `vortex`.
3. Fill it in using the schema below. The fastest way to learn the shape is to copy [`library/radial-burst.json`](./library/radial-burst.json) and start fiddling.
4. Run `bun run test library` to validate (this is what CI runs).
5. Open a PR using the new-formula template.

If you'd rather have an LLM help you, paste [`docs/llm-pattern-guide.md`](./docs/llm-pattern-guide.md) into your chat of choice, describe what you want, and let it do the math.

### Schema

```json
{
  "id": "my-pattern",
  "name": "My Pattern",
  "description": "One sentence. What does it look like?",
  "tags": ["radial", "organic"],
  "author": "@yourhandle",
  "cols": 24,
  "rows": 1,
  "formulas": {
    "x": "x = ...",
    "y": "y = ...",
    "rotation": "rotation = ..."
  }
}
```

### What you can use in formulas

Variables: `i` (linear index), `n` (total cells), `c` (column), `r` (row), `cols`, `rows`, `t` (i/(n-1), 0 to 1), `tx`, `ty`, `w` (source width), `h` (source height), `seed`.

Functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sqrt`, `pow`, `exp`, `log`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `mod`, `rand`.

Constants: `PI`, `E`, `TAU`.

### Quality bar

CI checks that your formula parses and evaluates without errors. A human then takes a look and asks:

Does it render coherently at `seed=1`?

Is it meaningfully different from what's already in the library?

Does the description match what the eye actually sees?

That's the whole bar. Don't overthink it. If it's pretty and it parses, it's in.

Happy looping.
