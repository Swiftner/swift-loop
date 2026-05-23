// Assembles the Penpot plugin bundle into build/penpot/.
//
// Prerequisite: `bun run build` has produced build/ui.js (the shared
// @create-figma-plugin UI bundle). This script then:
//   1. bundles the Penpot plugin entry → build/penpot/plugin.js
//   2. copies build/ui.js → build/penpot/ui.js
//   3. writes build/penpot/ui.html (loads ui.js, same shim as preview-ui.html)
//   4. copies manifest.penpot.json → build/penpot/manifest.json
//
// The actual in-Penpot run is unverified in CI — load build/penpot/manifest.json
// in Penpot (Plugins → development) to smoke-test.

import { execFileSync } from 'node:child_process'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'build/penpot')
const uiBundle = resolve(root, 'build/ui.js')
const penpotStyles = resolve(root, 'node_modules/@penpot/plugin-styles/styles.css')

// Penpot's native palette lives in @penpot/plugin-styles, but that file also
// ships a remote font @import, global resets (e.g. `*{border-width:0}`) and a
// full UI-kit — all of which would clobber our own layout. We want ONLY the
// color custom properties (--db-primary, --lf-secondary, --la-primary, …),
// which the package defines in a single unconditional :root{} block. styles.css
// maps our tokens onto these under [data-theme] (set from penpot.theme).
async function penpotColorVars() {
  const css = await readFile(penpotStyles, 'utf8')
  const block = css.match(/:root\{[^}]*--db-primary[^}]*\}/)
  if (!block) {
    throw new Error(
      `Could not find the color-variable :root block in ${penpotStyles}. ` +
        'The @penpot/plugin-styles layout may have changed — update build-penpot.mjs.',
    )
  }
  return block[0]
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

if (!(await exists(uiBundle))) {
  console.error('build/ui.js missing — run `bun run build` first (build:penpot does this).')
  process.exit(1)
}

await mkdir(outDir, { recursive: true })

// 1. Bundle the plugin entry. Penpot provides the `penpot` global at runtime.
execFileSync(
  'bun',
  [
    'build',
    'src/plugin/hosts/penpot/entry.ts',
    `--outfile=${resolve(outDir, 'plugin.js')}`,
    '--target=browser',
  ],
  { cwd: root, stdio: 'inherit' },
)

// 2. Reuse the Figma-built UI bundle verbatim.
await copyFile(uiBundle, resolve(outDir, 'ui.js'))

// 3. Standalone UI host page (mirrors preview-ui.html). The create-figma-plugin
// runtime mounts into #create-figma-plugin and reads these two globals.
const uiHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Swift Loop</title>
    <style>
      /* Penpot native palette (color vars only — see build-penpot.mjs). */
      ${await penpotColorVars()}
      html, body { margin: 0; height: 100%; background: var(--bg, #fff); }
      body { font: 12px/1.4 system-ui, sans-serif; color: var(--fg, #222); }
      #create-figma-plugin { height: 100%; }
    </style>
  </head>
  <body>
    <div id="create-figma-plugin"></div>
    <script>
      window.__FIGMA_COMMAND__ = '';
      window.__SHOW_UI_DATA__ = {};
    </script>
    <script src="./ui.js"></script>
  </body>
</html>
`
await writeFile(resolve(outDir, 'ui.html'), uiHtml)

// 4. Manifest.
await copyFile(resolve(root, 'manifest.penpot.json'), resolve(outDir, 'manifest.json'))

console.log('Built Penpot plugin → build/penpot/ (manifest.json, plugin.js, ui.html, ui.js)')
