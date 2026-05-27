from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask import request
import os

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

from backend.routes.products import products_bp
from backend.routes.sales import sales_bp
from backend.routes.users import users_bp
from backend.routes.notifications import notifications_bp
from backend.routes.analytics import analytics_bp
from backend.routes.feed import feed_bp
from backend.routes.backup import backup_bp

app.register_blueprint(products_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(users_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(feed_bp)
app.register_blueprint(backup_bp)


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    return send_from_directory(upload_dir, filename)


@app.route("/")
@app.route("/<path:path>")
def serve_frontend(path=""):
    file_path = os.path.join("../frontend", path or "index.html")
    if os.path.exists(os.path.join(os.path.dirname(__file__), file_path)):
        return send_from_directory("../frontend", path or "index.html")
    return send_from_directory("../frontend", "index.html")


@app.route("/api/health")
def health_check():
    return jsonify({"status": "healthy", "message": "POS System API is running"})


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "API endpoint not found"}), 404
    return send_from_directory("../frontend", "index.html")
