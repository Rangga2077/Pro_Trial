import './App.css'
import { WebSocketProvider } from './context/WebSocketProvider'
import { ProjectionLayout } from './components/ProjectionLayout'
import { ProjectionHud } from './components/hud/ProjectionHud'
import { OverlayCanvas } from './components/OverlayCanvas'
import { DisplaySettings } from './components/DisplaySettings'

function App() {
  return (
    <WebSocketProvider>
      <DisplaySettings />
      <ProjectionLayout>
        <ProjectionHud />
        <OverlayCanvas />
      </ProjectionLayout>
    </WebSocketProvider>
  )
}

export default App

