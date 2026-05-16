from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.endpoints import endpoints, stream, recipes, camera

setup_logging()

from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    cv_pipeline = None

    if settings.CV_PIPELINE_ENABLED:
        from app.engines.cv.pipeline import cv_pipeline as active_pipeline

        cv_pipeline = active_pipeline
        task = asyncio.create_task(cv_pipeline.start())

    yield

    if cv_pipeline and task:
        cv_pipeline.stop()
        await task

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix=settings.API_V1_STR)
app.include_router(recipes.router, prefix=f"{settings.API_V1_STR}/recipes", tags=["recipes"])
app.include_router(camera.router, prefix=f"{settings.API_V1_STR}/camera", tags=["camera"])
app.include_router(stream.router, prefix="/ws")


@app.get("/")
def root():
    return {"message": "Welcome to CoCI Project API"}
