from flask import Blueprint, request, jsonify
from backend.utils.file_handler import read_json
from backend.models.product import Product
from backend.models.sale import Sale

feed_bp = Blueprint("feed", __name__)


def load_products():
    data = read_json("products.json", [])
    return [Product.from_dict(item) for item in data]


def load_sales():
    data = read_json("sales.json", [])
    return [Sale.from_dict(item) for item in data]


@feed_bp.route("/api/feed", methods=["GET"])
def get_feed():
    user_id = request.args.get("user_id", "")
    interests = request.args.getlist("interests")

    if user_id:
        users_data = read_json("users.json", [])
        for ud in users_data:
            if ud.get("user_id") == user_id:
                interests = ud.get("interests", [])
                break

    products = load_products()
    sales = load_sales()

    sections = []

    if interests:
        interested_products = [p for p in products if p.category in interests]
        if interested_products:
            sections.append({
                "title": "Your Interests",
                "type": "interests",
                "items": [p.to_dict() for p in sorted(interested_products, key=lambda x: x.sold_count, reverse=True)[:12]]
            })

    new_products = sorted(products, key=lambda p: p.created_at, reverse=True)[:8]
    if new_products:
        sections.append({
            "title": "New Arrivals",
            "type": "new",
            "items": [p.to_dict() for p in new_products]
        })

    trending = sorted(products, key=lambda p: p.sold_count, reverse=True)[:10]
    if trending:
        sections.append({
            "title": "Trending Products",
            "type": "trending",
            "items": [p.to_dict() for p in trending]
        })

    low_stock = [p for p in products if p.is_low_stock()][:6]
    if low_stock:
        sections.append({
            "title": "Low Stock Alerts",
            "type": "low_stock",
            "items": [p.to_dict() for p in low_stock]
        })

    if interests:
        other_products = [p for p in products if p.category not in interests]
        if other_products:
            sections.append({
                "title": "More Products",
                "type": "other",
                "items": [p.to_dict() for p in sorted(other_products, key=lambda x: x.sold_count, reverse=True)[:12]]
            })
    else:
        categories = {}
        for p in products:
            cat = p.category or "Uncategorized"
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(p)

        for cat, cat_products in categories.items():
            if len(cat_products) >= 2:
                sections.append({
                    "title": f"{cat}",
                    "type": "category",
                    "category": cat,
                    "items": [p.to_dict() for p in sorted(cat_products, key=lambda x: x.sold_count, reverse=True)[:8]]
                })

        sections.insert(0, {
            "title": "Welcome! Pick Your Interests",
            "type": "welcome",
            "items": []
        })

    return jsonify(sections)


@feed_bp.route("/api/feed/recommended", methods=["GET"])
def get_recommended():
    user_id = request.args.get("user_id", "")
    products = load_products()

    top_sellers = sorted(products, key=lambda p: p.sold_count, reverse=True)[:6]
    randomized = sorted(products, key=lambda p: p.updated_at, reverse=True)[:6]

    return jsonify({
        "top_selling": [p.to_dict() for p in top_sellers],
        "recently_updated": [p.to_dict() for p in randomized]
    })


@feed_bp.route("/api/feed/categories", methods=["GET"])
def get_feed_categories():
    products = load_products()
    sales = load_sales()

    category_sales = {}
    for s in sales:
        for item in s.items:
            cat = item.category or "Uncategorized"
            if cat not in category_sales:
                category_sales[cat] = 0
            category_sales[cat] += item.quantity

    categories = {}
    for p in products:
        cat = p.category or "Uncategorized"
        if cat not in categories:
            categories[cat] = {
                "count": 0,
                "sold": 0,
                "revenue": 0
            }
        categories[cat]["count"] += 1
        categories[cat]["sold"] += p.sold_count

    for cat, data in categories.items():
        data["revenue"] = category_sales.get(cat, 0)

    result = [{"name": k, **v} for k, v in sorted(categories.items())]
    result.sort(key=lambda x: x["sold"], reverse=True)

    return jsonify(result)


@feed_bp.route("/api/feed/search-suggestions", methods=["GET"])
def search_suggestions():
    query = request.args.get("q", "").lower()
    products = load_products()

    if not query:
        return jsonify([])

    name_matches = [p for p in products if query in p.name.lower()]
    cat_matches = [p for p in products if query in p.category.lower()]

    suggestions = set()
    for p in name_matches[:5]:
        suggestions.add(p.name)
    for p in cat_matches[:3]:
        suggestions.add(f"in {p.category}")

    return jsonify(sorted(list(suggestions))[:8])
