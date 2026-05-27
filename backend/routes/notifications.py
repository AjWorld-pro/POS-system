from flask import Blueprint, request, jsonify
from backend.models.notification import Notification
from backend.models.linked_list import LinkedList
from backend.utils.file_handler import read_json, write_json

notifications_bp = Blueprint("notifications", __name__)


def load_notifications():
    data = read_json("notifications.json", [])
    ll = LinkedList()
    for item in data:
        ll.append(Notification.from_dict(item))
    return ll


def save_notifications(ll):
    write_json("notifications.json", [n.to_dict() for n in ll])


def add_system_notification(title, message, ntype="system"):
    notification = Notification(title=title, message=message, ntype=ntype)
    ll = load_notifications()
    ll.prepend(notification)
    if len(ll) > 100:
        ll.tail = ll.tail.prev
        ll.tail.next = None
        ll._size -= 1
    save_notifications(ll)
    return notification


@notifications_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    ll = load_notifications()
    return jsonify([n.to_dict() for n in ll])


@notifications_bp.route("/api/notifications/unread", methods=["GET"])
def get_unread_count():
    ll = load_notifications()
    unread = sum(1 for n in ll if not n.read)
    return jsonify({"unread": unread})


@notifications_bp.route("/api/notifications/<notif_id>/read", methods=["PUT"])
def mark_read(notif_id):
    ll = load_notifications()
    notif = ll.find("notification_id", notif_id)
    if notif:
        notif.read = True
        save_notifications(ll)
    return jsonify({"success": True})


@notifications_bp.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_read():
    ll = load_notifications()
    for n in ll:
        n.read = True
    save_notifications(ll)
    return jsonify({"success": True})
