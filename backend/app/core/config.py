from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = PROJECT_ROOT / "backend"

class Settings(BaseSettings):
    PROJECT_NAME: str = "CoCI Project"
    API_V1_STR: str = "/api/v1"

    CAMERA_INDEX: int = 0
    CAMERA_WIDTH: int = 1280
    CAMERA_HEIGHT: int = 720
    CV_PIPELINE_ENABLED: bool = True
    GESTURE_ACTION_COOLDOWN_SECONDS: float = 0.16
    GESTURE_SWIPE_THRESHOLD: float = 0.06
    GESTURE_MONITOR_ENABLED: bool = True
    GESTURE_MONITOR_SAMPLE_SECONDS: float = 0.25

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    RECIPE_DATA_DIR: Path = PROJECT_ROOT / "data" / "recipes"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return origins or ["*"]

settings = Settings()
