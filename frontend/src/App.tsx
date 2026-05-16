import './App.css'
import { WebSocketProvider } from './context/WebSocketProvider'
import { useWebSocket } from './context/useWebSocket'
import { ProjectionLayout } from './components/ProjectionLayout'
import { RecipeManager } from './components/RecipeManager'
import { OverlayCanvas } from './components/OverlayCanvas'
import { VoiceStatus } from './components/VoiceStatus'
import { DisplaySettings } from './components/DisplaySettings'

function StatusIndicator() {
  const { isConnected } = useWebSocket();
  return (
    <div className="fixed top-4 right-4 p-2 bg-gray-800 rounded shadow z-[9999]">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-white">{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <StatusIndicator />
      <DisplaySettings />
      <ProjectionLayout>
        <RecipeManager />
        <OverlayCanvas />
        <VoiceStatus isListening={true} isProcessing={false} />
      </ProjectionLayout>
    </WebSocketProvider>
  )
}

export default App

