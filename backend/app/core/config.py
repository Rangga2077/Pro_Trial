from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CoCI Project"
    API_V1_STR: str = "/api/v1"
    
    CAMERA_INDEX: int = 0
    CAMERA_WIDTH: int = 1280
    CAMERA_HEIGHT: int = 720
    
    class Config:
        env_file = ".env"

settings = Settings()
