from flask import Blueprint, request, jsonify
from backend.utils.file_handler import read_json
from backend.models.sale import Sale
from backend.models.product import Product
from datetime import datetime, timedelta

analytics_bp = Blueprint("analytics", __name__)


def load_sales_data():
    data = read_json("sales.json", [])
    return [Sale.from_dict(item) for item in data]


def load_products_data():
    data = read_json("products.json", [])
    return [Product.from_dict(item) for item in data]


@analytics_bp.route("/api/analytics/dashboard", methods=["GET"])
def get_dashboard():
    sales = load_sales_data()
    products = load_products_data()

    today = datetime.now().strftime("%Y-%m-%d")
    today_sales = [s for s in sales if s.timestamp.startswith(today)]
    today_revenue = sum(s.total for s in today_sales)
    today_transactions = len(today_sales)

    total_revenue = sum(s.total for s in sales)
    total_transactions = len(sales)
    total_products = len(products)
    total_items_sold = sum(sum(item.quantity for item in s.items) for s in sales)

    low_stock_products = [p for p in products if p.is_low_stock()]
    out_of_stock = [p for p in products if p.quantity == 0]

    category_data = {}
    for p in products:
        cat = p.category or "Uncategorized"
        if cat not in category_data:
            category_data[cat] = {"count": 0, "value": 0, "sold": 0}
        category_data[cat]["count"] += 1
        category_data[cat]["value"] += p.price * p.quantity
        category_data[cat]["sold"] += p.sold_count

    return jsonify({
        "today": {
            "revenue": today_revenue,
            "transactions": today_transactions
        },
        "overview": {
            "total_revenue": total_revenue,
            "total_transactions": total_transactions,
            "total_products": total_products,
            "total_items_sold": total_items_sold
        },
        "inventory": {
            "total_products": total_products,
            "low_stock": len(low_stock_products),
            "out_of_stock": len(out_of_stock),
            "low_stock_products": [p.to_dict() for p in low_stock_products]
        },
        "categories": category_data
    })


@analytics_bp.route("/api/analytics/top-products", methods=["GET"])
def get_top_products():
    limit = request.args.get("limit", 10, type=int)
    products = load_products_data()
    sorted_products = sorted(products, key=lambda p: p.sold_count, reverse=True)
    return jsonify([p.to_dict() for p in sorted_products[:limit]])


@analytics_bp.route("/api/analytics/revenue", methods=["GET"])
def get_revenue_analytics():
    days = request.args.get("days", 30, type=int)
    sales = load_sales_data()

    daily_revenue = {}
    for s in sales:
        date = s.timestamp[:10]
        if date not in daily_revenue:
            daily_revenue[date] = 0
        daily_revenue[date] += s.total

    revenue_data = []
    for i in range(days - 1, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        revenue_data.append({
            "date": date,
            "revenue": daily_revenue.get(date, 0)
        })

    return jsonify(revenue_data)


@analytics_bp.route("/api/analytics/sales-summary", methods=["GET"])
def get_sales_summary():
    period = request.args.get("period", "weekly")
    sales = load_sales_data()

    if period == "daily":
        group_key = lambda s: s.timestamp[:10]
    elif period == "monthly":
        group_key = lambda s: s.timestamp[:7]
    else:
        from datetime import datetime as dt
        group_key = lambda s: f"{dt.fromisoformat(s.timestamp).isocalendar()[0]}-W{dt.fromisoformat(s.timestamp).isocalendar()[1]:02d}"

    grouped = {}
    for s in sales:
        key = group_key(s)
        if key not in grouped:
            grouped[key] = {"revenue": 0, "transactions": 0, "items": 0}
        grouped[key]["revenue"] += s.total
        grouped[key]["transactions"] += 1
        grouped[key]["items"] += sum(item.quantity for item in s.items)

    result = [{"period": k, **v} for k, v in sorted(grouped.items())]
    return jsonify(result)


@analytics_bp.route("/api/analytics/payment-methods", methods=["GET"])
def get_payment_methods():
    sales = load_sales_data()
    methods = {}
    for s in sales:
        method = s.payment_method
        if method not in methods:
            methods[method] = {"count": 0, "revenue": 0}
        methods[method]["count"] += 1
        methods[method]["revenue"] += s.total
    return jsonify(methods)


@analytics_bp.route("/api/analytics/inventory-status", methods=["GET"])
def get_inventory_status():
    products = load_products_data()
    total = len(products)
    in_stock = len([p for p in products if p.quantity > p.low_stock_threshold])
    low_stock = len([p for p in products if 0 < p.quantity <= p.low_stock_threshold])
    out_of_stock = len([p for p in products if p.quantity == 0])

    return jsonify({
        "total": total,
        "in_stock": in_stock,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "stock_value": sum(p.price * p.quantity for p in products)
    })
