import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    DEBUG = False

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # CORS
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Clerk JWT verification
    CLERK_PEM_PUBLIC_KEY = os.environ.get("CLERK_PEM_PUBLIC_KEY", "")
    CLERK_PERMITTED_ORIGINS = [
        o.strip()
        for o in os.environ.get("CLERK_PERMITTED_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]

    # LLM — Gemini (primary)
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_DEFAULT_MODEL = os.environ.get("GEMINI_DEFAULT_MODEL", "gemini-2.5-flash")
    GEMINI_FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash")

    # LLM — OpenAI (fallback)
    LLM_FALLBACK_ENABLED = os.environ.get("LLM_FALLBACK_ENABLED", "true").lower() == "true"
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_DEFAULT_MODEL = os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o-mini")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}


def get_config():
    env = os.environ.get("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
