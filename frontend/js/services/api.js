const API_BASE = window.location.origin;

const api = {
    async request(method, path, data = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data && method !== 'GET') {
            opts.body = JSON.stringify(data);
        }
        const res = await fetch(`${API_BASE}/api${path}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        if (res.status === 204) return null;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return res.json();
        }
        return res.text();
    },

    // Auth
    login: (username, password) => api.request('POST', '/auth/login', { username, password }),
    register: (username, password, name, email, role) =>
        api.request('POST', '/auth/register', { username, password, name, email, role }),

    // Products
    getProducts: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.request('GET', `/products${q ? '?' + q : ''}`);
    },
    getProduct: (id) => api.request('GET', `/products/${id}`),
    addProduct: (data) => api.request('POST', '/products', data),
    updateProduct: (id, data) => api.request('PUT', `/products/${id}`, data),
    deleteProduct: (id) => api.request('DELETE', `/products/${id}`),
    getCategories: () => api.request('GET', '/products/categories'),
    getProductByBarcode: (barcode) => api.request('GET', `/products/barcode/${encodeURIComponent(barcode)}`),

    // Sales
    getSales: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.request('GET', `/sales${q ? '?' + q : ''}`);
    },
    getSale: (id) => api.request('GET', `/sales/${id}`),
    createSale: (data) => api.request('POST', '/sales', data),
    getDailySales: () => api.request('GET', '/sales/daily'),
    getSalesTrends: (days = 7) => api.request('GET', `/sales/trends?days=${days}`),
    getReceipt: (id) => api.request('GET', `/sales/${id}/receipt`),
    getReceiptPdfUrl: (id) => `${API_BASE}/api/sales/${id}/receipt/pdf`,

    // Users
    getUsers: () => api.request('GET', '/users'),
    getUser: (id) => api.request('GET', `/users/${id}`),
    updateUser: (id, data) => api.request('PUT', `/users/${id}`, data),
    updateInterests: (id, interests) => api.request('PUT', `/users/${id}/interests`, { interests }),
    addFavorite: (id, productId) => api.request('POST', `/users/${id}/favorites`, { product_id: productId }),
    removeFavorite: (id, productId) => api.request('DELETE', `/users/${id}/favorites/${productId}`),

    // Notifications
    getNotifications: () => api.request('GET', '/notifications'),
    getUnreadCount: () => api.request('GET', '/notifications/unread'),
    markRead: (id) => api.request('PUT', `/notifications/${id}/read`),
    markAllRead: () => api.request('PUT', '/notifications/read-all'),

    // Feed
    getFeed: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.request('GET', `/feed${q ? '?' + q : ''}`);
    },
    getRecommended: (userId) => api.request('GET', `/feed/recommended${userId ? '?user_id=' + userId : ''}`),
    getFeedCategories: () => api.request('GET', '/feed/categories'),
    getSearchSuggestions: (q) => api.request('GET', `/feed/search-suggestions?q=${encodeURIComponent(q)}`),

    // Analytics
    getDashboard: () => api.request('GET', '/analytics/dashboard'),
    getTopProducts: (limit = 10) => api.request('GET', `/analytics/top-products?limit=${limit}`),
    getRevenueAnalytics: (days = 30) => api.request('GET', `/analytics/revenue?days=${days}`),
    getSalesSummary: (period = 'weekly') => api.request('GET', `/analytics/sales-summary?period=${period}`),
    getPaymentMethods: () => api.request('GET', '/analytics/payment-methods'),
    getInventoryStatus: () => api.request('GET', '/analytics/inventory-status'),

    // Backup
    createBackup: () => api.request('POST', '/backup'),
    restoreBackup: (file) => api.request('POST', '/backup/restore', { file }),
    listBackups: () => api.request('GET', '/backup/list'),
};
