// src/plugin/hosts/penpot/entry.ts
// Penpot plugin entry. Bundled to build/penpot/plugin.js and named in
// manifest.penpot.json's `code` field. Runs in Penpot's plugin runtime, where
// the `penpot` global is provided.

import { startHostLoop } from '../../host-loop'
import { PenpotAdapter } from './adapter'
import { PenpotBridge } from './bridge'

const DEFAULT_SIZE = { width: 320, height: 720 }

// Open the iframe UI (the same @create-figma-plugin bundle the Figma build
// ships, served as ui.html alongside this file). `?theme=` lets the UI match
// Penpot's theme if it wants to.
penpot.ui.open('Swift Loop', `ui.html?theme=${penpot.theme}`, DEFAULT_SIZE)

const adapter = new PenpotAdapter(penpot)
const bridge = new PenpotBridge(penpot)
startHostLoop(adapter, bridge)

// Keep the UI's theme in sync after the initial `?theme=` above: Penpot fires
// `themechange` when the user switches light/dark, and the UI applies it via
// its `theme` channel (see src/ui/theme.ts).
penpot.on('themechange', (theme) => bridge.send('theme', theme))
