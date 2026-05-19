// src/plugin/figma/async.ts

let loaded = false

/**
 * dynamic-page documentAccess requires pages to be loaded before traversal.
 * Call once at sandbox startup, then this is a no-op.
 */
export async function ensurePagesLoaded(): Promise<void> {
  if (loaded) return
  await figma.loadAllPagesAsync()
  loaded = true
}

export async function getNodeByIdAsync(id: string): Promise<BaseNode | null> {
  await ensurePagesLoaded()
  return figma.getNodeByIdAsync(id)
}
