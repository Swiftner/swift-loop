import { render } from '@create-figma-plugin/ui'
import { App } from './ui/App'
import { initTheme } from './ui/theme'
import '!./ui/styles.css'

initTheme()
export default render(App)
