import uuid
from datetime import datetime


class Product:
    def __init__(self, name, category, price, quantity, image="", description="", barcode="", low_stock_threshold=5):
        self.product_id = str(uuid.uuid4())[:8]
        self.name = name
        self.category = category
        self.price = float(price)
        self.quantity = int(quantity)
        self.image = image
        self.description = description
        self.barcode = barcode
        self.low_stock_threshold = int(low_stock_threshold)
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self.sold_count = 0

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "name": self.name,
            "category": self.category,
            "price": self.price,
            "quantity": self.quantity,
            "image": self.image,
            "description": self.description,
            "barcode": self.barcode,
            "low_stock_threshold": self.low_stock_threshold,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "sold_count": self.sold_count
        }

    @classmethod
    def from_dict(cls, data):
        product = cls(
            name=data["name"],
            category=data["category"],
            price=data["price"],
            quantity=data["quantity"],
            image=data.get("image", ""),
            description=data.get("description", ""),
            barcode=data.get("barcode", ""),
            low_stock_threshold=data.get("low_stock_threshold", 5)
        )
        product.product_id = data.get("product_id", product.product_id)
        product.created_at = data.get("created_at", product.created_at)
        product.updated_at = data.get("updated_at", product.updated_at)
        product.sold_count = data.get("sold_count", 0)
        return product

    def is_low_stock(self):
        return self.quantity <= self.low_stock_threshold

    def update_quantity(self, new_quantity):
        self.quantity = max(0, int(new_quantity))
        self.updated_at = datetime.now().isoformat()

    def sell(self, quantity):
        if quantity > self.quantity:
            return False
        self.quantity -= quantity
        self.sold_count += quantity
        self.updated_at = datetime.now().isoformat()
        return True

    def restock(self, quantity):
        self.quantity += int(quantity)
        self.updated_at = datetime.now().isoformat()
