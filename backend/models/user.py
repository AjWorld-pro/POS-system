import uuid
from datetime import datetime
import hashlib


class User:
    ROLES = ["admin", "cashier", "customer"]

    def __init__(self, username, password, role="customer", name="", email=""):
        self.user_id = str(uuid.uuid4())[:8]
        self.username = username
        self.password_hash = self._hash_password(password)
        self.role = role if role in self.ROLES else "customer"
        self.name = name or username
        self.email = email
        self.interests = []
        self.favorites = []
        self.notifications = []
        self.created_at = datetime.now().isoformat()
        self.last_login = None
        self.is_active = True

    def _hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()

    def verify_password(self, password):
        return self.password_hash == hashlib.sha256(password.encode()).hexdigest()

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "username": self.username,
            "password_hash": self.password_hash,
            "role": self.role,
            "name": self.name,
            "email": self.email,
            "interests": self.interests,
            "favorites": self.favorites,
            "notifications": self.notifications,
            "created_at": self.created_at,
            "last_login": self.last_login,
            "is_active": self.is_active
        }

    @classmethod
    def from_dict(cls, data):
        user = cls(
            username=data["username"],
            password="",
            role=data.get("role", "customer"),
            name=data.get("name", data["username"]),
            email=data.get("email", "")
        )
        user.user_id = data.get("user_id", user.user_id)
        user.password_hash = data.get("password_hash", "")
        user.interests = data.get("interests", [])
        user.favorites = data.get("favorites", [])
        user.notifications = data.get("notifications", [])
        user.created_at = data.get("created_at", user.created_at)
        user.last_login = data.get("last_login")
        user.is_active = data.get("is_active", True)
        return user

    def add_interest(self, category):
        if category not in self.interests:
            self.interests.append(category)

    def remove_interest(self, category):
        if category in self.interests:
            self.interests.remove(category)

    def add_favorite(self, product_id):
        if product_id not in self.favorites:
            self.favorites.append(product_id)

    def remove_favorite(self, product_id):
        if product_id in self.favorites:
            self.favorites.remove(product_id)

    def add_notification(self, notification):
        self.notifications.insert(0, notification)
        if len(self.notifications) > 50:
            self.notifications = self.notifications[:50]

    def clear_notifications(self):
        self.notifications = []

    def mark_notifications_read(self):
        for n in self.notifications:
            if isinstance(n, dict):
                n["read"] = True
