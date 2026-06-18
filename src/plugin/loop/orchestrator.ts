// src/plugin/loop/orchestrator.ts
import type { LoopConfig } from '../../shared/types'
import { cellCount, evaluateCell } from '../engine/cells'
import { compileConfig, compileFactors } from '../engine/compile'
import type { HostAdapter, NodeSnapshot } from '../hosts/host'
import { applyToClone } from './apply'
import { type DiffResult, type DirtyProperty, diffConfig } from './diff'
import type { LastRunStore } from './state'

// Which node types can be looped is the adapter's call — `getSelectedNode`
// only ever hands back a supported selection (each host has its own type
// vocabulary). The orchestrator stays host-neutral and trusts the snapshot.

interface GenerateInput {
  adapter: HostAdapter
  source: NodeSnapshot
  config: LoopConfig
  previousConfig: LoopConfig | null
  store: LastRunStore
  commit: boolean
}

export async function generate(input: GenerateInput): Promise<void> {
  const { adapter, source, config, previousConfig, store, commit } = input

  const prevRecord = store.get()
  const diff = diffConfig(
    previousConfig,
    config,
    prevRecord
      ? {
          previousSourceId: prevRecord.originalId,
          currentSourceId: source.id,
        }
      : null,
  )

  if (diff.mode === 'noop') return

  // Bracket the committed mutation so it's one undo step. The finally guarantees
  // the block closes even if a mutation throws (a dangling block would wedge
  // Penpot's history).
  if (commit) adapter.beginUndoBlock()
  try {
    if (diff.mode === 'full') {
      await fullRegen(adapter, source, config, store)
    } else {
      await inPlaceMutation(adapter, source, config, store, diff)
    }
  } finally {
    if (commit) adapter.endUndoBlock()
  }
}

async function fullRegen(
  adapter: HostAdapter,
  source: NodeSnapshot,
  config: LoopConfig,
  store: LastRunStore,
): Promise<void> {
  // remove previous clones and unwrap the previous SwiftLoopGroup so we don't
  // nest a new group inside it on every regen.
  const prev = store.get()
  // On regen the selected source lives inside the old SwiftLoopGroup, so its
  // snapshot parentId points at a group we're about to delete. When we reparent
  // the source back out, the new clones + group must target that original
  // parent (prev.parentId) — not the stale snapshot value.
  let parentId = source.parentId
  if (prev) {
    const groupLive = await adapter.nodeExists(prev.groupId)
    const parentLive = await adapter.nodeExists(prev.parentId)
    // Edge case: the old group survives but its original parent is gone. The
    // source still lives inside the group, so removing the group would
    // cascade-delete the source. Bail without touching anything rather than
    // destroying the user's work.
    if (groupLive && !parentLive) return

    for (const id of prev.cloneIds) {
      await adapter.removeNode(id)
    }
    if (groupLive) {
      // parentLive is true here. Reparent the source out of the old group,
      // then drop the group; the rebuilt loop targets the original parent.
      await adapter.reparentNode(source.id, prev.parentId)
      parentId = prev.parentId
      await adapter.removeNode(prev.groupId)
    }
  }

  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  if (!parentId) return

  const n = Math.min(adapter.maxCells, cellCount(config))

  // Clone creation order sets z-order: each insertChild(0) shoves earlier clones
  // toward the front. Default near-top = natural order (front layer ends on top).
  // far-top creates deep layers first so they finish in front.
  const order: number[] = []
  for (let i = 1; i < n; i++) order.push(i)
  if ((config.layers ?? 1) > 1 && (config.stackOrder ?? 'near-top') === 'far-top') {
    const perLayer = config.cols * config.rows
    order.sort((a, b) => Math.floor(b / perLayer) - Math.floor(a / perLayer))
  }

  // Indexed by cell i so in-place updates (which address cloneIds[i-1]) stay
  // correct no matter what order we created the clones in.
  const cloneById: string[] = new Array(n)
  for (const i of order) {
    const cloneId = await adapter.cloneNode(source.id, {
      parentId,
      index: 0,
      name: `${source.name}_${i}`,
    })

    const cell = evaluateCell(i, {
      config,
      compiled,
      factors,
      sourceWidth: source.width,
      sourceHeight: source.height,
    })
    await applyToClone({
      adapter,
      cloneId,
      source,
      values: {
        x: cell.x,
        y: cell.y,
        rotation: cell.rotation,
        scaleX: cell.scaleX,
        scaleY: cell.scaleY,
        opacity: cell.opacity,
      },
      fill: config.fill,
      stroke: config.stroke,
      strokeWeight: cell.strokeWeight,
      fillFactor: cell.fillFactor,
      strokeFactor: cell.strokeFactor,
      fillColor: cell.fillColor,
      strokeColor: cell.strokeColor,
      freshClone: true,
      dirty: new Set<string>([
        'x',
        'y',
        'rotation',
        'scaleX',
        'scaleY',
        'opacity',
        'fill',
        'stroke',
        'strokeWeight',
      ]),
    })

    cloneById[i] = cloneId
  }

  const cloneIds = cloneById.slice(1)

  const groupId = await adapter.groupNodes([source.id, ...cloneIds], {
    parentId,
    name: 'SwiftLoopGroup',
  })

  store.set({
    originalId: source.id,
    parentId,
    cloneIds,
    groupId,
  })

  adapter.scrollIntoView(groupId)
}

async function inPlaceMutation(
  adapter: HostAdapter,
  source: NodeSnapshot,
  config: LoopConfig,
  store: LastRunStore,
  diff: DiffResult,
): Promise<void> {
  const prev = store.get()
  if (!prev) return

  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  const dirty = new Set<string>(diff.dirty as DirtyProperty[])
  const n = Math.min(adapter.maxCells, cellCount(config))

  for (let i = 1; i < n; i++) {
    const cloneId = prev.cloneIds[i - 1]
    if (!cloneId) continue
    if (!(await adapter.nodeExists(cloneId))) continue

    const cell = evaluateCell(i, {
      config,
      compiled,
      factors,
      sourceWidth: source.width,
      sourceHeight: source.height,
    })
    await applyToClone({
      adapter,
      cloneId,
      source,
      values: {
        x: cell.x,
        y: cell.y,
        rotation: cell.rotation,
        scaleX: cell.scaleX,
        scaleY: cell.scaleY,
        opacity: cell.opacity,
      },
      fill: config.fill,
      stroke: config.stroke,
      strokeWeight: cell.strokeWeight,
      fillFactor: cell.fillFactor,
      strokeFactor: cell.strokeFactor,
      fillColor: cell.fillColor,
      strokeColor: cell.strokeColor,
      dirty,
    })
  }
}

export async function revert(adapter: HostAdapter, store: LastRunStore): Promise<void> {
  const prev = store.get()
  if (!prev) return
  for (const id of prev.cloneIds) {
    await adapter.removeNode(id)
  }
  // unwrap the original source out of the SwiftLoopGroup before discarding it
  if (await adapter.nodeExists(prev.groupId)) {
    if ((await adapter.nodeExists(prev.originalId)) && (await adapter.nodeExists(prev.parentId))) {
      await adapter.reparentNode(prev.originalId, prev.parentId)
    }
    await adapter.removeNode(prev.groupId)
  }
  store.clear()
}
