import { showUI } from '@create-figma-plugin/utilities'
import { startHostLoop } from './plugin/host-loop'
import { FigmaAdapter } from './plugin/hosts/figma/adapter'
import { FigmaBridge } from './plugin/hosts/figma/bridge'

export default function () {
  // showUI creates the iframe. Width/height get overridden by host-loop's
  // restored-from-storage size once it's read clientStorage; these are just
  // the initial paint dimensions.
  // themeColors injects Figma's --figma-color-* CSS variables into the iframe
  // and toggles a figma-dark/figma-light class on <html>, so the UI matches
  // Figma's light/dark theme natively (see src/ui/styles.css).
  showUI({ width: 320, height: 720, themeColors: true })
  const adapter = new FigmaAdapter()
  const bridge = new FigmaBridge()
  startHostLoop(adapter, bridge)
}
