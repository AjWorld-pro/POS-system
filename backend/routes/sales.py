from flask import Blueprint, request, jsonify
from backend.models.sale import Sale, SaleItem
from backend.models.product import Product
from backend.models.notification import Notification
from backend.models.linked_list import LinkedList
from backend.utils.file_handler import read_json, write_json
from datetime import datetime, timedelta

sales_bp = Blueprint("sales", __name__)


def load_sales():
    data = read_json("sales.json", [])
    ll = LinkedList()
    for item in data:
        ll.append(Sale.from_dict(item))
    return ll


def save_sales(ll):
    write_json("sales.json", [s.to_dict() for s in ll])


def load_products():
    data = read_json("products.json", [])
    ll = LinkedList()
    for item in data:
        ll.append(Product.from_dict(item))
    return ll


def save_products(ll):
    write_json("products.json", [p.to_dict() for p in ll])


def add_notification(title, message, ntype="system"):
    notif = Notification(title=title, message=message, ntype=ntype)
    ndata = read_json("notifications.json", [])
    ndata.insert(0, notif.to_dict())
    if len(ndata) > 100:
        ndata = ndata[:100]
    write_json("notifications.json", ndata)
    return notif


@sales_bp.route("/api/sales", methods=["GET"])
def get_sales():
    ll = load_sales()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")

    results = ll.to_list_reverse()

    if start_date:
        results = [s for s in results if s.timestamp >= start_date]
    if end_date:
        results = [s for s in results if s.timestamp <= end_date + "T23:59:59"]

    total = len(results)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_results = results[start_idx:end_idx]

    return jsonify({
        "sales": [s.to_dict() for s in page_results],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    })


@sales_bp.route("/api/sales/<sale_id>", methods=["GET"])
def get_sale(sale_id):
    ll = load_sales()
    sale = ll.find("sale_id", sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    return jsonify(sale.to_dict())


@sales_bp.route("/api/sales/<sale_id>/receipt", methods=["GET"])
def get_receipt(sale_id):
    ll = load_sales()
    sale = ll.find("sale_id", sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    return jsonify({"receipt": sale.generate_receipt()})


@sales_bp.route("/api/sales/<sale_id>/receipt/pdf", methods=["GET"])
def get_receipt_pdf(sale_id):
    ll = load_sales()
    sale = ll.find("sale_id", sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404

    from fpdf import FPDF
    from datetime import datetime

    pdf = FPDF(orientation="P", unit="mm", format=(80, 200))
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=5)

    # Colors
    emerald = (5, 150, 105)
    gold = (212, 175, 55)
    dark = (26, 46, 42)

    # Header
    pdf.set_fill_color(*emerald)
    pdf.rect(0, 0, 80, 34, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Courier", "B", 14)
    pdf.set_y(5)
    pdf.cell(80, 8, "EMERALD POS", align="C")
    pdf.set_font("Courier", "", 7)
    pdf.cell(80, 4, "Smart Inventory & Point of Sale", align="C")
    pdf.set_font("Courier", "", 7)
    pdf.cell(80, 4, "RECEIPT", align="C")

    # Gold separator line
    pdf.set_y(36)
    pdf.set_draw_color(*gold)
    pdf.set_line_width(0.6)
    pdf.line(3, pdf.get_y(), 77, pdf.get_y())

    # Sale info
    pdf.set_text_color(*dark)
    pdf.set_font("Courier", "", 7)
    y = 40
    pdf.set_y(y)
    pdf.cell(72, 4, f"Sale #    : {sale.sale_id}")
    pdf.set_y(y + 4.5)
    try:
        ts = datetime.fromisoformat(sale.timestamp).strftime("%Y-%m-%d %H:%M")
    except Exception:
        ts = sale.timestamp[:16]
    pdf.cell(72, 4, f"Date      : {ts}")
    pdf.set_y(y + 9)
    pdf.cell(72, 4, f"Cashier   : {sale.cashier or 'N/A'}")
    pdf.set_y(y + 13.5)
    pdf.cell(72, 4, f"Payment   : {sale.payment_method.upper()}")

    # Separator
    pdf.set_y(y + 18)
    pdf.set_draw_color(*gold)
    pdf.set_line_width(0.3)
    pdf.line(3, pdf.get_y(), 77, pdf.get_y())

    # Column headers
    pdf.set_font("Courier", "B", 7)
    yh = pdf.get_y() + 2.5
    pdf.set_y(yh)
    pdf.cell(32, 4, "Item", align="L")
    pdf.cell(10, 4, "Qty", align="C")
    pdf.cell(16, 4, "Price", align="R")
    pdf.cell(16, 4, "Total", align="R")

    pdf.set_draw_color(*emerald)
    pdf.set_line_width(0.3)
    pdf.line(3, yh + 4, 77, yh + 4)

    # Items
    pdf.set_font("Courier", "", 6.5)
    yi = yh + 6
    for item in sale.items:
        name = item.product_name[:18]
        pdf.set_y(yi)
        pdf.cell(32, 4, name, align="L")
        pdf.cell(10, 4, str(item.quantity), align="C")
        pdf.cell(16, 4, f"N{item.price:.2f}", align="R")
        pdf.cell(16, 4, f"N{item.subtotal:.2f}", align="R")
        yi += 4

    # Bottom separator
    pdf.set_y(yi + 2)
    pdf.set_draw_color(*gold)
    pdf.set_line_width(0.3)
    pdf.line(3, pdf.get_y(), 77, pdf.get_y())

    # Total row
    yt = pdf.get_y() + 3
    pdf.set_font("Courier", "B", 10)
    pdf.set_text_color(*emerald)
    pdf.set_y(yt)
    pdf.cell(36, 7, "", align="L")
    pdf.cell(16, 7, "TOTAL:", align="R")
    pdf.cell(16, 7, f"N{sale.total:.2f}", align="R")

    # Amount tendered if available
    if getattr(sale, 'amount_tendered', None) and sale.amount_tendered > 0:
        pdf.set_font("Courier", "", 8)
        pdf.set_text_color(*dark)
        pdf.set_y(yt + 7)
        pdf.cell(36, 5, "", align="L")
        pdf.cell(16, 5, "Tendered:", align="R")
        pdf.cell(16, 5, f"N{sale.amount_tendered:.2f}", align="R")
        pdf.set_y(yt + 12)
        pdf.cell(36, 5, "", align="L")
        pdf.cell(16, 5, "Change:", align="R")
        pdf.cell(16, 5, f"N{(sale.amount_tendered - sale.total):.2f}", align="R")

    # Footer
    yf = yt + 18
    pdf.set_draw_color(*gold)
    pdf.set_line_width(0.6)
    pdf.line(3, yf, 77, yf)
    pdf.set_text_color(*dark)
    pdf.set_font("Courier", "", 7)
    pdf.set_y(yf + 3)
    pdf.cell(72, 4, "Thank you for your purchase!", align="C")
    pdf.set_font("Courier", "", 6)
    pdf.set_y(yf + 7)
    pdf.cell(72, 4, "Emerald POS - All rights reserved", align="C")

    # Output
    from io import BytesIO
    buf = BytesIO()
    pdf.output(buf)
    buf.seek(0)

    from flask import send_file
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"receipt_{sale.sale_id}.pdf"
    )


@sales_bp.route("/api/sales", methods=["POST"])
def create_sale():
    data = request.json
    items_data = data.get("items", [])
    payment_method = data.get("payment_method", "cash")
    cashier = data.get("cashier", "")
    customer_id = data.get("customer_id", "")
    amount_tendered = data.get("amount_tendered")

    if not items_data:
        return jsonify({"error": "No items in sale"}), 400

    sale_items = []
    for item_data in items_data:
        sale_items.append(SaleItem(
            product_id=item_data["product_id"],
            product_name=item_data["product_name"],
            price=float(item_data["price"]),
            quantity=int(item_data["quantity"]),
            category=item_data.get("category", "")
        ))

    total = sum(item.subtotal for item in sale_items)
    sale = Sale(sale_items, total, payment_method, cashier, customer_id, amount_tendered)

    products_ll = load_products()
    for item in sale_items:
        product = products_ll.find("product_id", item.product_id)
        if product:
            product.sell(item.quantity)
            if product.is_low_stock():
                add_notification(
                    f"Low Stock: {product.name}",
                    f"{product.name} has only {product.quantity} units remaining!",
                    "low_stock"
                )
    save_products(products_ll)

    sales_ll = load_sales()
    sales_ll.append(sale)
    save_sales(sales_ll)

    add_notification(
        "Sale Completed",
        f"Sale #{sale.sale_id}: N{total:.2f} - {payment_method.upper()}",
        "sale_update"
    )

    return jsonify(sale.to_dict()), 201


@sales_bp.route("/api/sales/daily", methods=["GET"])
def get_daily_sales():
    ll = load_sales()
    today = datetime.now().strftime("%Y-%m-%d")
    daily_sales = [s for s in ll if s.timestamp.startswith(today)]

    total_revenue = sum(s.total for s in daily_sales)
    total_transactions = len(daily_sales)
    items_sold = sum(sum(item.quantity for item in s.items) for s in daily_sales)

    return jsonify({
        "date": today,
        "revenue": total_revenue,
        "transactions": total_transactions,
        "items_sold": items_sold,
        "sales": [s.to_dict() for s in daily_sales]
    })


@sales_bp.route("/api/sales/trends", methods=["GET"])
def get_sales_trends():
    ll = load_sales()
    days = request.args.get("days", 7, type=int)

    trends = []
    for i in range(days - 1, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        day_sales = [s for s in ll if s.timestamp.startswith(date)]
        trends.append({
            "date": date,
            "revenue": sum(s.total for s in day_sales),
            "transactions": len(day_sales)
        })

    return jsonify(trends)

