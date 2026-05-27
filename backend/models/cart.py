class Cart:
    def __init__(self):
        self.items = []
        self.total = 0.0

    def add_item(self, product, quantity=1):
        quantity = int(quantity)
        for item in self.items:
            if item["product_id"] == product.product_id:
                item["quantity"] += quantity
                item["subtotal"] = item["quantity"] * item["price"]
                self._recalculate()
                return
        self.items.append({
            "product_id": product.product_id,
            "product_name": product.name,
            "price": product.price,
            "quantity": quantity,
            "subtotal": product.price * quantity,
            "image": product.image
        })
        self._recalculate()

    def remove_item(self, product_id):
        self.items = [item for item in self.items if item["product_id"] != product_id]
        self._recalculate()

    def update_quantity(self, product_id, quantity):
        quantity = int(quantity)
        for item in self.items:
            if item["product_id"] == product_id:
                if quantity <= 0:
                    self.remove_item(product_id)
                else:
                    item["quantity"] = quantity
                    item["subtotal"] = quantity * item["price"]
                self._recalculate()
                return

    def clear(self):
        self.items = []
        self.total = 0.0

    def _recalculate(self):
        self.total = sum(item["subtotal"] for item in self.items)

    def get_items(self):
        return self.items

    def get_item_count(self):
        return sum(item["quantity"] for item in self.items)

    def to_dict(self):
        return {
            "items": self.items,
            "total": self.total,
            "item_count": self.get_item_count()
        }
