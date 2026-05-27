import uuid
from datetime import datetime


class SaleItem:
    def __init__(self, product_id, product_name, price, quantity, category=""):
        self.product_id = product_id
        self.product_name = product_name
        self.price = float(price)
        self.quantity = int(quantity)
        self.subtotal = self.price * self.quantity
        self.category = category

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "product_name": self.product_name,
            "price": self.price,
            "quantity": self.quantity,
            "subtotal": self.subtotal,
            "category": self.category
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            product_id=data["product_id"],
            product_name=data["product_name"],
            price=data["price"],
            quantity=data["quantity"],
            category=data.get("category", "")
        )


class Sale:
    def __init__(self, items, total, payment_method="cash", cashier="", customer_id="", amount_tendered=None):
        self.sale_id = str(uuid.uuid4())[:8]
        self.items = [item if isinstance(item, SaleItem) else SaleItem.from_dict(item) for item in items]
        self.total = float(total)
        self.payment_method = payment_method
        self.cashier = cashier
        self.customer_id = customer_id
        self.timestamp = datetime.now().isoformat()
        self.status = "completed"
        self.amount_tendered = float(amount_tendered) if amount_tendered else 0.0

    def to_dict(self):
        return {
            "sale_id": self.sale_id,
            "items": [item.to_dict() for item in self.items],
            "total": self.total,
            "payment_method": self.payment_method,
            "cashier": self.cashier,
            "customer_id": self.customer_id,
            "timestamp": self.timestamp,
            "status": self.status,
            "amount_tendered": self.amount_tendered
        }

    @classmethod
    def from_dict(cls, data):
        items = [SaleItem.from_dict(item) for item in data.get("items", [])]
        sale = cls(
            items=items,
            total=data["total"],
            payment_method=data.get("payment_method", "cash"),
            cashier=data.get("cashier", ""),
            customer_id=data.get("customer_id", "")
        )
        sale.sale_id = data.get("sale_id", sale.sale_id)
        sale.timestamp = data.get("timestamp", sale.timestamp)
        sale.status = data.get("status", "completed")
        sale.amount_tendered = float(data.get("amount_tendered", 0))
        return sale

    def generate_receipt(self):
        receipt = []
        receipt.append("=" * 50)
        receipt.append(f"{'POS SYSTEM RECEIPT':^50}")
        receipt.append("=" * 50)
        receipt.append(f"Sale ID: {self.sale_id}")
        receipt.append(f"Date: {self.timestamp}")
        receipt.append(f"Cashier: {self.cashier}")
        receipt.append("-" * 50)
        receipt.append(f"{'Item':<25}{'Qty':<5}{'Price':<10}{'Subtotal':<10}")
        receipt.append("-" * 50)
        for item in self.items:
            receipt.append(f"{item.product_name[:24]:<25}{item.quantity:<5}N{item.price:<9.2f}N{item.subtotal:<9.2f}")
        receipt.append("-" * 50)
        receipt.append(f"{'Total':>40}N{self.total:.2f}")
        receipt.append(f"{'Payment:':<15}{self.payment_method}")
        if self.amount_tendered and self.amount_tendered > 0:
            receipt.append(f"{'Tendered:':>40}N{self.amount_tendered:.2f}")
            receipt.append(f"{'Change:':>40}N{(self.amount_tendered - self.total):.2f}")
        receipt.append("=" * 50)
        receipt.append(f"{'Thank you for your purchase!':^50}")
        receipt.append("=" * 50)
        return "\n".join(receipt)
