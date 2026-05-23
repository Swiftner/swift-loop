import { showUI } from '@create-figma-plugin/utilities'
import { startHostLoop } from './plugin/host-loop'
import { FigmaAdapter } from './plugin/hosts/figma/adapter'
import { FigmaBridge } from './plugin/hosts/figma/bridge'

export default function () {
  // showUI creates the iframe. Width/height get overridden by host-loop's
  // restored-from-storage size once it's read clientStorage; these are just
  // the initial paint dimensions.
  showUI({ width: 320, height: 720 })
  const adapter = new FigmaAdapter()
  const bridge = new FigmaBridge()
  startHostLoop(adapter, bridge)
}
