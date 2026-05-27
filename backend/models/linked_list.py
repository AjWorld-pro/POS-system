class Node:
    def __init__(self, data):
        self.data = data
        self.next = None
        self.prev = None


class LinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self._size = 0

    def append(self, data):
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            self.tail = new_node
        else:
            self.tail.next = new_node
            new_node.prev = self.tail
            self.tail = new_node
        self._size += 1
        return new_node

    def prepend(self, data):
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            self.tail = new_node
        else:
            new_node.next = self.head
            self.head.prev = new_node
            self.head = new_node
        self._size += 1
        return new_node

    def remove(self, data):
        current = self.head
        while current:
            if current.data == data:
                if current.prev:
                    current.prev.next = current.next
                if current.next:
                    current.next.prev = current.prev
                if current == self.head:
                    self.head = current.next
                if current == self.tail:
                    self.tail = current.prev
                self._size -= 1
                return True
            current = current.next
        return False

    def find(self, key, value):
        current = self.head
        while current:
            if hasattr(current.data, key) and getattr(current.data, key) == value:
                return current.data
            if isinstance(current.data, dict) and current.data.get(key) == value:
                return current.data
            current = current.next
        return None

    def find_all(self, key, value):
        results = []
        current = self.head
        while current:
            if hasattr(current.data, key) and getattr(current.data, key) == value:
                results.append(current.data)
            if isinstance(current.data, dict) and current.data.get(key) == value:
                results.append(current.data)
            current = current.next
        return results

    def to_list(self):
        result = []
        current = self.head
        while current:
            result.append(current.data)
            current = current.next
        return result

    def to_list_reverse(self):
        result = []
        current = self.tail
        while current:
            result.append(current.data)
            current = current.prev
        return result

    def filter(self, predicate):
        result = []
        current = self.head
        while current:
            if predicate(current.data):
                result.append(current.data)
            current = current.next
        return result

    def map(self, transform):
        result = []
        current = self.head
        while current:
            result.append(transform(current.data))
            current = current.next
        return result

    def sort(self, key_func, reverse=False):
        items = self.to_list()
        items.sort(key=key_func, reverse=reverse)
        new_list = LinkedList()
        for item in items:
            new_list.append(item)
        return new_list

    def __len__(self):
        return self._size

    def __iter__(self):
        current = self.head
        while current:
            yield current.data
            current = current.next

    def clear(self):
        self.head = None
        self.tail = None
        self._size = 0
