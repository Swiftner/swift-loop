// src/plugin/loop/orchestrator.ts
import type { LoopConfig, Scope } from '../../shared/types'
import { type CompiledFactors, compileConfig, compileFactors } from '../engine/compile'
import { applyEasing } from '../engine/easing'
import { buildScope } from '../engine/scope'
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
  source: SceneNode
  config: LoopConfig
  previousConfig: LoopConfig | null
  store: LastRunStore
  commit: boolean
}

export async function generate(input: GenerateInput): Promise<void> {
  const { source, config, previousConfig, store, commit } = input
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
    await fullRegen(source, config, store)
  } else {
    await inPlaceMutation(source, config, store, diff)
  }

  if (commit) figma.commitUndo()
}

async function fullRegen(
  source: SceneNode,
  config: LoopConfig,
  store: LastRunStore,
): Promise<void> {
  // remove previous clones and unwrap the previous SwiftLoopGroup so we don't
  // nest a new group inside it on every regen.
  const prev = store.get()
  if (prev) {
    for (const id of prev.cloneIds) {
      const n = await figma.getNodeByIdAsync(id)
      if (n && !n.removed) n.remove()
    }
    const oldGroup = await figma.getNodeByIdAsync(prev.groupId)
    if (oldGroup && !oldGroup.removed) {
      const originalParent = await figma.getNodeByIdAsync(prev.parentId)
      if (originalParent && !originalParent.removed && 'appendChild' in originalParent) {
        ;(originalParent as ChildrenMixin).appendChild(source)
      }
      if (!oldGroup.removed) oldGroup.remove()
    }
  }

  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  const parent = source.parent
  if (!parent) return

  const n = config.cols * config.rows
  const cloneIds: string[] = []
  const clones: SceneNode[] = []

  for (let i = 1; i < n; i++) {
    const c = i % config.cols
    const r = Math.floor(i / config.cols)
    const scope = buildScope(
      {
        cols: config.cols,
        rows: config.rows,
        seed: config.seed,
        sourceWidth: source.width,
        sourceHeight: source.height,
      },
      c,
      r,
    )
    const clone = (source as SceneNode & { clone: () => SceneNode }).clone()
    clone.name = `${source.name}_${i}`
    if ('insertChild' in parent) (parent as ChildrenMixin).insertChild(0, clone)

    const f = evalFactors(config, factors, scope)
    await applyToClone({
      clone,
      source,
      values: {
        x: compiled.x.evaluate(scope, 'x'),
        y: compiled.y.evaluate(scope, 'y'),
        rotation: compiled.rotation.evaluate(scope, 'rotation'),
        scaleX: compiled.scaleX.evaluate(scope, 'scaleX'),
        scaleY: compiled.scaleY.evaluate(scope, 'scaleY'),
        opacity: compiled.opacity.evaluate(scope, 'opacity'),
      },
      fill: config.fill,
      stroke: config.stroke,
      strokeWeight: config.strokeWeight,
      fillFactor: f.fill,
      strokeFactor: f.stroke,
      strokeWeightFactor: f.strokeWeight,
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

    cloneIds.push(clone.id)
    clones.push(clone)
  }

  const nodes = [source, ...clones]
  const group = figma.group(nodes, parent as BaseNode & ChildrenMixin)
  group.name = 'SwiftLoopGroup'

  store.set({
    originalId: source.id,
    parentId: parent.id,
    cloneIds,
    groupId: group.id,
  })

  figma.viewport.scrollAndZoomIntoView([group])
}

async function inPlaceMutation(
  source: SceneNode,
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
    const clone = await figma.getNodeByIdAsync(cloneId)
    if (!clone || clone.removed) continue

    const c = i % config.cols
    const r = Math.floor(i / config.cols)
    const scope = buildScope(
      {
        cols: config.cols,
        rows: config.rows,
        seed: config.seed,
        sourceWidth: source.width,
        sourceHeight: source.height,
      },
      c,
      r,
    )
    const f = evalFactors(config, factors, scope)
    await applyToClone({
      clone: clone as SceneNode,
      source,
      values: {
        x: compiled.x.evaluate(scope, 'x'),
        y: compiled.y.evaluate(scope, 'y'),
        rotation: compiled.rotation.evaluate(scope, 'rotation'),
        scaleX: compiled.scaleX.evaluate(scope, 'scaleX'),
        scaleY: compiled.scaleY.evaluate(scope, 'scaleY'),
        opacity: compiled.opacity.evaluate(scope, 'opacity'),
      },
      fill: config.fill,
      stroke: config.stroke,
      strokeWeight: config.strokeWeight,
      fillFactor: f.fill,
      strokeFactor: f.stroke,
      strokeWeightFactor: f.strokeWeight,
      dirty,
    })
  }
}

function evalFactors(
  config: LoopConfig,
  factors: CompiledFactors,
  scope: Scope,
): { fill: number; stroke: number; strokeWeight: number } {
  const baseEased = applyEasing(config.easing, computeInterpFactor(config, scope.tx, scope.ty))
  return {
    fill: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased,
    stroke: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : baseEased,
    strokeWeight: factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeightFactor')
      : baseEased,
  }
}

function computeInterpFactor(config: LoopConfig, tx: number, ty: number): number {
  if (config.cols > 1 && config.rows > 1) return (tx + ty) / 2
  if (config.rows > 1) return ty
  return tx
}

export async function revert(_source: SceneNode, store: LastRunStore): Promise<void> {
  const prev = store.get()
  if (!prev) return
  for (const id of prev.cloneIds) {
    const n = await figma.getNodeByIdAsync(id)
    if (n && !n.removed) n.remove()
  }
  // unwrap the original source out of the SwiftLoopGroup before discarding it
  const oldGroup = await figma.getNodeByIdAsync(prev.groupId)
  if (oldGroup && !oldGroup.removed) {
    const source = await figma.getNodeByIdAsync(prev.originalId)
    const originalParent = await figma.getNodeByIdAsync(prev.parentId)
    if (
      source &&
      !source.removed &&
      originalParent &&
      !originalParent.removed &&
      'appendChild' in originalParent
    ) {
      ;(originalParent as ChildrenMixin).appendChild(source as SceneNode)
    }
    if (!oldGroup.removed) oldGroup.remove()
  }
  store.clear()
}
