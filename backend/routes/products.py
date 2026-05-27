from flask import Blueprint, request, jsonify
from backend.models.product import Product
from backend.models.linked_list import LinkedList
from backend.utils.file_handler import read_json, write_json
import os

products_bp = Blueprint("products", __name__)


def load_products():
    data = read_json("products.json", [])
    ll = LinkedList()
    for item in data:
        ll.append(Product.from_dict(item))
    return ll


def save_products(ll):
    write_json("products.json", [p.to_dict() for p in ll])


@products_bp.route("/api/products", methods=["GET"])
def get_products():
    ll = load_products()
    category = request.args.get("category", "")
    search = request.args.get("search", "")
    min_price = request.args.get("min_price", "")
    max_price = request.args.get("max_price", "")
    low_stock = request.args.get("low_stock", "")

    results = ll.to_list()

    if search:
        search = search.lower()
        results = [p for p in results if search in p.name.lower() or search in p.description.lower()]

    if category:
        results = [p for p in results if p.category.lower() == category.lower()]

    if min_price:
        results = [p for p in results if p.price >= float(min_price)]
    if max_price:
        results = [p for p in results if p.price <= float(max_price)]

    if low_stock and low_stock.lower() == "true":
        results = [p for p in results if p.is_low_stock()]

    return jsonify([p.to_dict() for p in results])


@products_bp.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    ll = load_products()
    product = ll.find("product_id", product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product.to_dict())


@products_bp.route("/api/products", methods=["POST"])
def add_product():
    data = request.json
    if not data.get("name") or not data.get("category") or not data.get("price"):
        return jsonify({"error": "Name, category, and price are required"}), 400

    product = Product(
        name=data["name"],
        category=data["category"],
        price=float(data["price"]),
        quantity=int(data.get("quantity", 0)),
        image=data.get("image", ""),
        description=data.get("description", ""),
        barcode=data.get("barcode", ""),
        low_stock_threshold=int(data.get("low_stock_threshold", 5))
    )

    ll = load_products()
    ll.append(product)
    save_products(ll)

    return jsonify(product.to_dict()), 201


@products_bp.route("/api/products/<product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.json
    ll = load_products()
    product = ll.find("product_id", product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    if "name" in data:
        product.name = data["name"]
    if "category" in data:
        product.category = data["category"]
    if "price" in data:
        product.price = float(data["price"])
    if "quantity" in data:
        product.quantity = int(data["quantity"])
    if "image" in data:
        product.image = data["image"]
    if "description" in data:
        product.description = data["description"]
    if "barcode" in data:
        product.barcode = data["barcode"]
    if "low_stock_threshold" in data:
        product.low_stock_threshold = int(data["low_stock_threshold"])

    from datetime import datetime
    product.updated_at = datetime.now().isoformat()

    save_products(ll)
    return jsonify(product.to_dict())


@products_bp.route("/api/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    ll = load_products()
    product = ll.find("product_id", product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    ll.remove(product)
    save_products(ll)
    return jsonify({"message": "Product deleted"}), 200


@products_bp.route("/api/products/categories", methods=["GET"])
def get_categories():
    ll = load_products()
    categories = set()
    for p in ll:
        categories.add(p.category)
    return jsonify(sorted(list(categories)))


@products_bp.route("/api/products/barcode/<barcode>", methods=["GET"])
def get_product_by_barcode(barcode):
    ll = load_products()
    product = ll.find("barcode", barcode)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product.to_dict())


@products_bp.route("/api/products/<product_id>/image", methods=["POST"])
def upload_image(product_id):
    ll = load_products()
    product = ll.find("product_id", product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    if "image" in request.files:
        file = request.files["image"]
        if file.filename:
            upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            ext = file.filename.rsplit(".", 1)[1] if "." in file.filename else "jpg"
            filename = f"{product_id}.{ext}"
            filepath = os.path.join(upload_dir, filename)
            file.save(filepath)
            product.image = f"/uploads/{filename}"
            save_products(ll)
            return jsonify({"image": product.image})

    if "image_data" in request.json:
        product.image = request.json["image_data"]
        save_products(ll)
        return jsonify({"image": product.image})

    return jsonify({"error": "No image provided"}), 400


@products_bp.route("/api/products/export/csv", methods=["GET"])
def export_products_csv():
    ll = load_products()
    lines = ["name,category,price,quantity,barcode,description"]
    for p in ll:
        desc = p.description.replace(",", " ").replace("\n", " ")
        lines.append(f"{p.name},{p.category},{p.price},{p.quantity},{p.barcode},{desc}")
    return "\n".join(lines), 200, {"Content-Type": "text/csv", "Content-Disposition": "attachment; filename=products.csv"}
