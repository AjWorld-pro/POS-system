import uuid
from datetime import datetime


class Notification:
    TYPES = ["low_stock", "new_product", "sale_update", "system"]

    def __init__(self, title, message, ntype="system"):
        self.notification_id = str(uuid.uuid4())[:8]
        self.title = title
        self.message = message
        self.type = ntype if ntype in self.TYPES else "system"
        self.created_at = datetime.now().isoformat()
        self.read = False

    def to_dict(self):
        return {
            "notification_id": self.notification_id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "created_at": self.created_at,
            "read": self.read
        }

    @classmethod
    def from_dict(cls, data):
        n = cls(
            title=data["title"],
            message=data["message"],
            ntype=data.get("type", "system")
        )
        n.notification_id = data.get("notification_id", n.notification_id)
        n.created_at = data.get("created_at", n.created_at)
        n.read = data.get("read", False)
        return n
