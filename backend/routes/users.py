from flask import Blueprint, request, jsonify
from backend.models.user import User
from backend.models.linked_list import LinkedList
from backend.utils.file_handler import read_json, write_json

users_bp = Blueprint("users", __name__)


def load_users():
    data = read_json("users.json", [])
    ll = LinkedList()
    for item in data:
        ll.append(User.from_dict(item))
    return ll


def save_users(ll):
    write_json("users.json", [u.to_dict() for u in ll])


@users_bp.route("/api/users", methods=["GET"])
def get_users():
    ll = load_users()
    return jsonify([{
        "user_id": u.user_id,
        "username": u.username,
        "role": u.role,
        "name": u.name,
        "email": u.email,
        "interests": u.interests,
        "created_at": u.created_at,
        "last_login": u.last_login,
        "is_active": u.is_active
    } for u in ll])


@users_bp.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    ll = load_users()
    user = ll.find("user_id", user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "interests": user.interests,
        "favorites": user.favorites,
        "notifications": user.notifications,
        "created_at": user.created_at,
        "last_login": user.last_login
    })


@users_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    if not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password required"}), 400

    ll = load_users()
    existing = ll.find("username", data["username"])
    if existing:
        return jsonify({"error": "Username already exists"}), 400

    user = User(
        username=data["username"],
        password=data["password"],
        role=data.get("role", "customer"),
        name=data.get("name", ""),
        email=data.get("email", "")
    )

    if not ll.head and ll._size == 0:
        user.role = "admin"

    ll.append(user)
    save_users(ll)

    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "interests": user.interests
    }), 201


@users_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    ll = load_users()
    user = ll.find("username", data.get("username", ""))
    if not user or not user.verify_password(data.get("password", "")):
        return jsonify({"error": "Invalid credentials"}), 401

    from datetime import datetime
    user.last_login = datetime.now().isoformat()
    save_users(ll)

    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "interests": user.interests
    })


@users_bp.route("/api/users/<user_id>/interests", methods=["PUT"])
def update_interests(user_id):
    data = request.json
    ll = load_users()
    user = ll.find("user_id", user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.interests = data.get("interests", [])
    save_users(ll)
    return jsonify({"interests": user.interests})


@users_bp.route("/api/users/<user_id>/favorites", methods=["POST"])
def add_favorite(user_id):
    data = request.json
    ll = load_users()
    user = ll.find("user_id", user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    product_id = data.get("product_id")
    if product_id:
        user.add_favorite(product_id)
        save_users(ll)

    return jsonify({"favorites": user.favorites})


@users_bp.route("/api/users/<user_id>/favorites/<product_id>", methods=["DELETE"])
def remove_favorite(user_id, product_id):
    ll = load_users()
    user = ll.find("user_id", user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.remove_favorite(product_id)
    save_users(ll)
    return jsonify({"favorites": user.favorites})


@users_bp.route("/api/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    ll = load_users()
    user = ll.find("user_id", user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if "name" in data:
        user.name = data["name"]
    if "email" in data:
        user.email = data["email"]
    if "password" in data and data["password"]:
        user.password_hash = user._hash_password(data["password"])

    save_users(ll)
    return jsonify({"user_id": user.user_id, "name": user.name, "email": user.email})
