import './App.css'
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext'
import { ProjectionLayout } from './components/ProjectionLayout'
import { RecipeManager } from './components/RecipeManager'
import { OverlayCanvas } from './components/OverlayCanvas'
import { VoiceStatus } from './components/VoiceStatus'

function StatusIndicator() {
  const { isConnected, lastMessage } = useWebSocket();
  return (
    <div className="fixed top-4 right-4 p-2 bg-gray-800 rounded shadow z-50">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-white">{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {lastMessage && (
        <div className="mt-2 text-xs text-gray-400 max-w-xs truncate">
          Last: {JSON.stringify(lastMessage)}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <StatusIndicator />
      <ProjectionLayout>
        <RecipeManager />
        <OverlayCanvas />
        <VoiceStatus isListening={true} isProcessing={false} />
      </ProjectionLayout>
    </WebSocketProvider>
  )
}

export default App
