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

## I typed a value and nothing happened

Check the **Auto update** switch at the bottom of the panel. When it's off, edits stay in the panel until you press **Create**. When it's on (blue), the canvas should follow every change.

## Undo isn't doing what I expect

Inside the panel, the ↶ button (or Cmd/Ctrl+Z) steps back one change at a time — one undo, one step.

One thing to know: pressing Cmd/Ctrl+Z **on the canvas** (with the plugin window unfocused) runs Figma's own undo. The nodes revert, but the panel's fields may not follow until you click back into the plugin. If the panel and canvas ever disagree, change any value once and they'll fall back in sync.

## Performance gets weird at high counts

Swift Loop applies all copies in real time, so once you get past a few thousand, your machine will start to feel it. Practical limits:

Around 1,000 copies, totally fine on any machine.

Around 5,000, still fine on most.

Past 10,000, you'll feel it. Drop the count.

If you need a big arrangement, build it at a smaller count first, then duplicate the result on the canvas.

## My colours aren't showing up

The Fill and Stroke rows each have a checkbox — the colours only apply when it's ticked. And the fields want plain HEX (`FF6B00`), with or without the `#`.

## Where did the patterns / formulas / library go?

If you used an earlier Swift Loop with a pattern library, custom formulas, and modulation: that direction is paused, not deleted. We've gone back to the focused, faithful Looper panel first. The full version lives on the [`main-archive-2026-06`](https://github.com/Swiftner/swift-loop/tree/main-archive-2026-06) branch.

## Still stuck?

Open an issue on the [GitHub repo](https://github.com/Swiftner/swift-loop/issues). Include a screenshot of what you're seeing and what you expected. We don't bite.
