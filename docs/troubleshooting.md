# Troubleshooting

Common confusions, in roughly the order people hit them.

## The plugin won't show up in the menu

You imported the manifest in the browser version of Figma. Plugins loaded from a manifest only work in Figma desktop. Open Figma desktop and try the import there.

If you're already in desktop and it's still missing, check that you picked the actual `manifest.json` file (not just the folder) when importing.

## "Select a single Vector, Shape, Text, or Group"

That message at the top means Swift Loop can't loop your current selection. Causes:

You selected nothing.

You selected more than one object (Swift Loop needs exactly one to clone).

You selected a Frame or something Figma doesn't let plugins clone directly.

Fix: select exactly one Vector, Shape, Text node, or Group, then come back.

## Preview looks great, canvas looks different

A few things this could be:

You forgot to click Generate. The preview is just a preview until you do.

You hit Generate but the new group is outside your viewport. Press `Shift+1` or `Shift+2` to fit, then look for it.

You re-opened Swift Loop on the generated group instead of the original. Re-opening on the group will read its bounds as the source, which is usually not what you want. Select the original shape instead.

## I generated a loop and now I want to edit it

You can. The generated loop is a Group of real Figma nodes, fully editable. You can also:

Undo (Cmd/Ctrl+Z) until the generated group is gone, then re-open Swift Loop on the original to make a different version.

Select the original (not the generated group) and run Swift Loop again. Generate creates a fresh group, it doesn't replace the old one. You may want to delete the previous group first.

## Performance gets weird at high counts

Swift Loop renders all clones in real time, so once you get past a few thousand cells, your machine will start to feel it. Practical limits:

Around 1000 cells, totally fine on any machine.

Around 5000, still fine on most.

Past 10000, you'll feel it. Drop the count, or use a simpler pattern.

If you need a big arrangement, build it at smaller scale, generate, then scale the output group up on the canvas.

## "Formula error" on a property

In `fx` mode, if Swift Loop can't evaluate a formula, you'll see a red error message under the input. The clone for that property keeps its last working value while you sort it out.

Common causes:

Missing parenthesis or unbalanced parens.

Typo in a function name. Check the spelling against the [formulas reference](./formulas.md).

Reference to a variable that doesn't exist. Only the listed variables (`i`, `n`, `c`, `r`, `t`, `tx`, `ty`, `w`, `h`, `seed`, `cols`, `rows`) are available.

Division by zero, or `log` of a non-positive number.

The fix is almost always a typo. Read carefully.

## Sliders feel jumpy

If you're working on a laptop trackpad and the sliders are too sensitive, you can use the keyboard. Click any number, then use arrow keys to nudge. Shift+arrow for bigger steps. The numbers are also draggable horizontally (the `ScrubNum` control), which is sometimes more precise than the slider itself.

## My snapshots disappeared

Snapshots are stored in the plugin's local storage. They persist across plugin sessions but they're tied to the device. If you switched machines, or cleared Figma's plugin storage, they're gone. Sorry.

## I made something cool and want to save it as a pattern

Save it as a Snapshot first (it's automatic on reroll). Then, if you want to share it with others, package it as a library pattern. See [Contributing](../CONTRIBUTING.md) for how.

## Still stuck?

Open an issue on the [GitHub repo](https://github.com/Swiftner/swift-loop/issues). Include a screenshot of the preview and (if it's a formula thing) the exact formula text. We don't bite.
