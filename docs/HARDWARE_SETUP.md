# Hardware Setup & Deployment Guide

To deploy the **CoCI (Continuum of Culinary Interaction)** system for an exhibition without a visible laptop, you need to transition from a "Development Setup" to an "Embedded/Installation Setup".

## 1. The Computer (The "Brain")
You cannot run this complex Python/CV code directly on a standard projector. You need a dedicated computer. To avoid carrying a bulky laptop, use a **Mini PC**.

### Recommended Hardware: **Mini PC**
Small, powerful computers that can be mounted directly to the projector or hidden under the table.
- **Option A (Performance)**: **Intel NUC** or **Minisforum** (Ryzen/Intel i5+).
    - *Pros*: Runs Windows/Linux easily, powerful CPU for OpenCV, widely available.
    - *Size*: About the size of a sandwich.
- **Option B (AI Optimized)**: **NVIDIA Jetson Orin Nano / AGX**.
    - *Pros*: Built specifically for AI/Computer Vision. Excellent for running YOLO models efficiently.
    - *Cons*: Runs Linux (Ubuntu) ARM64. Requires some setup effort to port from Windows.

### Budget Option: **Raspberry Pi 5** (The "Student Choice")
Yes, you can use a Raspberry Pi, but there are strict caveats.
- **Model**: You **MUST use a Raspberry Pi 5 (8GB RAM)**. The Pi 4 is too slow for smooth projection UI + Computer Vision.
- **Performance**:
    - *Without AI Kit*: You will likely get ~5-12 FPS running YOLO. The UI might feel lagging.
    - *With AI Kit*: You should buy the **Raspberry Pi AI Kit (Hailo-8L)** (~$70). This hardware accelerator allows the Pi 5 to run YOLO models at 30+ FPS effortlessly.
- **OS**: You will need to switch from Windows to **Raspberry Pi OS (Linux)**.
    - *Porting Effort*: Low/Medium. Python runs natively, but you'll need to reinstall dependencies (`pip install ...`).
- **Cost**: The Pi 5 + Power Supply + SD Card + AI Kit is approx $150–$180 total. This is significantly cheaper than a $500 Mini PC.

**Setup**: Velcro or mount this Mini PC on top of the projector or hide it inside the exhibition plinth/table.

## 2. The Projector
For a tabletop culinary interface, standard projectors are difficult because your body/head will block the light (creating shadows on the workspace).

### Recommendation: **Ultra-Short Throw (UST) Projector**
- **Why**: These projectors sit very close to the wall/surface (inches away) and project a large image.
- **Placement**: You can place it on the far edge of the table pointing down, or mount it just above the table.
- **Specs**:
    - **Lumens**: 3000+ ANSI Lumens (Exhibition halls are bright; you need high brightness).
    - **Resolution**: 1080p minimum.
    - **Contrast**: High contrast for readable text.

### Alternative: **Portable LED Projectors** (e.g., XGIMI, Anker Nebula)
- *Pros*: Small, portable, battery-powered options.
- *Cons*: Usually dimmer. Only usable in darker exhibition corners.

## 3. The Camera
You need a camera to "see" the hands.
- **Mounting**: The camera must be rigidly mounted relative to the projector. If the camera moves, your calibration breaks.
- **Position**: Ideally mounted directly next to the projector lens, looking at the same area.

## 4. Wiring Diagram (Exhibition Mode)

```mermaid
graph TD
    Power[Power Strip] ==> Projector
    Power ==> MiniPC[Mini PC (Hidden)]
    
    MiniPC -- HDMI --> Projector
    Webcam -- USB --> MiniPC
    
    subgraph Table Surface
        ProjectionArea[Projected UI]
        Hands[User Hands]
    end
    
    Projector -. Light .-> ProjectionArea
    Webcam -. Visual Input .-> Hands
```

## 5. Software Integration (Future Steps)
To make it "start automatically":
1.  **Auto-Login**: Configure Windows to auto-login.
2.  **Startup Script**: Create a `.bat` file (Windows) in the Startup folder that:
    - Starts the Python Backend (`python -m app.main`).
    - Starts the Frontend (`npm run dev` or the built Electron `.exe`).
3.  **Calibration**: You will need to implement a **Homography Calibration** step.
    - *Problem*: The camera sees coordinates (0-640), but the screen is (0-1920).
    - *Solution*: A calibration mode where dots appear on the table, you touch them, and the system learns the mapping matrix.

## Summary Checklist for Exhibition
- [ ] Buy/Rent a powerful **Mini PC** (i5/Ryzen 5 or better).
- [ ] Buy/Rent a **Short Throw Projector**.
- [ ] 3D Print or build a mount to hold the Webcam on the Projector.
- [ ] Create a Windows Startup Script to launch the app automatically on boot.
