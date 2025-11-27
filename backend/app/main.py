from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.endpoints import endpoints, stream

setup_logging()

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(endpoints.router, prefix=settings.API_V1_STR)
app.include_router(stream.router, prefix="/ws") # WebSocket is usually at root or specific path, not always under /api/v1


@app.get("/")
def root():
    return {"message": "Welcome to CoCI Project API"}
