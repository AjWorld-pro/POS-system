import json
import os
import shutil
from datetime import datetime


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def get_file_path(filename):
    ensure_data_dir()
    return os.path.join(DATA_DIR, filename)


def read_json(filename, default=None):
    filepath = get_file_path(filename)
    if not os.path.exists(filepath):
        return default if default is not None else []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default if default is not None else []


def write_json(filename, data):
    filepath = get_file_path(filename)
    ensure_data_dir()
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    return True


def append_json(filename, data):
    existing = read_json(filename, [])
    if isinstance(existing, list):
        existing.append(data)
    else:
        existing = [data]
    return write_json(filename, existing)


def delete_file(filename):
    filepath = get_file_path(filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False


def backup_data():
    ensure_data_dir()
    backup_dir = os.path.join(DATA_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"backup_{timestamp}.json")

    all_data = {}
    for fname in os.listdir(DATA_DIR):
        if fname.endswith(".json") and fname != "backups":
            filepath = os.path.join(DATA_DIR, fname)
            with open(filepath, "r", encoding="utf-8") as f:
                all_data[fname] = json.load(f)

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=2, default=str)

    return backup_file


def restore_backup(backup_file):
    if not os.path.exists(backup_file):
        return False
    with open(backup_file, "r", encoding="utf-8") as f:
        all_data = json.load(f)
    for fname, data in all_data.items():
        if fname.endswith(".json"):
            write_json(fname, data)
    return True


def list_backups():
    backup_dir = os.path.join(DATA_DIR, "backups")
    if not os.path.exists(backup_dir):
        return []
    backups = []
    for f in sorted(os.listdir(backup_dir), reverse=True):
        if f.endswith(".json"):
            filepath = os.path.join(backup_dir, f)
            backups.append({
                "filename": f,
                "path": filepath,
                "size": os.path.getsize(filepath),
                "created": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
            })
    return backups
