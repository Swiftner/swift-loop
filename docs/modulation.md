# Modulation

This is where Swift Loop gets actually interesting. A perfect grid is boring. Add a little wave or a little noise and suddenly it's alive.

## Two flavors of modulation

Swift Loop has two ways to modulate a property: **sine waves** and **randomness**. They live in different places in the UI but they do similar things.

### Sine waves

The Modulation section has two sine wave layers, one for **Rotation** and one for **Scale**. Each layer has three knobs.

**Amplitude.** How strong the wave is. 0 means it's off. Higher is louder.

**Frequency.** How many cycles fit across the whole loop. 1 means one full wave from start to end. 4 means four waves.

**Phase.** Where the wave starts in its cycle. Shift it to slide the pattern left or right.

Try this: apply a plain 1x20 row, set X = 30, then set Rotation wave amplitude to 30, frequency to 2. Watch your row wobble.

### Randomness

Randomness is a **ramp** too — a curve you drag, sampled along the loop, where the value is the ± jitter amount. A flat line means even jitter everywhere; a rising line means the loop gets noisier toward the end.

Position jitter lives in the **Column / Row / Layer** sections as their **Random** ramp. Per-property jitter (Rotation, Size X, Size Y, Opacity) lives in the **Modulation** section under **Random ±**.

So a flat Column Random of 10 means every clone is offset by ±10 pixels horizontally. The seed controls "which random." Same seed always gives the same arrangement.

Bigger random equals more chaos. Scrub the seed (in the History section) to get a fresh roll.

## When to reach for which

Use **sine waves** when you want repeating, predictable motion. They look like waves because they are waves. Great for ribbons, ripples, oscillations, anything where the eye wants to follow a curve.

Use **randomness** when you want the loop to feel hand-placed, organic, lived-in. Confetti, scattered stars, organic mess.

Use **both** when you want it to feel natural but also intentional. A sine-wave row with a tiny bit of random opacity feels alive without feeling sloppy.

## Recipes

### Gentle wobble

A row that looks straight at first glance but feels a little off in a nice way.

X = 30, Cols 20, Rotation wave amplitude 5, frequency 3.

### Organic grid

8x8 grid with X step = 30, Y step = 30, the Column and Row Random ramps set to 4 (position jitter), and the Modulation Rotation random set to 4. Looks like a hand-drawn paper texture.

### Pulsing radial

Apply Radial Burst, then Scale wave amplitude 0.3, frequency 1. Each clone breathes in and out across the circle.

### Hard randomness

Confetti (the library pattern) is the loudest version of this. Apply it, then crank `cols` until the canvas is dense enough.

## A note on randomness and easing

Randomness happens **after** easing is applied, so a randomized opacity fade is still mostly a fade, just with some jitter on top. This is usually what you want.

## Tip

When you're modulating something, scrub the **seed** in the History section. Watch the loop reconfigure. Some seeds will be perfect. Stop on the one you love and click Generate.
