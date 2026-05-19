# Contributing to Swift Loop

## Adding a formula to the library

Anyone can contribute a pattern to the Swift Loop Formula Library.

### Steps

1. **Fork** this repo
2. **Create** a new file `library/<id>.json`. The `<id>` is a lowercase, hyphenated slug (e.g. `radial-burst`).
3. **Fill it in** using the schema below. Look at `library/radial-burst.json` for an example.
4. **Run** `bun run test library` to validate
5. **Open a PR** using the new-formula template

### Schema

```json
{
  "id": "my-pattern",
  "name": "My Pattern",
  "description": "One-sentence description.",
  "tags": ["tag1", "tag2"],
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

### Variables available in formulas

`i` (linear index), `n` (total cells), `c` (column), `r` (row), `cols`, `rows`,
`t` (i/(n-1), 0..1), `tx`, `ty`, `w` (source width), `h` (source height), `seed`.

### Functions

`sin cos tan asin acos atan atan2 sqrt pow exp log abs min max floor ceil round mod rand`

### Constants

`PI`, `E`, `TAU`

### Quality bar

CI checks that your formula parses and evaluates without errors. Human review checks:
- The pattern is visually coherent at seed=1
- It's meaningfully different from existing entries
- The description is accurate

That's it. Happy looping.
