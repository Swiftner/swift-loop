// src/plugin/loop/orchestrator.ts
import type { LoopConfig } from '../../shared/types'
import { evaluateCell } from '../engine/cells'
import { compileConfig, compileFactors } from '../engine/compile'
import type { HostAdapter, NodeSnapshot } from '../hosts/host'
import { applyToClone } from './apply'
import { type DiffResult, type DirtyProperty, diffConfig } from './diff'
import type { LastRunStore } from './state'

const SUPPORTED_TYPES = [
  'VECTOR',
  'STAR',
  'LINE',
  'ELLIPSE',
  'POLYGON',
  'RECTANGLE',
  'TEXT',
  'GROUP',
]

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
  if (!SUPPORTED_TYPES.includes(source.type)) return

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

  if (diff.mode === 'full') {
    await fullRegen(adapter, source, config, store)
  } else {
    await inPlaceMutation(adapter, source, config, store, diff)
  }

  if (commit) adapter.commitUndoStep()
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
    for (const id of prev.cloneIds) {
      await adapter.removeNode(id)
    }
    if (await adapter.nodeExists(prev.groupId)) {
      if (await adapter.nodeExists(prev.parentId)) {
        await adapter.reparentNode(source.id, prev.parentId)
        parentId = prev.parentId
      }
      await adapter.removeNode(prev.groupId)
    }
  }

  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  if (!parentId) return

  const n = config.cols * config.rows
  const cloneIds: string[] = []

  for (let i = 1; i < n; i++) {
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
      strokeWeight: config.strokeWeight,
      fillFactor: cell.fillFactor,
      strokeFactor: cell.strokeFactor,
      strokeWeightFactor: cell.strokeWeightFactor,
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

    cloneIds.push(cloneId)
  }

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
  const n = config.cols * config.rows

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
      strokeWeight: config.strokeWeight,
      fillFactor: cell.fillFactor,
      strokeFactor: cell.strokeFactor,
      strokeWeightFactor: cell.strokeWeightFactor,
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
