# CoCI Project (Hardware-Free Branch) - Testing Guide

This branch (`hardware-free`) supports development and testing using standard laptop hardware (webcam) without requiring the specialized projector/camera setup.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Python 3.8+**
- **Node.js (v18+)** & **npm**
- **Git**
- **Webcam**: A functioning built-in or USB webcam is required for the "hardware-free" CV pipeline simulation.

---

##  Installation & Setup

### 1. Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate
     ```
   - **Unix/MacOS:**
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   > You should see `CV Pipeline started.` in the terminal logs, indicating the webcam has been successfully accessed.

### 2. Frontend Setup (React + Electron)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application (Dev Mode):
   ```bash
   npm run electron:dev
   ```
   > This will start the Vite dev server and launch the Electron window.

---

##  Testing Strategy

Since this branch operates in "Hardware-Free" mode, testing focuses on verifying the software stack using your local webcam as the input source.

### 1. Automated Testing

The automated test suite is located in `backend/tests/`.

To run the tests:
```bash
# From the backend directory
pytest tests
```

**Scope of Tests:**
- **`test_engine1.py`**: Validates YOLO object detection logic (using mock/placeholder images).
- **`test_engine2.py`**: Validates MediaPipe gesture recognition logic.
- **API Tests**: Verifies HTTP and WebSocket endpoints connect correctly.

> **Note:** If tests are currently empty, they serve as placeholders for future unit test definitions.

### 2. Manual Verification (Hardware-Free Workflow)

Follow these steps to manually verify the full system loop:

#### A. Connectivity Verification
1. launch the app.
2. Open the **Developer Tools** in Electron (Ctrl+Shift+I or Cmd+Option+I).
3. Check the **Console** tab.
   - OK Look for: `WebSocket Connected`.
   - No OK If you see errors, failing to connect to `ws://localhost:8000/ws/ws`.

#### B. Visual Pipeline Verification
The backend sends processed frames to the frontend via WebSocket.
1. Ensure your face/environment is visible in the application window's video feed.
2. If the video is black or static, check the backend terminal for "Error: Could not open camera".

#### C. Feature Testing
- **Object Detection**:
  - Hold up common objects (e.g., **Cell Phone**, **Bottle**, **Cup**) to the camera.
  - **Expected Result**: The system should draw bounding boxes or label the objects in the video feed (if visualization is enabled) or log detections in the console.

- **Gesture Recognition**:
  - Perform hand gestures:
    1. **Open Palm**: Should trigger "Open" or related events.
    2. **Closed Fist**: Should trigger "Close" or grab events.
  - **Expected Result**: Verify in the console/UI that the gesture state changes.

- **LLM Interaction (Voice/Text)**:
  - If the prompt interface is active, type or speak a query (e.g., "How do I cook this?").
  - **Expected Result**: You should receive a text response streaming back from the backend.

---

##  Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| **"Error: Could not open camera"** | Webcam is in use by another app (Zoom, Teams, etc.). | Close other camera apps and restart the backend. |
| **Frontend displays nothing** | Backend server is not running. | Verify `uvicorn` is running on port 8000. |
| **WebSocket connection failed** | Port mismatch. | Check `frontend/src/context/WebSocketContext.tsx` matches `ws://localhost:8000/ws/ws`. |
