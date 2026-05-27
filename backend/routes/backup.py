from flask import Blueprint, request, jsonify
from backend.utils.file_handler import backup_data, restore_backup, list_backups

backup_bp = Blueprint("backup", __name__)


@backup_bp.route("/api/backup", methods=["POST"])
def create_backup():
    filepath = backup_data()
    return jsonify({"message": "Backup created", "file": filepath}), 201


@backup_bp.route("/api/backup/restore", methods=["POST"])
def restore():
    data = request.json
    backup_file = data.get("file", "")
    if not backup_file:
        backups = list_backups()
        if backups:
            backup_file = backups[0]["path"]
    if not backup_file:
        return jsonify({"error": "No backup file specified"}), 400

    success = restore_backup(backup_file)
    if success:
        return jsonify({"message": "Backup restored successfully"})
    return jsonify({"error": "Failed to restore backup"}), 500


@backup_bp.route("/api/backup/list", methods=["GET"])
def list_backups_route():
    backups = list_backups()
    return jsonify(backups)
