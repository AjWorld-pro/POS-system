"""Seed the database with sample products, a demo user, and sample sales."""
import sys, os, json, random
sys.path.insert(0, os.path.dirname(__file__))

from backend.models.product import Product
from backend.models.user import User
from backend.models.sale import Sale, SaleItem
from backend.models.linked_list import LinkedList
from backend.utils.file_handler import read_json, write_json


def seed():
    # --- Users ---
    users_data = read_json("users.json", [])
    if any(u["username"] == "admin" for u in users_data):
        print("Admin user already exists, skipping user seed.")
    else:
        admin = User("admin", "admin123", role="admin", name="Store Admin", email="admin@pos.com")
        admin.interests = ["Electronics", "Clothing", "Food & Beverages", "Stationery"]
        cashier = User("cashier", "cashier123", role="cashier", name="Jane Cashier", email="jane@pos.com")
        write_json("users.json", [admin.to_dict(), cashier.to_dict()])
        print("Created users: admin / admin123  |  cashier / cashier123")

    # --- Products ---
    products_data = read_json("products.json", [])
    if products_data:
        print(f"Products already exist ({len(products_data)} found), skipping product seed.")
        products = [Product.from_dict(p) for p in products_data]
    else:
        # Scale factor ~17x with minimum 100 Naira
        def scale_price(usd):
            naira = round(usd * 17)
            return max(100, naira)

        categories = {
            "Electronics": [
                ("Wireless Bluetooth Headphones", scale_price(79.99), 25, 5, "🎧"),
                ("USB-C Hub 7-in-1", scale_price(34.99), 40, 10, "🔌"),
                ("Portable Power Bank 20K", scale_price(49.99), 30, 5, "🔋"),
                ("Mechanical Keyboard RGB", scale_price(89.99), 15, 3, "⌨️"),
                ("Wireless Mouse Ergonomic", scale_price(29.99), 50, 10, "🖱️"),
                ("HDMI Cable 6ft", scale_price(12.99), 100, 20, "🔗"),
                ("Smartphone Stand", scale_price(19.99), 35, 10, "📱"),
                ("Webcam 1080p", scale_price(59.99), 20, 5, "📷"),
                ("Noise Cancelling Earbuds", scale_price(129.99), 12, 3, "🎵"),
                ("Laptop Sleeve 15.6\"", scale_price(24.99), 45, 10, "💼"),
            ],
            "Clothing": [
                ("Classic Denim Jacket", scale_price(89.99), 20, 5, "🧥"),
                ("Cotton T-Shirt Pack (3)", scale_price(34.99), 60, 10, "👕"),
                ("Running Sneakers", scale_price(119.99), 18, 5, "👟"),
                ("Wool Beanie Hat", scale_price(19.99), 40, 10, "🧢"),
                ("Leather Belt", scale_price(39.99), 30, 8, "🪢"),
                ("Casual Hoodie", scale_price(59.99), 25, 5, "💪"),
                ("Slim Fit Chinos", scale_price(49.99), 22, 5, "👖"),
                ("Winter Scarf", scale_price(29.99), 35, 10, "🧣"),
                ("Formal Dress Shirt", scale_price(44.99), 28, 5, "👔"),
                ("Ankle Socks Pack (6)", scale_price(14.99), 80, 15, "🧦"),
            ],
            "Food & Beverages": [
                ("Organic Coffee Beans 1lb", scale_price(18.99), 40, 8, "☕"),
                ("Green Tea Variety Pack", scale_price(14.99), 55, 10, "🍵"),
                ("Dark Chocolate Bar 70%", scale_price(6.99), 90, 20, "🍫"),
                ("Almond Butter 16oz", scale_price(12.99), 35, 8, "🥜"),
                ("Sparkling Water 12pk", scale_price(9.99), 60, 12, "💧"),
                ("Trail Mix Snack Pack", scale_price(7.99), 75, 15, "🥨"),
                ("Protein Bars Box (12)", scale_price(28.99), 30, 6, "🏋️"),
                ("Honey 100% Pure 12oz", scale_price(15.99), 25, 5, "🍯"),
                ("Granola 3-Flavor Pack", scale_price(11.99), 45, 10, "🥣"),
                ("Coconut Water 6pk", scale_price(16.99), 40, 8, "🥥"),
            ],
            "Stationery": [
                ("Premium Notebook A5", scale_price(12.99), 80, 15, "📓"),
                ("Gel Pen Set (12)", scale_price(9.99), 100, 20, "🖊️"),
                ("Sticky Notes 4x4 (5pk)", scale_price(7.99), 70, 15, "📝"),
                ("Planner 2026 Weekly", scale_price(19.99), 35, 8, "📅"),
                ("Highlighter Set (6)", scale_price(8.99), 60, 12, "🟡"),
                ("Binder Clips Assorted", scale_price(5.99), 120, 25, "📎"),
                ("Desktop Organizer", scale_price(24.99), 20, 5, "🗄️"),
                ("Whiteboard Markers (4)", scale_price(6.99), 50, 10, "⬜"),
                ("Envelopes A4 (50pk)", scale_price(11.99), 40, 10, "✉️"),
                ("Washi Tape Set (10)", scale_price(8.99), 45, 10, "🎀"),
            ],
            "Home & Kitchen": [
                ("Stainless Water Bottle 32oz", scale_price(24.99), 50, 10, "🍶"),
                ("Bamboo Cutting Board", scale_price(19.99), 30, 8, "🪵"),
                ("Glass Meal Prep Set (5)", scale_price(34.99), 25, 5, "🥗"),
                ("Scented Candle Soy Jar", scale_price(16.99), 40, 10, "🕯️"),
                ("Microfiber Towel Set (4)", scale_price(22.99), 35, 8, "🧴"),
                ("Kitchen Timer Digital", scale_price(11.99), 45, 10, "⏲️"),
                ("Potholder & Oven Mitt Set", scale_price(14.99), 30, 8, "🧤"),
                ("Reusable Straws Set (8)", scale_price(9.99), 60, 15, "🥤"),
                ("Spice Rack 12-Jar", scale_price(28.99), 15, 4, "🧂"),
                ("Collapsible Colander", scale_price(13.99), 35, 8, "🍝"),
            ],
            "Books": [
                ("Atomic Habits", scale_price(24.99), 30, 5, "📚"),
                ("The Psychology of Money", scale_price(19.99), 25, 5, "🧠"),
                ("Dune Paperback", scale_price(18.99), 20, 4, "🏜️"),
                ("Cookbook: 30-Min Meals", scale_price(29.99), 15, 3, "🍳"),
                ("JavaScript: The Good Parts", scale_price(29.99), 12, 3, "💻"),
                ("The Alchemist", scale_price(16.99), 28, 5, "✨"),
                ("Thinking Fast and Slow", scale_price(22.99), 18, 4, "🧩"),
                ("World Atlas 2026", scale_price(39.99), 10, 2, "🌍"),
            ],
        }

        products = []
        pid = 0
        for cat_name, items in categories.items():
            for name, price, qty, threshold, icon in items:
                pid += 1
                p = Product(
                    name=name,
                    category=cat_name,
                    price=price,
                    quantity=qty if qty > 2 else random.randint(0, 2),
                    description=f"High-quality {name.lower()} — perfect for everyday use.",
                    low_stock_threshold=threshold,
                )
                p.image = f"https://placehold.co/200x150/059669/white?text={name[:1].upper()}"
                # Give some products sold counts so trending works
                p.sold_count = random.randint(0, 40)
                products.append(p)

        write_json("products.json", [p.to_dict() for p in products])
        print(f"Seeded {len(products)} products across {len(categories)} categories.")

    # --- Sample Sales ---
    sales_data = read_json("sales.json", [])
    if sales_data:
        print(f"Sales already exist ({len(sales_data)} found), skipping.")
    else:
        # Create 15 random sales over the past 7 days for demo data
        from datetime import datetime, timedelta
        products = [Product.from_dict(p) for p in read_json("products.json", [])]
        if not products:
            print("No products to create sales with, skipping.")
            return
        sales = []
        for day_offset in range(7, 0, -1):
            sales_today = random.randint(1, 4)
            for _ in range(sales_today):
                cart_items = random.sample(products, min(random.randint(1, 4), len(products)))
                items = []
                for p in cart_items:
                    qty = random.randint(1, 3)
                    items.append(SaleItem(p.product_id, p.name, p.price, qty, p.category))
                total = sum(i.subtotal for i in items)
                methods = ["card", "transfer", "pos"]
                sale = Sale(items, total, random.choice(methods), "Admin", "")
                # Backdate the timestamp
                ts = datetime.now() - timedelta(days=day_offset, hours=random.randint(0, 12), minutes=random.randint(0, 59))
                sale.timestamp = ts.isoformat()
                sales.append(sale)
                # Deduct stock & update sold_count
                for item in items:
                    p = next((x for x in products if x.product_id == item.product_id), None)
                    if p:
                        p.sell(item.quantity)
        write_json("sales.json", [s.to_dict() for s in sales])
        write_json("products.json", [p.to_dict() for p in products])
        print(f"Created {len(sales)} sample sales over the past 7 days.")

    print("\n✅ Seed complete! Login with:  admin / admin123")


if __name__ == "__main__":
    seed()
