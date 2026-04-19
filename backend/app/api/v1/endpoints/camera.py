from fastapi import APIRouter
from pydantic import BaseModel
import cv2
from app.engines.cv.pipeline import cv_pipeline
from app.core.config import settings

router = APIRouter()

class CameraSelectRequest(BaseModel):
    index: int

@router.get("/devices")
def list_cameras():
    """
    Probes standard camera indices to find active cameras.
    """
    available = []
    # Test indices 0 to 4 (usual range)
    for i in range(5):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW) if cv2.os.name == 'nt' else cv2.VideoCapture(i)
        if cap.isOpened():
            available.append(i)
            cap.release()
    return {"available_cameras": available, "active_camera": settings.CAMERA_INDEX}

@router.post("/select")
async def select_camera(req: CameraSelectRequest):
    """
    Stops the pipeline, changes the internal index, and restarts it. 
    """
    # Temporarily override settings
    settings.CAMERA_INDEX = req.index
    
    if cv_pipeline.running:
        cv_pipeline.stop()
        # Give it a moment to release
        import asyncio
        await asyncio.sleep(0.5)
        # Restart in background
        asyncio.create_task(cv_pipeline.start())
        
    return {"status": "success", "new_index": req.index}
