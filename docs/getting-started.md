# Getting started

Okay, so you've never used Swift Loop. Let's fix that.

## You'll need Figma desktop

Not the browser version. Plugins loaded from a manifest only work in the desktop app. Sorry. Get it [here](https://www.figma.com/downloads/) if you don't have it.

## Install the plugin

Three steps.

Grab the latest `swift-loop-vX.Y.Z.zip` from the [Releases page](https://github.com/Swiftner/swift-loop/releases/latest).

Unzip it somewhere you won't accidentally delete. `~/Documents/figma-plugins/` is fine.

In Figma, click *Plugins, Development, Import plugin from manifest…* and pick the `manifest.json` inside the unzipped folder.

That's the whole install. Swift Loop now lives in *Plugins, Development, Swift Loop* until the heat death of the universe. You only redo this when you want to upgrade.

## Your first loop

Draw a shape. Any shape. A 24x24 rectangle is a great starter. Just one of them.

Select it.

Open *Plugins, Development, Swift Loop*.

The plugin window opens, and you'll see your shape sitting in the preview area on the right.

## Drag a slider

Look at the **Column** section. There's an `X step` showing `60` (and a matching `Y step` in **Row**). Drag `X step`. Watch the preview.

You should see 100 copies of your shape arranged in a 10x10 grid, each one 60 pixels further along the X axis than the last.

Welcome to looping.

## Try a preset

Look at the **Presets** section. Click one. Try "Spin". The whole UI rearranges to show that preset's settings, and the preview updates instantly.

This is the fastest way to learn what's possible. Click through the presets. Read what changed. Mess with it.

## Try the Library

Below Presets, you'll find the **Library**. 33 patterns by name. Click **Phyllotaxis** and you should see a sunflower. Click **Halftone** and you'll get a dot pattern that fades from the center.

Library patterns are like presets, but they use formulas under the hood. Which means they can do things sliders can't, like spirals and waves and golden-angle phyllotaxis.

## Commit it

Found something you like? Click **Generate** at the bottom.

This is the moment the loop becomes real geometry on your canvas. Up until you click Generate, the preview is just a preview. Closing the plugin without generating throws it away.

After Generate:

The loop is now a Group on your canvas, fully editable.

Cmd/Ctrl+Z still works, all the way back to where you started.

You can re-open Swift Loop on the original shape (not the group) to try a different version.

## What next

Keep clicking around. Honestly, that's the best way. If you want to read more:

[Controls reference](./controls.md) for what every slider does.

[Recipe cookbook](./recipes.md) for things to try making.

[Pattern gallery](./pattern-gallery.md) for the built-in library, illustrated.
