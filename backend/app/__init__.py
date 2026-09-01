from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

from config import get_config

db = SQLAlchemy()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object(get_config())

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(
        app,
        origins=[app.config["FRONTEND_URL"]],
        supports_credentials=False,
    )

    # Import models so Flask-Migrate discovers them
    from app import models  # noqa: F401

    # Blueprints
    from app.upload import upload_bp
    from app.routes import api_bp
    from app.llm.routes import llm_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(llm_bp)

    @app.get("/health")
    def health():
        return {"status": "ok", "app": "DATAClaw"}

    return app
