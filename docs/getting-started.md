# Getting started

Okay, so you've never used Swift Loop. Let's fix that.

## You'll need Figma desktop

Not the browser version. Plugins loaded from a manifest only work in the desktop app. Sorry. Get it [here](https://www.figma.com/downloads/) if you don't have it.

(No Figma at all? Try the [browser playground](https://swift-loop.com/) — it's the same panel, running on a fake canvas.)

## Install the plugin

Three steps.

Grab the latest `swift-loop-vX.Y.Z.zip` from the [Releases page](https://github.com/Swiftner/swift-loop/releases/latest).

Unzip it somewhere you won't accidentally delete. `~/Documents/figma-plugins/` is fine.

In Figma, click *Plugins, Development, Import plugin from manifest…* and pick the `manifest.json` inside the unzipped folder.

That's the whole install. Swift Loop now lives in *Plugins, Development, Swift Loop* until the heat death of the universe. You only redo this when you want to upgrade.

## Your first loop

Draw a shape. Any shape. A 24×24 rectangle is a great starter. Just one of them.

Select it.

Open *Plugins, Development, Swift Loop*.

The panel opens. Type `20` into **Position X** (or just tap an Iterations chip). Copies of your shape march across the canvas, each one 20 pixels along from the last.

Welcome to looping.

## The controls, top to bottom

**Iterations** is how many copies you get. Tap a chip (5 to 40) or type any number into the field.

**Presets** is a dropdown with a few ready-made starting points — pick one and the panel fills itself in. A great way to see how the controls combine.

**Position** moves each copy. `X 40, Y 0` is a horizontal line; `X 20, Y 20` is a diagonal. Flip on **Random** to scatter instead.

**Rotation** turns each copy a little more than the one before — `10°` over 36 copies is a full circle. The `+/-` field adds a random wobble on top, and **Random** makes every angle a roll of the dice.

**Scale** grows or shrinks each copy, in pixels. `W 4, H 4` means every copy is 4 pixels wider and taller than the last.

**Opacity** fades the loop from a start percentage to an end one. `100 → 0` is the classic comet tail. **Random** gives each copy its own opacity.

**Fill** blends each copy's colour from one HEX value to another across the loop. Tick the checkbox to turn it on, then type your two colours.

**Stroke** does the same for outlines — two HEX colours, plus a start and end stroke width in pixels.

## Auto update, Create, and undo

At the bottom of the panel:

**Auto update** starts on, which means the canvas follows along as you type. Turn it off if you want to set up several values quietly and apply them in one go.

**Create** commits the panel's current settings. With Auto update off, this is the button that makes things happen.

**Undo / Redo** — the ↶ ↷ buttons, or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. Every change is one undo step. Iterate freely.

## What next

Honestly? Just play. Twenty copies, a bit of rotation, a fade — you'll be making nice things within a minute.

If something looks off, the [troubleshooting guide](./troubleshooting.md) covers the usual suspects.
