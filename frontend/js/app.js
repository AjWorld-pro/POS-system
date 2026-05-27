const App = {
    user: null,
    cart: { items: [], total: 0 },
    theme: localStorage.getItem('pos-theme') || 'light',
    currentPage: 'feed',
    allProducts: [],
    allCategories: [],

    async init() {
        this.applyTheme();
        this.bindEvents();
        const token = localStorage.getItem('pos-user');
        if (token) {
            try {
                const data = JSON.parse(token);
                this.user = data;
                this.showMainApp();
                this.loadInitialData().then(() => {
                    if (!data.interests || data.interests.length === 0) {
                        setTimeout(() => this.showInterestPopup(), 800);
                    }
                });
                return;
            } catch (e) {}
        }
        document.getElementById('login-screen').classList.add('active');
    },

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        document.getElementById('theme-toggle').innerHTML =
            this.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    },

    bindEvents() {
        // Login
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab + '-form').classList.add('active');
            });
        });
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Clear errors on input
        document.querySelectorAll('.auth-form input').forEach(inp => {
            inp.addEventListener('input', () => {
                const form = inp.closest('form');
                const errEl = form.querySelector('.error-message');
                if (errEl) errEl.textContent = '';
            });
        });

        // Navigation
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(el.dataset.page);
            });
        });

        // Search
        let searchTimer;
        document.getElementById('global-search').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            const q = e.target.value.trim();
            if (q.length < 2) {
                document.getElementById('search-suggestions').classList.remove('show');
                return;
            }
            searchTimer = setTimeout(() => this.fetchSearchSuggestions(q), 300);
        });
        document.getElementById('global-search').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = e.target.value.trim();
                if (q) {
                    document.getElementById('search-suggestions').classList.remove('show');
                    this.navigateTo('inventory');
                    this.searchProducts(q);
                }
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('pos-theme', this.theme);
            this.applyTheme();
        });

        // Cart button
        document.getElementById('cart-btn').addEventListener('click', () => this.openCart());

        // Notifications
        document.getElementById('notif-btn').addEventListener('click', () => {
            document.getElementById('notif-panel').classList.toggle('open');
            if (document.getElementById('notif-panel').classList.contains('open')) {
                this.loadNotifications();
            }
        });
        document.getElementById('close-notif').addEventListener('click', () => {
            document.getElementById('notif-panel').classList.remove('open');
        });
        document.getElementById('mark-all-read').addEventListener('click', () => {
            api.markAllRead().then(() => this.loadNotifications());
        });

        // User menu
        document.getElementById('user-menu').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown').classList.toggle('show');
        });
        document.addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.remove('show');
        });
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('pos-user');
            this.user = null;
            document.getElementById('main-app').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        });

        // Modal
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancel-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        document.getElementById('product-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // Cart
        document.getElementById('close-cart').addEventListener('click', () => this.closeCart());
        document.getElementById('cart-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeCart();
        });
        document.getElementById('clear-cart').addEventListener('click', () => {
            this.cart = { items: [], total: 0 };
            this.renderCart();
            this.updatePOSCartBadge();
        });
        document.getElementById('checkout-btn').addEventListener('click', () => this.openPayment());

        document.getElementById('close-payment').addEventListener('click', () => this.closePayment());
        document.getElementById('pay-cancel').addEventListener('click', () => this.closePayment());
        document.getElementById('payment-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closePayment();
        });
        document.getElementById('pay-now').addEventListener('click', () => this.processPayment());
        document.getElementById('pay-method').addEventListener('change', () => {});

        // Receipt
        document.getElementById('close-receipt').addEventListener('click', () => this.closeReceipt());
        document.getElementById('receipt-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeReceipt();
        });
        document.getElementById('print-receipt').addEventListener('click', () => {
            const content = document.getElementById('receipt-content').textContent;
            const win = window.open('', '', 'width=400,height=600');
            win.document.write(`<pre style="font-family:monospace;font-size:13px;">${content}</pre>`);
            win.print();
        });

        document.getElementById('download-pdf-receipt').addEventListener('click', () => {
            const saleId = this._currentReceiptSaleId;
            if (saleId) {
                window.open(`/api/sales/${saleId}/receipt/pdf`, '_blank');
            }
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('left-sidebar').classList.toggle('open');
        });
    },

    async handleLogin() {
        const btn = document.querySelector('#login-form .btn-primary');
        const errEl = document.getElementById('login-error');
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        try {
            const data = await api.login(username, password);
            this.user = data;
            localStorage.setItem('pos-user', JSON.stringify(data));
            this.showMainApp();
            await this.loadInitialData();
            // Show interest popup after login (Quora-style)
            if (!data.interests || data.interests.length === 0) {
                setTimeout(() => this.showInterestPopup(), 500);
            }
        } catch (err) {
            errEl.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    },

    async handleRegister() {
        const btn = document.querySelector('#register-form .btn-primary');
        const errEl = document.getElementById('register-error');
        const data = {
            username: document.getElementById('reg-username').value,
            password: document.getElementById('reg-password').value,
            name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
        };
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        try {
            const result = await api.register(data.username, data.password, data.name, data.email);
            this.user = result;
            localStorage.setItem('pos-user', JSON.stringify(result));
            this.showMainApp();
            await this.loadInitialData();
            // Show interest popup for new users
            setTimeout(() => this.showInterestPopup(), 500);
        } catch (err) {
            errEl.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    },

    showMainApp() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        document.getElementById('user-name').textContent = this.user.name || this.user.username;
    },

    async loadInitialData() {
        await Promise.all([
            this.loadFeed(),
            this.loadTrending(),
            this.loadNotifications(),
            this.loadSidebarCategories(),
        ]);
    },

    // === INTEREST POPUP (QUORA-STYLE) ===
    async showInterestPopup() {
        const popup = document.getElementById('interest-popup');
        const grid = document.getElementById('interest-grid');

        try {
            const categories = await api.getFeedCategories();
            const userInterests = this.user?.interests || [];

            const iconMap = {
                'Electronics': 'fa-laptop', 'Clothing': 'fa-tshirt', 'Food & Beverages': 'fa-utensils',
                'Food': 'fa-utensils', 'Beverages': 'fa-wine-bottle', 'Stationery': 'fa-pen',
                'Books': 'fa-book', 'Sports': 'fa-running', 'Home & Kitchen': 'fa-home',
                'Home': 'fa-home', 'Beauty': 'fa-spa', 'Toys': 'fa-gamepad',
                'Automotive': 'fa-car', 'Garden': 'fa-leaf', 'Health': 'fa-heartbeat',
                'Music': 'fa-music', 'Shoes': 'fa-shoe-prints', 'Accessories': 'fa-glasses',
                'Furniture': 'fa-couch', 'Tools': 'fa-tools', 'Pet': 'fa-paw', 'Baby': 'fa-baby',
            };

            grid.innerHTML = categories.map(cat => {
                const icon = iconMap[cat.name] || 'fa-tag';
                const selected = userInterests.includes(cat.name);
                return `<div class="interest-chip ${selected ? 'selected' : ''}" data-category="${cat.name}" onclick="this.classList.toggle('selected')">
                    <i class="fas ${icon}"></i>
                    <span>${cat.name}</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${cat.count}</span>
                </div>`;
            }).join('');

            popup.classList.add('open');

            // Unbind previous listeners to avoid duplicates
            const saveBtn = document.getElementById('interest-save');
            const skipBtn = document.getElementById('interest-skip');
            const newSave = saveBtn.cloneNode(true);
            const newSkip = skipBtn.cloneNode(true);
            saveBtn.replaceWith(newSave);
            skipBtn.replaceWith(newSkip);

            newSave.addEventListener('click', async () => {
                const selected = [...grid.querySelectorAll('.interest-chip.selected')].map(el => el.dataset.category);
                await api.updateInterests(this.user.user_id, selected);
                this.user.interests = selected;
                localStorage.setItem('pos-user', JSON.stringify(this.user));
                popup.classList.remove('open');
                this.showToast('Feed personalized! Showing your preferred categories.', 'success');
                this.loadFeed();
            });

            newSkip.addEventListener('click', () => {
                if (this.user && this.user.interests.length > 0) {
                    this.user.interests = [];
                    api.updateInterests(this.user.user_id, []);
                    localStorage.setItem('pos-user', JSON.stringify(this.user));
                }
                popup.classList.remove('open');
                this.showToast('Showing all products and categories.', '');
                this.loadFeed();
            });

            // Close on overlay click
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.classList.remove('open');
                }
            });

        } catch (err) {
            console.error('Failed to load interest popup', err);
            this.loadFeed();
        }
    },

    hideInterestPopup() {
        document.getElementById('interest-popup').classList.remove('open');
    },

    navigateTo(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
        document.getElementById('left-sidebar').classList.remove('open');

        switch (page) {
            case 'feed': this.loadFeed(); break;
            case 'inventory': this.loadInventory(); break;
            case 'pos': this.loadPOS(); break;
            case 'sales': this.loadSales(); break;
            case 'analytics': this.loadAnalytics(); break;
            case 'profile': this.loadProfile(); break;
            case 'settings': this.loadSettings(); break;
        }
    },

    // === FEED (E-COMMERCE STYLE) ===
    async loadFeed() {
        const container = document.getElementById('page-feed');
        container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        try {
            const [dashboard, sections, categories] = await Promise.all([
                api.getDashboard(),
                api.getFeed({ user_id: this.user?.user_id || '' }),
                api.getFeedCategories(),
            ]);
            container.innerHTML = '';
            container.appendChild(this.renderHeroBanner(dashboard));
            for (const section of sections) {
                if (section.type === 'welcome') {
                    continue;
                } else {
                    container.appendChild(this.renderECSection(section));
                }
            }
            container.appendChild(this.renderPreferencePicker(categories));
        } catch (err) {
            container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--red)"><i class="fas fa-exclamation-circle fa-2x"></i><p style="margin-top:12px">Failed to load feed</p></div>`;
        }
    },

    renderHeroBanner(dashboard) {
        const div = document.createElement('div');
        div.className = 'hero-banner';
        const d = dashboard;
        const interests = this.user?.interests || [];
        const interestStr = interests.length > 0
            ? interests.slice(0, 3).join(', ') + (interests.length > 3 ? ` +${interests.length - 3} more` : '')
            : 'All Categories';

        div.innerHTML = `
            <div class="hero-text">
                <h1>Welcome${this.user ? ', ' + (this.user.name || this.user.username) : ''}!</h1>
                <p><i class="fas fa-rss" style="color:var(--accent-gold)"></i> Your Feed: <strong>${interestStr}</strong></p>
            </div>
            <div class="hero-stats">
                <div class="hero-stat">
                    <div class="hero-stat-value">₦${d.today.revenue.toFixed(0)}</div>
                    <div class="hero-stat-label">Today</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${d.overview.total_products}</div>
                    <div class="hero-stat-label">Products</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${d.overview.total_transactions}</div>
                    <div class="hero-stat-label">Sales</div>
                </div>
            </div>
        `;
        return div;
    },

    renderPreferencePicker(categories) {
        const section = document.createElement('div');
        section.className = 'shop-section';

        const iconMap = {
            'Electronics': 'fa-laptop', 'Clothing': 'fa-tshirt', 'Food': 'fa-utensils',
            'Beverages': 'fa-wine-bottle', 'Stationery': 'fa-pen', 'Books': 'fa-book',
            'Sports': 'fa-running', 'Home': 'fa-home', 'Beauty': 'fa-spa',
            'Toys': 'fa-gamepad', 'Automotive': 'fa-car', 'Garden': 'fa-leaf',
            'Health': 'fa-heartbeat', 'Music': 'fa-music', 'Shoes': 'fa-shoe-prints',
            'Accessories': 'fa-glasses', 'Furniture': 'fa-couch', 'Tools': 'fa-tools',
            'Pet': 'fa-paw', 'Baby': 'fa-baby',
        };
        const colorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFD93D',
            '#6C5CE7', '#A8E6CF', '#FF8A5C', '#3DC1D3', '#E77F67',
            '#786FA6', '#F190B7', '#88D8B0', '#B6E5D8', '#F7DC6F',
        ];

        const userInterests = this.user?.interests || [];
        section.innerHTML = `
            <div class="shop-section-header">
                <h2><i class="fas fa-compass"></i> Browse Categories</h2>
                <span class="view-all" onclick="App.loadFeed()">Refresh</span>
            </div>
            <div class="pref-grid" id="pref-grid">
                ${categories.map((cat, i) => {
                    const icon = iconMap[cat.name] || 'fa-tag';
                    const color = colorPalette[i % colorPalette.length];
                    const selected = userInterests.includes(cat.name);
                    return `<div class="pref-card ${selected ? 'selected' : ''}" data-category="${cat.name}" onclick="App.togglePref(this)">
                        <div class="pref-card-icon" style="background:${color}22;color:${color}"><i class="fas ${icon}"></i></div>
                        <div class="pref-card-name">${cat.name}</div>
                        <div class="pref-card-count">${cat.count} items</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="pref-save-bar">
                <button class="btn-primary btn-full" id="pref-save-btn" style="max-width:300px"><i class="fas fa-check"></i> Save My Preferences</button>
            </div>
        `;

        setTimeout(() => {
            document.getElementById('pref-save-btn')?.addEventListener('click', async () => {
                const selected = [...document.querySelectorAll('.pref-card.selected')].map(el => el.dataset.category);
                if (this.user) {
                    await api.updateInterests(this.user.user_id, selected);
                    this.user.interests = selected;
                    localStorage.setItem('pos-user', JSON.stringify(this.user));
                    this.showToast('Preferences saved! Feed updated', 'success');
                    this.loadFeed();
                }
            });
        }, 50);
        return section;
    },

    togglePref(el) {
        el.classList.toggle('selected');
    },

    renderECSection(section) {
        const div = document.createElement('div');
        div.className = 'shop-section';
        const items = section.items || [];

        if (items.length === 0) return div;

        const header = document.createElement('div');
        header.className = 'shop-section-header';
        const titleIcon = {
            'interests': 'fa-star',
            'new': 'fa-clock',
            'trending': 'fa-fire',
            'low_stock': 'fa-exclamation-triangle',
            'other': 'fa-th-large',
        };
        const icon = titleIcon[section.type] || 'fa-box';
        const iconColor = section.type === 'interests' || section.type === 'other' ? 'var(--accent-gold)' : 'var(--accent)';

        const topicBadge = section.type === 'category'
            ? `<span style="display:inline-block;background:var(--accent-gold-light);color:var(--text-primary);padding:2px 12px;border-radius:20px;font-size:11px;font-weight:600;margin-left:8px;border:1px solid var(--accent-gold)">${section.category}</span>`
            : '';

        const viewAllLink = section.type === 'category'
            ? `<a href="#" onclick="App.navigateTo('inventory');App.filterByCategory('${section.category.replace(/'/g, "\\'")}');return false">View All →</a>`
            : section.type === 'trending' ? `<a href="#" data-page="inventory">View All →</a>`
            : section.type === 'other' ? `<a href="#" data-page="inventory">View All →</a>` : '';
        header.innerHTML = `
            <h2><i class="fas ${icon}" style="color:${iconColor};margin-right:6px"></i> ${section.title}${topicBadge}</h2>
            ${viewAllLink}
        `;

        const wrap = document.createElement('div');
        wrap.className = 'scroll-row-wrap';

        wrap.innerHTML = `
            <button class="scroll-arrow left" onclick="this.nextElementSibling.scrollBy({left:-400,behavior:'smooth'})"><i class="fas fa-chevron-left"></i></button>
            <div class="scroll-row"></div>
            <button class="scroll-arrow right" onclick="this.previousElementSibling.scrollBy({left:400,behavior:'smooth'})"><i class="fas fa-chevron-right"></i></button>
        `;

        const row = wrap.querySelector('.scroll-row');
        items.forEach(item => {
            row.appendChild(this.createECProductCard(item, section.type));
        });

        div.appendChild(header);
        div.appendChild(wrap);
        return div;
    },

    createECProductCard(product, sectionType) {
        const div = document.createElement('div');
        div.className = 'ec-product-card';
        const isFav = this.user?.favorites?.includes(product.product_id);
        const outOfStock = product.quantity === 0;
        const lowStock = product.is_low_stock && product.quantity > 0;

        let badge = '';
        if (sectionType === 'trending' && product.sold_count > 3) badge = '<span class="ec-product-badge trending"><i class="fas fa-fire"></i> Trending</span>';
        else if (sectionType === 'new') badge = '<span class="ec-product-badge new"><i class="fas fa-clock"></i> New</span>';
        else if (lowStock) badge = '<span class="ec-product-badge low">Low Stock</span>';

        const stockClass = outOfStock ? 'out' : lowStock ? 'low' : '';
        const stockText = outOfStock ? 'Out of stock' : lowStock ? `Only ${product.quantity} left` : `${product.quantity} in stock`;

        div.innerHTML = `
            <div class="ec-product-img">
                ${product.image ? `<img src="${product.image}" alt="${product.name}">` : '<i class="fas fa-box"></i>'}
                ${badge}
                <button class="ec-product-fav ${isFav ? 'favorited' : ''}" onclick="event.stopPropagation();App.toggleFav('${product.product_id}')">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="ec-product-body">
                <div class="ec-product-name">${product.name}</div>
                <div class="ec-product-category">${product.category}</div>
                <div class="ec-product-price-row">
                    <div>
                        <span class="ec-product-price">₦${product.price.toFixed(2)}</span>
                        ${product.sold_count > 10 ? `<span class="ec-product-old-price">₦${(product.price * 1.2).toFixed(2)}</span>` : ''}
                    </div>
                    <span class="ec-product-stock ${stockClass}">${outOfStock ? '—' : '✓'}</span>
                </div>
                ${product.sold_count > 0 ? `<div class="ec-sold-count"><i class="fas fa-shopping-bag"></i> ${product.sold_count} sold</div>` : ''}
            </div>
            <div class="ec-product-actions">
                ${outOfStock
                    ? '<button class="ec-add-cart" style="background:var(--text-muted);cursor:not-allowed" disabled>Out of Stock</button>'
                    : `<button class="ec-add-cart" onclick="event.stopPropagation();App.addToCart('${product.product_id}')"><i class="fas fa-cart-plus"></i> Add</button>`
                }
            </div>
        `;
        div.addEventListener('click', () => this.showProductDetail(product));
        return div;
    },

    // === INVENTORY ===
    async loadInventory(searchQuery) {
        const container = document.getElementById('page-inventory');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2><i class="fas fa-boxes"></i> Inventory</h2>
                    <button class="btn-primary" id="add-product-btn"><i class="fas fa-plus"></i> Add Product</button>
                </div>
                <div class="inventory-toolbar">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="inv-search" placeholder="Search products..." value="${searchQuery || ''}">
                    </div>
                    <div class="filter-group">
                        <select id="inv-category"><option value="">All Categories</option></select>
                        <input type="number" id="inv-min-price" placeholder="Min (₦)" style="width:80px">
                        <input type="number" id="inv-max-price" placeholder="Max (₦)" style="width:80px">
                        <label style="display:flex;align-items:center;gap:4px;font-size:13px">
                            <input type="checkbox" id="inv-low-stock"> Low Stock
                        </label>
                    </div>
                </div>
                <div class="inventory-table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Quantity</th>
                                <th>Sold</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="inv-tbody"></tbody>
                    </table>
                </div>
                <div id="inv-empty" style="display:none;text-align:center;padding:40px;color:var(--text-muted)">
                    <i class="fas fa-box-open fa-3x" style="margin-bottom:12px"></i>
                    <p>No products found</p>
                </div>
            </div>
        `;

        document.getElementById('add-product-btn').addEventListener('click', () => this.showProductModal());

        // Filters
        const doFilter = () => this.filterInventory();
        document.getElementById('inv-search').addEventListener('input', doFilter);
        document.getElementById('inv-category').addEventListener('change', doFilter);
        document.getElementById('inv-min-price').addEventListener('input', doFilter);
        document.getElementById('inv-max-price').addEventListener('input', doFilter);
        document.getElementById('inv-low-stock').addEventListener('change', doFilter);

        try {
            const categories = await api.getCategories();
            const catSelect = document.getElementById('inv-category');
            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                catSelect.appendChild(opt);
            });
            this.allCategories = categories;
        } catch (e) {}

        this.filterInventory();
    },

    async filterInventory() {
        const search = document.getElementById('inv-search').value.trim();
        const category = document.getElementById('inv-category').value;
        const minPrice = document.getElementById('inv-min-price').value;
        const maxPrice = document.getElementById('inv-max-price').value;
        const lowStock = document.getElementById('inv-low-stock').checked;

        const params = {};
        if (search) params.search = search;
        if (category) params.category = category;
        if (minPrice) params.min_price = minPrice;
        if (maxPrice) params.max_price = maxPrice;
        if (lowStock) params.low_stock = 'true';

        try {
            const products = await api.getProducts(params);
            this.allProducts = products;
            const tbody = document.getElementById('inv-tbody');
            const empty = document.getElementById('inv-empty');
            if (products.length === 0) {
                tbody.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            tbody.innerHTML = products.map(p => `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td><span class="category-tag">${p.category}</span></td>
                    <td><strong>₦${p.price.toFixed(2)}</strong></td>
                    <td>
                        <span class="stock-indicator">
                            <span class="stock-dot ${p.quantity === 0 ? 'out' : p.is_low_stock ? 'low' : 'ok'}"></span>
                            ${p.quantity}
                            ${p.is_low_stock ? '<span style="color:var(--orange);font-size:11px">(Low)</span>' : ''}
                        </span>
                    </td>
                    <td>${p.sold_count}</td>
                    <td>
                        <button class="btn-icon" onclick="App.editProduct('${p.product_id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="App.duplicateProduct('${p.product_id}')" title="Duplicate"><i class="fas fa-copy"></i></button>
                        <button class="btn-icon" onclick="App.deleteProduct('${p.product_id}')" title="Delete" style="color:var(--red)"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            this.showToast('Failed to load inventory', 'error');
        }
    },

    searchProducts(query) {
        document.getElementById('inv-search').value = query;
        this.filterInventory();
    },

    showProductModal(product) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('modal-title');
        if (product) {
            title.innerHTML = '<i class="fas fa-edit"></i> Edit Product';
            document.getElementById('product-id').value = product.product_id;
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-price').value = product.price;
            document.getElementById('p-quantity').value = product.quantity;
            document.getElementById('p-threshold').value = product.low_stock_threshold;
            document.getElementById('p-barcode').value = product.barcode || '';
            document.getElementById('p-description').value = product.description || '';
            document.getElementById('p-image').value = product.image || '';
        } else {
            title.innerHTML = '<i class="fas fa-box"></i> Add Product';
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
        }
        // Populate category datalist
        const datalist = document.getElementById('category-list');
        datalist.innerHTML = this.allCategories.map(c => `<option value="${c}">`).join('');
        modal.classList.add('open');
    },

    closeModal() {
        document.getElementById('product-modal').classList.remove('open');
    },

    async saveProduct() {
        const id = document.getElementById('product-id').value;
        const data = {
            name: document.getElementById('p-name').value,
            category: document.getElementById('p-category').value,
            price: parseFloat(document.getElementById('p-price').value),
            quantity: parseInt(document.getElementById('p-quantity').value) || 0,
            low_stock_threshold: parseInt(document.getElementById('p-threshold').value) || 5,
            barcode: document.getElementById('p-barcode').value,
            description: document.getElementById('p-description').value,
            image: document.getElementById('p-image').value,
        };

        try {
            if (id) {
                await api.updateProduct(id, data);
                this.showToast('Product updated', 'success');
            } else {
                await api.addProduct(data);
                this.showToast('Product added', 'success');
            }
            this.closeModal();
            this.filterInventory();
            this.loadFeed();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    editProduct(id) {
        const product = this.allProducts.find(p => p.product_id === id);
        if (product) this.showProductModal(product);
    },

    duplicateProduct(id) {
        const product = this.allProducts.find(p => p.product_id === id);
        if (product) {
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
            document.getElementById('p-name').value = product.name + ' (Copy)';
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-price').value = product.price;
            document.getElementById('p-quantity').value = 0;
            document.getElementById('p-threshold').value = product.low_stock_threshold;
            document.getElementById('p-barcode').value = '';
            document.getElementById('p-description').value = product.description || '';
            document.getElementById('p-image').value = product.image || '';
            document.getElementById('modal-title').innerHTML = '<i class="fas fa-copy"></i> Duplicate Product';
            document.getElementById('product-modal').classList.add('open');
        }
    },

    async deleteProduct(id) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await api.deleteProduct(id);
            this.showToast('Product deleted', 'success');
            this.filterInventory();
            this.loadFeed();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // === POS ===
    async loadPOS() {
        const container = document.getElementById('page-pos');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-box"></i> Products</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <div class="search-box" style="max-width:250px">
                            <i class="fas fa-search"></i>
                            <input type="text" id="pos-search" placeholder="Search products...">
                        </div>
                        <button class="icon-btn" id="pos-cart-btn" title="View Cart" style="position:relative">
                            <i class="fas fa-shopping-cart"></i>
                            <span id="pos-cart-badge" class="badge" style="display:none">0</span>
                        </button>
                    </div>
                </div>
                <div class="pos-products" id="pos-products"></div>
            </div>
        `;

        document.getElementById('pos-search').addEventListener('input', (e) => this.loadPOSProducts(e.target.value));
        document.getElementById('pos-cart-btn').addEventListener('click', () => this.openCart());
        this.loadPOSProducts();
    },

    async loadPOSProducts(query) {
        const container = document.getElementById('pos-products');
        try {
            const params = query ? { search: query } : {};
            const products = await api.getProducts(params);
            container.innerHTML = products.filter(p => p.quantity > 0).map(p => `
                <div class="pos-product-item" onclick="App.addToCart('${p.product_id}')">
                    <div style="font-size:28px;margin-bottom:4px">${p.image ? `<img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">` : '📦'}</div>
                    <div class="name">${p.name}</div>
                    <div class="price">₦${p.price.toFixed(2)}</div>
                    <div class="stock">Stock: ${p.quantity}</div>
                </div>
            `).join('') || '<p style="text-align:center;padding:20px;color:var(--text-muted)">No products available</p>';
        } catch (e) {
            container.innerHTML = '<p style="color:var(--red)">Failed to load products</p>';
        }
    },

    async addToCart(productId) {
        try {
            const product = this.allProducts.find(p => p.product_id === productId)
                || await api.getProduct(productId);
            const existing = this.cart.items.find(i => i.product_id === productId);
            const currentQty = existing ? existing.quantity : 0;

            if (currentQty >= product.quantity) {
                this.showToast('Not enough stock', 'warning');
                return;
            }

            if (existing) {
                existing.quantity += 1;
                existing.subtotal = existing.quantity * existing.price;
            } else {
                this.cart.items.push({
                    product_id: product.product_id,
                    product_name: product.name,
                    price: product.price,
                    quantity: 1,
                    subtotal: product.price,
                    category: product.category
                });
            }
            this.cart.total = this.cart.items.reduce((s, i) => s + i.subtotal, 0);
            this.renderCart();
            this.updatePOSCartBadge();
        } catch (err) {
            this.showToast('Failed to add to cart', 'error');
        }
    },

    updateCartQty(productId, delta) {
        const item = this.cart.items.find(i => i.product_id === productId);
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            this.cart.items = this.cart.items.filter(i => i.product_id !== productId);
        } else {
            item.quantity = newQty;
            item.subtotal = newQty * item.price;
        }
        this.cart.total = this.cart.items.reduce((s, i) => s + i.subtotal, 0);
        this.renderCart();
        this.updatePOSCartBadge();
    },

    renderCart() {
        const container = document.getElementById('cart-items');
        const countEl = document.getElementById('cart-count');
        const totalEl = document.getElementById('cart-total');
        if (!container) return;
        const navCount = document.getElementById('nav-cart-count');
        const totalQty = this.cart.items.reduce((s, i) => s + i.quantity, 0);
        if (countEl) countEl.textContent = totalQty;
        if (navCount) navCount.textContent = totalQty;
        if (totalEl) totalEl.textContent = `₦${this.cart.total.toFixed(2)}`;
        if (this.cart.items.length === 0) {
            container.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-cart fa-3x" style="margin-bottom:12px;opacity:0.3"></i><p>Your cart is empty</p></div>';
            return;
        }
        container.innerHTML = this.cart.items.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.product_name}</div>
                    <div class="cart-item-price">₦${item.price.toFixed(2)} × ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button onclick="App.updateCartQty('${item.product_id}', -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="App.updateCartQty('${item.product_id}', 1)">+</button>
                    <button onclick="App.updateCartQty('${item.product_id}', -item.quantity)" style="color:var(--red)"><i class="fas fa-trash"></i></button>
                </div>
                <div style="font-weight:600">₦${item.subtotal.toFixed(2)}</div>
            </div>
        `).join('');
    },

    updatePOSCartBadge() {
        const badge = document.getElementById('pos-cart-badge');
        if (!badge) return;
        const count = this.cart.items.reduce((s, i) => s + i.quantity, 0);
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },

    openCart() {
        document.getElementById('cart-overlay').classList.add('open');
        this.renderCart();
    },

    closeCart() {
        document.getElementById('cart-overlay').classList.remove('open');
    },

    // === PAYMENT ===
    openPayment() {
        if (this.cart.items.length === 0) {
            this.showToast('Cart is empty', 'warning');
            return;
        }
        const summary = document.getElementById('payment-summary');
        summary.innerHTML = `
            <div style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
                <strong>Order Summary</strong> <span style="float:right">${this.cart.items.reduce((s, i) => s + i.quantity, 0)} items</span>
            </div>
            ${this.cart.items.map(i => `
                <div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0">
                    <span>${i.product_name} × ${i.quantity}</span>
                    <span>₦${i.subtotal.toFixed(2)}</span>
                </div>
            `).join('')}
            <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;font-size:16px">
                <span>Total</span>
                <span>₦${this.cart.total.toFixed(2)}</span>
            </div>
        `;
        document.getElementById('pay-method').value = 'card';
        document.getElementById('processing-section').style.display = 'none';
        document.getElementById('pay-now').style.display = 'block';
        document.getElementById('pay-now').disabled = false;
        document.getElementById('payment-modal').classList.add('open');
    },

    closePayment() {
        document.getElementById('payment-modal').classList.remove('open');
    },

    async processPayment() {
        const payBtn = document.getElementById('pay-now');
        payBtn.disabled = true;
        const method = document.getElementById('pay-method').value;
        const processing = document.getElementById('processing-section');

        // Show processing
        processing.style.display = 'block';
        payBtn.style.display = 'none';

        // Simulate payment processing delay
        await new Promise(r => setTimeout(r, 1200));

        try {
            const sale = await api.createSale({
                items: this.cart.items,
                payment_method: method,
                cashier: this.user?.name || this.user?.username || 'Unknown'
            });
            this.cart = { items: [], total: 0 };
            this.renderCart();
            this.updatePOSCartBadge();
            this.closePayment();
            this.showReceipt(sale.sale_id);
            this.showToast('Sale completed!', 'success');
            this.loadPOSProducts();
        } catch (err) {
            this.showToast(err.message, 'error');
            processing.style.display = 'none';
            payBtn.style.display = 'block';
            payBtn.disabled = false;
        }
    },

    // === RECEIPT ===
    async showReceipt(saleId) {
        try {
            this._currentReceiptSaleId = saleId;
            const data = await api.getReceipt(saleId);
            document.getElementById('receipt-content').textContent = data.receipt;
            document.getElementById('receipt-modal').classList.add('open');
        } catch (err) {
            this.showToast('Failed to load receipt', 'error');
        }
    },

    closeReceipt() {
        document.getElementById('receipt-modal').classList.remove('open');
    },

    // === SALES ===
    async loadSales() {
        const container = document.getElementById('page-sales');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2><i class="fas fa-receipt"></i> Sales History</h2>
                    <button class="btn-secondary" onclick="App.loadSales()"><i class="fas fa-sync"></i> Refresh</button>
                </div>
                <div class="inventory-toolbar">
                    <div class="filter-group">
                        <input type="date" id="sales-start">
                        <span>to</span>
                        <input type="date" id="sales-end">
                        <button class="btn-sm" onclick="App.filterSales()">Filter</button>
                    </div>
                </div>
                <div class="sales-list" id="sales-list"></div>
                <div id="sales-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px"></div>
            </div>
        `;
        this.filterSales();
    },

    async filterSales(page = 1) {
        const list = document.getElementById('sales-list');
        const pagination = document.getElementById('sales-pagination');
        list.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';

        const params = { page, per_page: 20 };
        const start = document.getElementById('sales-start')?.value;
        const end = document.getElementById('sales-end')?.value;
        if (start) params.start_date = start;
        if (end) params.end_date = end;

        try {
            const data = await api.getSales(params);
            if (data.sales.length === 0) {
                list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No sales found</div>';
                pagination.innerHTML = '';
                return;
            }
            list.innerHTML = data.sales.map(s => `
                <div class="sale-item" onclick="App.showReceipt('${s.sale_id}')">
                    <div class="sale-info">
                        <div class="sale-id">#${s.sale_id}</div>
                        <div class="sale-meta">${new Date(s.timestamp).toLocaleString()} · ${s.items.length} items · <span class="sale-method">${s.payment_method}</span></div>
                    </div>
                    <div class="sale-total">₦${s.total.toFixed(2)}</div>
                </div>
            `).join('');

            pagination.innerHTML = '';
            for (let i = 1; i <= data.pages; i++) {
                const btn = document.createElement('button');
                btn.className = `btn-sm${i === data.page ? ' btn-primary' : ''}`;
                btn.textContent = i;
                btn.onclick = () => this.filterSales(i);
                pagination.appendChild(btn);
            }
        } catch (err) {
            list.innerHTML = '<p style="color:var(--red)">Failed to load sales</p>';
        }
    },

    // === ANALYTICS ===
    async loadAnalytics() {
        const container = document.getElementById('page-analytics');
        container.innerHTML = '<div class="card"><p style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin fa-2x"></i></p></div>';
        try {
            const [dashboard, topProducts, revenue, inventory] = await Promise.all([
                api.getDashboard(),
                api.getTopProducts(8),
                api.getRevenueAnalytics(14),
                api.getInventoryStatus(),
            ]);
            container.innerHTML = this.renderAnalytics(dashboard, topProducts, revenue, inventory);
        } catch (err) {
            container.innerHTML = '<div class="card"><p style="color:var(--red)">Failed to load analytics</p></div>';
        }
    },

    renderAnalytics(dashboard, topProducts, revenue, inventory) {
        const d = dashboard;
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--accent-light);color:var(--accent)"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">₦${d.today.revenue.toFixed(2)}</div>
                    <div class="stat-label">Today's Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--green-light);color:var(--green)"><i class="fas fa-shopping-cart"></i></div>
                    <div class="stat-value">${d.today.transactions}</div>
                    <div class="stat-label">Today's Transactions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--orange-light);color:var(--orange)"><i class="fas fa-boxes"></i></div>
                    <div class="stat-value">${d.inventory.total_products}</div>
                    <div class="stat-label">Total Products</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--red-light);color:var(--red)"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-value">${d.inventory.low_stock}</div>
                    <div class="stat-label">Low Stock Items</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--accent-light);color:var(--accent)"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-value">₦${d.overview.total_revenue.toFixed(2)}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--green-light);color:var(--green)"><i class="fas fa-shopping-bag"></i></div>
                    <div class="stat-value">${d.overview.total_transactions}</div>
                    <div class="stat-label">Total Sales</div>
                </div>
            </div>

            <div class="chart-container">
                <h3><i class="fas fa-chart-bar"></i> Revenue (Last 14 Days)</h3>
                <div class="chart-bars" id="revenue-chart">
                    ${revenue.map(r => {
                        const max = Math.max(...revenue.map(x => x.revenue), 1);
                        const h = (r.revenue / max) * 180;
                        return `<div class="chart-bar-wrap">
                            <div class="chart-bar" style="height:${h}px;background:${r.revenue > 0 ? 'var(--accent)' : 'var(--border-color)'}"></div>
                            <div class="chart-bar-label">${r.date.slice(5)}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="chart-container">
                    <h3><i class="fas fa-fire"></i> Top Selling Products</h3>
                    ${topProducts.map((p, i) => `
                        <div class="top-selling-item">
                            <span class="rank">#${i + 1}</span>
                            <span style="flex:1">${p.name}</span>
                            <span style="font-weight:600">${p.sold_count} sold</span>
                        </div>
                    `).join('') || '<p style="color:var(--text-muted)">No data yet</p>'}
                </div>

                <div class="chart-container">
                    <h3><i class="fas fa-exclamation-triangle"></i> Inventory Status</h3>
                    <div class="stats-grid" style="grid-template-columns:1fr">
                        <div class="stat-card" style="padding:12px;box-shadow:none;background:var(--bg-tertiary)">
                            <div style="display:flex;justify-content:space-between;margin:4px 0">
                                <span>In Stock</span>
                                <span style="font-weight:600;color:var(--green)">${inventory.in_stock}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin:4px 0">
                                <span>Low Stock</span>
                                <span style="font-weight:600;color:var(--orange)">${inventory.low_stock}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin:4px 0">
                                <span>Out of Stock</span>
                                <span style="font-weight:600;color:var(--red)">${inventory.out_of_stock}</span>
                            </div>
                            <hr style="margin:8px 0">
                            <div style="display:flex;justify-content:space-between">
                                <span>Stock Value</span>
                                <span style="font-weight:700">₦${inventory.stock_value.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <h4 style="margin-top:12px;font-size:14px">Low Stock Products</h4>
                    ${dashboard.inventory.low_stock_products.map(p => `
                        <div class="stock-alert-item">
                            <i class="fas fa-exclamation-circle"></i>
                            <span style="flex:1">${p.name}</span>
                            <span style="font-weight:600">${p.quantity} left</span>
                        </div>
                    `).join('') || '<p style="font-size:13px;color:var(--text-muted)">No low stock items</p>'}
                </div>
            </div>
        `;
    },

    // === NOTIFICATIONS ===
    async loadNotifications() {
        const list = document.getElementById('notif-list');
        try {
            const notifs = await api.getNotifications();
            const unread = await api.getUnreadCount();
            document.getElementById('notif-badge').textContent = unread.unread;

            if (notifs.length === 0) {
                list.innerHTML = '<div class="notif-empty">No notifications</div>';
                return;
            }
            list.innerHTML = notifs.map(n => {
                const iconMap = { low_stock: 'exclamation-triangle', new_product: 'box', sale_update: 'shopping-cart', system: 'bell' };
                const colorMap = { low_stock: 'var(--orange)', new_product: 'var(--accent)', sale_update: 'var(--green)', system: 'var(--text-muted)' };
                return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="App.markNotifRead('${n.notification_id}')">
                    <div class="notif-icon" style="background:${colorMap[n.type] || colorMap.system};color:white">
                        <i class="fas fa-${iconMap[n.type] || iconMap.system}"></i>
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-message">${n.message}</div>
                        <div class="notif-time">${this.timeAgo(n.created_at)}</div>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {}
    },

    async markNotifRead(id) {
        try {
            await api.markRead(id);
            this.loadNotifications();
        } catch (e) {}
    },

    // === SIDEBAR ===
    async loadSidebarCategories() {
        const container = document.getElementById('sidebar-categories');
        try {
            const cats = await api.getFeedCategories();
            container.innerHTML = cats.map(c =>
                `<div class="cat-item" data-category="${c.name}" onclick="App.navigateTo('inventory');App.filterByCategory('${c.name.replace(/'/g, "\\'")}')">${c.name}</div>`
            ).join('');
        } catch (e) {}
    },

    filterByCategory(category) {
        setTimeout(() => {
            const catSelect = document.getElementById('inv-category');
            if (catSelect) {
                catSelect.value = category;
                this.filterInventory();
            }
        }, 100);
    },

    async loadTrending() {
        const trendingEl = document.getElementById('trending-list');
        const topSellingEl = document.getElementById('top-selling-list');
        const alertsEl = document.getElementById('stock-alerts');
        try {
            const rec = await api.getRecommended(this.user?.user_id || '');
            trendingEl.innerHTML = rec.top_selling.slice(0, 5).map((p, i) =>
                `<div class="trending-item"><span class="rank">#${i + 1}</span><span style="flex:1">${p.name}</span><span style="font-size:12px;color:var(--text-muted)">${p.sold_count}</span></div>`
            ).join('') || '<p style="font-size:13px;color:var(--text-muted)">No data</p>';

            topSellingEl.innerHTML = rec.recently_updated.slice(0, 5).map((p, i) =>
                `<div class="top-selling-item"><span class="rank">#${i + 1}</span><span style="flex:1">${p.name}</span><span style="font-size:12px;color:var(--green)">₦${p.price.toFixed(2)}</span></div>`
            ).join('') || '<p style="font-size:13px;color:var(--text-muted)">No data</p>';

            const dashboard = await api.getDashboard();
            alertsEl.innerHTML = dashboard.inventory.low_stock_products.slice(0, 4).map(p =>
                `<div class="stock-alert-item"><i class="fas fa-exclamation-circle"></i><span style="flex:1">${p.name}</span><span style="font-weight:600">${p.quantity}</span></div>`
            ).join('') || '<p style="font-size:13px;color:var(--text-muted)">All stocked up</p>';
        } catch (e) {}
    },

    async fetchSearchSuggestions(q) {
        try {
            const suggestions = await api.getSearchSuggestions(q);
            const el = document.getElementById('search-suggestions');
            if (suggestions.length === 0) { el.classList.remove('show'); return; }
            el.innerHTML = suggestions.map(s => `<div onclick="App.searchFromSuggestion('${s.replace(/'/g, "\\'")}')">${s}</div>`).join('');
            el.classList.add('show');
        } catch (e) {}
    },

    searchFromSuggestion(suggestion) {
        document.getElementById('search-suggestions').classList.remove('show');
        if (suggestion.startsWith('in ')) {
            this.navigateTo('inventory');
            document.getElementById('inv-category').value = suggestion.slice(3);
            this.filterInventory();
        } else {
            this.navigateTo('inventory');
            this.searchProducts(suggestion);
        }
        document.getElementById('global-search').value = suggestion;
    },

    // === PROFILE ===
    loadProfile() {
        const container = document.getElementById('page-profile');
        const u = this.user;
        container.innerHTML = `
            <div class="card profile-card">
                <div class="profile-avatar"><i class="fas fa-user"></i></div>
                <h2>${u.name || u.username}</h2>
                <p style="color:var(--text-muted)">@${u.username} · ${u.role}</p>
                <div style="margin-top:16px">
                    <h4>Your Interests</h4>
                    <div class="interest-pills" id="profile-interests"></div>
                    <button class="btn-gold" id="profile-save-interests" style="margin-top:12px"><i class="fas fa-save"></i> Save Preferences</button>
                </div>
            </div>
        `;
        setTimeout(() => this.loadProfileInterests(), 50);
    },

    async loadProfileInterests() {
        const container = document.getElementById('profile-interests');
        if (!container) return;
        try {
            const categories = await api.getCategories();
            const userInterests = this.user.interests || [];
            container.innerHTML = categories.map(cat =>
                `<button class="pill-btn ${userInterests.includes(cat) ? 'selected' : ''}" data-category="${cat}">${cat}</button>`
            ).join('');
            container.querySelectorAll('.pill-btn').forEach(btn => {
                btn.addEventListener('click', () => btn.classList.toggle('selected'));
            });
            document.getElementById('profile-save-interests')?.addEventListener('click', async () => {
                const selected = [...container.querySelectorAll('.pill-btn.selected')].map(b => b.dataset.category);
                await api.updateInterests(this.user.user_id, selected);
                this.user.interests = selected;
                localStorage.setItem('pos-user', JSON.stringify(this.user));
                this.showToast('Interests saved!', 'success');
            });
        } catch (e) {}
    },

    // === SETTINGS ===
    loadSettings() {
        const container = document.getElementById('page-settings');
        const interests = this.user?.interests || [];
        container.innerHTML = `
            <div class="card">
                <h3 style="margin-bottom:16px"><i class="fas fa-cog"></i> Settings</h3>

                <div class="settings-section">
                    <h3><i class="fas fa-sliders-h"></i> Feed Preferences</h3>
                    <div class="settings-row">
                        <span>Your interests <span style="font-size:12px;color:var(--text-muted)">(${interests.length} selected)</span></span>
                        <button class="btn-primary" id="settings-edit-interests" style="padding:6px 14px;font-size:13px"><i class="fas fa-edit"></i> Edit</button>
                    </div>
                    <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px" id="settings-interest-tags">
                        ${interests.length > 0
                            ? interests.map(i => `<span style="background:var(--accent-gold-light);color:var(--text-primary);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid var(--accent-gold)">${i}</span>`).join('')
                            : '<span style="font-size:13px;color:var(--text-muted)">No preferences set — showing all products</span>'
                        }
                    </div>
                </div>

                <hr>

                <div class="settings-section">
                    <h3>Appearance</h3>
                    <div class="settings-row">
                        <span>Dark Mode</span>
                        <button class="toggle ${this.theme === 'dark' ? 'on' : ''}" id="settings-theme-toggle"></button>
                    </div>
                </div>

                <hr>

                <div class="settings-section">
                    <h3>Data Management</h3>
                    <div class="settings-row">
                        <span>Create Backup</span>
                        <button class="btn-sm" id="settings-backup"><i class="fas fa-download"></i> Backup</button>
                    </div>
                    <div class="settings-row">
                        <span>Restore Latest Backup</span>
                        <button class="btn-sm" id="settings-restore"><i class="fas fa-upload"></i> Restore</button>
                    </div>
                </div>

                <hr>

                <div class="settings-section">
                    <h3>Account</h3>
                    <div class="settings-row">
                        <span>Export Products (CSV)</span>
                        <a href="/api/products/export/csv" class="btn-sm" target="_blank"><i class="fas fa-file-csv"></i> Export</a>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('settings-edit-interests')?.addEventListener('click', () => {
            this.showInterestPopup();
        });

        document.getElementById('settings-theme-toggle').addEventListener('click', () => {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('pos-theme', this.theme);
            this.applyTheme();
            this.loadSettings();
        });

        document.getElementById('settings-backup').addEventListener('click', async () => {
            try {
                await api.createBackup();
                this.showToast('Backup created!', 'success');
            } catch (e) { this.showToast('Backup failed', 'error'); }
        });

        document.getElementById('settings-restore').addEventListener('click', async () => {
            if (!confirm('Restore latest backup? Current data will be overwritten.')) return;
            try {
                await api.restoreBackup('');
                this.showToast('Backup restored!', 'success');
            } catch (e) { this.showToast('Restore failed', 'error'); }
        });
    },

    // === UTILS ===
    createProductCard(product) {
        const div = document.createElement('div');
        div.className = 'product-card';
        const isFav = this.user?.favorites?.includes(product.product_id);
        div.innerHTML = `
            ${product.is_low_stock ? '<span class="low-stock-badge">Low Stock</span>' : ''}
            <div class="product-card-img">
                ${product.image ? `<img src="${product.image}" alt="${product.name}">` : '<i class="fas fa-box"></i>'}
            </div>
            <div class="product-card-body">
                <h4>${product.name}</h4>
                <span class="category-tag">${product.category}</span>
                <div class="price">₦${product.price.toFixed(2)}</div>
                <div class="quantity">${product.quantity} in stock</div>
            </div>
            <div class="product-card-actions">
                <button class="btn-add-cart" onclick="event.stopPropagation();App.addToCart('${product.product_id}')"><i class="fas fa-cart-plus"></i> Cart</button>
                <button class="btn-fav ${isFav ? 'favorited' : ''}" onclick="event.stopPropagation();App.toggleFav('${product.product_id}')"><i class="fas fa-heart"></i></button>
            </div>
        `;
        div.addEventListener('click', () => this.showProductDetail(product));
        return div;
    },

    showProductDetail(product) {
        // Quick view - could expand to a full modal
        this.showToast(`${product.name}: ₦${product.price.toFixed(2)} · ${product.quantity} in stock`, '');
    },

    async toggleFav(productId) {
        if (!this.user) return;
        const isFav = this.user.favorites?.includes(productId);
        try {
            if (isFav) {
                await api.removeFavorite(this.user.user_id, productId);
                this.user.favorites = this.user.favorites.filter(f => f !== productId);
            } else {
                await api.addFavorite(this.user.user_id, productId);
                if (!this.user.favorites) this.user.favorites = [];
                this.user.favorites.push(productId);
            }
            this.loadFeed();
            this.showToast(isFav ? 'Removed from favorites' : 'Added to favorites', 'success');
        } catch (e) {
            this.showToast('Failed to update favorite', 'error');
        }
    },

    showToast(message, type = '') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-circle' };
        toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
