// =========================================
//  SUSPENDRE — App Utilities
// =========================================

// ===== CART =====
const Cart = {
  KEY: 'suspendre_cart',
  OWNER_KEY: 'suspendre_cart_owner',
  GUEST_DIRTY_KEY: 'suspendre_cart_guest_dirty',
  SYNC_PENDING_KEY: 'suspendre_cart_sync_pending',
  cache: [],
  initialized: false,
  initPromise: null,
  syncPromise: Promise.resolve(),
  activeUserId: null,
  authTransitionUserId: null,
  authTransitionPromise: null,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  getStorageOwner() {
    return localStorage.getItem(this.OWNER_KEY) || 'guest';
  },

  isGuestDirty() {
    return localStorage.getItem(this.GUEST_DIRTY_KEY) === 'true';
  },

  setGuestDirty(value) {
    localStorage.setItem(this.GUEST_DIRTY_KEY, value ? 'true' : 'false');
  },

  isSyncPending() {
    return localStorage.getItem(this.SYNC_PENDING_KEY) === 'true';
  },

  setSyncPending(value) {
    localStorage.setItem(this.SYNC_PENDING_KEY, value ? 'true' : 'false');
  },

  normalizeItem(item) {
    if (!item || !item.productId) return null;
    const product = ProductData.getById(item.productId);
    if (!product || product.stock <= 0) return null;

    const qty = Math.max(1, Math.min(Number(item.qty) || 1, product.stock));
    return {
      productId: product.id,
      qty,
      savedForLater: !!item.savedForLater
    };
  },

  cloneItems(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => this.normalizeItem(item))
      .filter(Boolean);
  },

  loadLocalItems() {
    try {
      return this.cloneItems(JSON.parse(localStorage.getItem(this.KEY)) || []);
    } catch (error) {
      console.warn('Failed to parse cached cart. Resetting cart cache.', error);
      return [];
    }
  },

  persistLocal(items, owner = this.getStorageOwner(), options = {}) {
    this.cache = this.cloneItems(items);
    localStorage.setItem(this.KEY, JSON.stringify(this.cache));
    localStorage.setItem(this.OWNER_KEY, owner || 'guest');
    if (typeof options.guestDirty === 'boolean') {
      this.setGuestDirty(options.guestDirty);
    } else if ((owner || 'guest') !== 'guest') {
      this.setGuestDirty(false);
    }
    if (typeof options.syncPending === 'boolean') {
      this.setSyncPending(options.syncPending);
    }
    this.updateNavCount();
    window.dispatchEvent(new CustomEvent('suspendre:cart-updated', {
      detail: {
        items: this.getItems(),
        owner: owner || 'guest',
        count: this.getCount()
      }
    }));
  },

  async loadRemoteItems(userId) {
    const client = this.getClient();
    if (!client || !userId) return null;

    const { data, error } = await client
      .from('cart_items')
      .select('product_id, quantity, saved_for_later, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load cart items from Supabase.', error);
      return null;
    }

    return (data || [])
      .map(item => {
        const product = ProductData.getById(item.product_id);
        if (!product) return null;
        return this.normalizeItem({
          productId: product.id,
          qty: item.quantity,
          savedForLater: item.saved_for_later
        });
      })
      .filter(Boolean);
  },

  async replaceRemoteItems(userId, items) {
    const client = this.getClient();
    if (!client || !userId) return false;

    const normalizedItems = this.cloneItems(items);
    const rows = normalizedItems
      .map(item => {
        const product = ProductData.getById(item.productId);
        if (!product || !product.dbId) return null;
        return {
          user_id: userId,
          product_id: product.dbId,
          quantity: item.qty,
          saved_for_later: !!item.savedForLater
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      const { error } = await client
        .from('cart_items')
        .upsert(rows, { onConflict: 'user_id,product_id' });

      if (error) {
        console.error('Failed to save cart items to Supabase.', error);
        return false;
      }
    }

    const productIds = rows.map(row => row.product_id);
    let deleteQuery = client
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (productIds.length > 0) {
      deleteQuery = deleteQuery.not('product_id', 'in', `(${productIds.map(id => `"${id}"`).join(',')})`);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error('Failed to prune removed cart items from Supabase.', deleteError);
      return false;
    }

    return true;
  },

  mergeCollections(baseItems, extraItems) {
    const merged = new Map();

    [...this.cloneItems(baseItems), ...this.cloneItems(extraItems)].forEach(item => {
      const product = ProductData.getById(item.productId);
      if (!product || product.stock <= 0) return;
      const existing = merged.get(product.id);
      if (!existing) {
        merged.set(product.id, { qty: Math.min(item.qty, product.stock), savedForLater: !!item.savedForLater });
        return;
      }

      merged.set(product.id, {
        qty: Math.min(existing.qty + item.qty, product.stock),
        savedForLater: existing.savedForLater && !!item.savedForLater
      });
    });

    return Array.from(merged.entries()).map(([productId, state]) => ({
      productId,
      qty: state.qty,
      savedForLater: state.savedForLater
    }));
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await Auth.ready();
      await ProductData.ready();
      this.cache = this.loadLocalItems();

      const user = Auth.getCurrentUser();
      const client = this.getClient();
      const storageOwner = this.getStorageOwner();
      const shouldMergeGuestCart = storageOwner === 'guest' && this.isGuestDirty() && this.cache.length > 0;
      const shouldRestorePendingLocalCart = !!user && storageOwner === user.id && this.isSyncPending() && this.cache.length > 0;

      if (shouldRestorePendingLocalCart) {
        await this.replaceRemoteItems(user.id, this.cache);
        this.activeUserId = user.id;
        this.initialized = true;
        this.persistLocal(this.cache, user.id, { guestDirty: false, syncPending: false });
        return this.getItems();
      }

      if (user && client) {
        const remoteItems = await this.loadRemoteItems(user.id);

        if (Array.isArray(remoteItems)) {
          const mergedItems = shouldMergeGuestCart
            ? this.mergeCollections(remoteItems, this.cache)
            : remoteItems;

          if (shouldMergeGuestCart) {
            await this.replaceRemoteItems(user.id, mergedItems);
          }

          this.activeUserId = user.id;
          this.initialized = true;
          this.persistLocal(mergedItems, user.id, { guestDirty: false, syncPending: false });
          return this.getItems();
        }
      }

      this.activeUserId = user ? user.id : null;
      this.initialized = true;
      this.persistLocal(this.cache, user ? user.id : 'guest', {
        guestDirty: user ? false : this.isGuestDirty()
      });
      return this.getItems();
    })();

    return this.initPromise;
  },

  ready() {
    return this.init();
  },

  async handleAuthChange(user) {
    const nextUserId = user && user.id ? user.id : null;
    if (this.initialized && nextUserId === this.activeUserId) return;
    if (this.authTransitionPromise && nextUserId === this.authTransitionUserId) {
      return this.authTransitionPromise;
    }

    this.authTransitionUserId = nextUserId;
    this.authTransitionPromise = (async () => {
      this.initPromise = null;
      this.initialized = false;

      if (!nextUserId && this.getStorageOwner() !== 'guest') {
        this.persistLocal([], 'guest', { guestDirty: false });
      }

      await this.ready();
    })();

    try {
      await this.authTransitionPromise;
    } finally {
      this.authTransitionUserId = null;
      this.authTransitionPromise = null;
    }
  },

  scheduleRemoteSync() {
    const user = Auth.getCurrentUser();
    const client = this.getClient();
    if (!user || !client) return;

    const snapshot = this.getAllItems();
    this.setSyncPending(true);
    this.syncPromise = this.syncPromise
      .catch(() => undefined)
      .then(async () => {
        await this.replaceRemoteItems(user.id, snapshot);
        this.setSyncPending(false);
      })
      .catch((error) => {
        this.setSyncPending(true);
        throw error;
      });
  },

  async flushSync() {
    try {
      await this.syncPromise;
    } catch (error) {
      console.error('Cart sync did not finish cleanly.', error);
    }
  },

  getItems() {
    if (!this.initialized && this.cache.length === 0) {
      this.cache = this.loadLocalItems();
    }
    return this.cloneItems(this.cache).filter(item => !item.savedForLater);
  },

  getSavedItems() {
    if (!this.initialized && this.cache.length === 0) {
      this.cache = this.loadLocalItems();
    }
    return this.cloneItems(this.cache).filter(item => item.savedForLater);
  },

  getAllItems() {
    if (!this.initialized && this.cache.length === 0) {
      this.cache = this.loadLocalItems();
    }
    return this.cloneItems(this.cache);
  },

  saveItems(items, options = {}) {
    const user = Auth.getCurrentUser();
    const owner = options.owner || (user ? user.id : 'guest');
    this.persistLocal(items, owner, {
      guestDirty: typeof options.guestDirty === 'boolean' ? options.guestDirty : !user
    });

    if (options.syncRemote === false) return;
    this.scheduleRemoteSync();
  },

  addItem(productId, qty = 1) {
    const product = ProductData.getById(productId);
    if (!product || product.stock === 0) return false;

    const items = this.getAllItems();
    const existing = items.find(item => item.productId === product.id);

    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock);
      existing.savedForLater = false;
    } else {
      items.push({ productId: product.id, qty: Math.min(qty, product.stock), savedForLater: false });
    }

    this.saveItems(items);
    return true;
  },

  updateQty(productId, qty) {
    const product = ProductData.getById(productId);
    const items = this.getAllItems();
    const item = items.find(entry => entry.productId === productId && !entry.savedForLater);
    if (!item) return;

    if (qty <= 0) {
      this.removeItem(productId);
      return;
    }

    item.qty = product ? Math.min(qty, product.stock) : Math.max(1, qty);
    this.saveItems(items);
  },

  removeItem(productId) {
    const items = this.getAllItems().filter(item => !(item.productId === productId && !item.savedForLater));
    this.saveItems(items);
  },

  removeSavedItem(productId) {
    const items = this.getAllItems().filter(item => !(item.productId === productId && item.savedForLater));
    this.saveItems(items);
  },

  clear(options = {}) {
    const includeSaved = !!options.includeSaved;
    if (includeSaved) {
      this.saveItems([], options);
      return;
    }

    const savedItems = this.getSavedItems();
    this.saveItems(savedItems, options);
  },

  saveForLater(productId) {
    const items = this.getAllItems();
    const item = items.find(entry => entry.productId === productId && !entry.savedForLater);
    if (!item) return false;
    item.savedForLater = true;
    this.saveItems(items);
    return true;
  },

  moveSavedToCart(productId) {
    const items = this.getAllItems();
    const item = items.find(entry => entry.productId === productId && entry.savedForLater);
    if (!item) return false;

    const product = ProductData.getById(productId);
    if (!product || product.stock <= 0) return false;

    item.savedForLater = false;
    item.qty = Math.min(item.qty, product.stock);
    this.saveItems(items);
    return true;
  },

  getTotal() {
    return this.getItems().reduce((sum, item) => {
      const product = ProductData.getById(item.productId);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
  },

  getCount() {
    return this.getItems().reduce((sum, i) => sum + i.qty, 0);
  },

  updateNavCount() {
    const el = document.getElementById('cartCount');
    if (el) el.textContent = this.getCount();
  }
};

window.addEventListener('suspendre:auth-ready', (event) => {
  void Cart.handleAuthChange(event.detail ? event.detail.user : null);
});

// ===== CART DRAWER =====
const CartDrawer = {
  initialized: false,

  init() {
    if (this.initialized) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'cart-drawer-overlay';
    document.body.appendChild(this.overlay);

    this.drawer = document.createElement('div');
    this.drawer.className = 'cart-drawer';
    this.drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h2>Your Cart<span id="drawerCount">(0)</span></h2>
        <button class="drawer-close" id="drawerClose">&times;</button>
      </div>
      <div class="cart-drawer-items" id="drawerItems"></div>
      <div class="cart-drawer-footer">
        <div class="drawer-subtotal">
          <span>Subtotal</span>
          <span id="drawerSubtotal">$0.00</span>
        </div>
        <p class="drawer-shipping">Shipping & taxes calculated at checkout</p>
        <button class="btn-primary full-width" id="drawerCheckoutBtn">Proceed to Checkout</button>
      </div>
    `;
    document.body.appendChild(this.drawer);

    this.overlay.addEventListener('click', () => this.close());
    document.getElementById('drawerClose').addEventListener('click', () => this.close());
    document.getElementById('drawerCheckoutBtn').addEventListener('click', () => {
      window.location.href = 'cart.html';
    });

    this.initialized = true;
  },

  open() {
    this.init();
    this.render();
    this.overlay.classList.add('open');
    this.drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (!this.initialized) return;
    this.overlay.classList.remove('open');
    this.drawer.classList.remove('open');
    document.body.style.overflow = '';
  },

  render() {
    if (!this.initialized) return;
    const items = Cart.getItems();
    const itemsContainer = document.getElementById('drawerItems');
    const countEl = document.getElementById('drawerCount');
    const subtotalEl = document.getElementById('drawerSubtotal');

    countEl.textContent = `(${Cart.getCount()})`;

    if (items.length === 0) {
      itemsContainer.innerHTML = '<div class="drawer-empty">Your cart is empty.</div>';
      subtotalEl.textContent = '$0.00';
      return;
    }

    let subtotal = 0;
    itemsContainer.innerHTML = '';

    items.forEach(item => {
      const product = ProductData.getById(item.productId);
      if (!product) return;
      subtotal += product.price * item.qty;

      const row = document.createElement('div');
      row.className = 'drawer-item';
      const imgSrc = ProductData.getImageSrc(product);
      
      row.innerHTML = `
        <img src="${imgSrc}" class="drawer-item-img" alt="${product.name}">
        <div class="drawer-item-details">
          <p class="drawer-item-name">${product.name}</p>
          <p class="drawer-item-price">${formatPrice(product.price)}</p>
          <div class="drawer-qty-controls">
            <button class="qty-btn" onclick="CartDrawer.updateQty('${product.id}', ${item.qty - 1})">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="CartDrawer.updateQty('${product.id}', ${item.qty + 1})">+</button>
          </div>
        </div>
      `;
      itemsContainer.appendChild(row);
    });

    subtotalEl.textContent = formatPrice(subtotal);
  },

  updateQty(productId, qty) {
    Cart.updateQty(productId, qty);
    this.render();
    Cart.updateNavCount();
  }
};

// ===== ORDERS =====
const Orders = {
  KEY: 'suspendre_orders',
  cache: [],
  initPromise: null,
  initialized: false,
  source: 'fallback',
  customerSnapshotColumnsAvailable: null,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  hasMissingColumnError(error, columnName) {
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return message.includes(columnName.toLowerCase()) && message.includes('column');
  },

  hasMissingFunctionError(error, functionName) {
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return message.includes(functionName.toLowerCase()) && (message.includes('function') || message.includes('rpc'));
  },

  getSelectClause(includeSnapshots = true) {
    const fields = [
      'id',
      'user_id',
      'status',
      'payment_method',
      'payment_status',
      'total_amount',
      'created_at'
    ];

    if (includeSnapshots) {
      fields.push('customer_name_snapshot', 'customer_email_snapshot');
    }

    fields.push(`
      order_items (
        id,
        product_id,
        product_name_snapshot,
        unit_price,
        quantity,
        subtotal,
        created_at
      )
    `);

    return fields.join(', ');
  },

  normalizeItem(item) {
    const product = ProductData.getById(item.product_id);
    return {
      productId: product ? product.id : item.product_id,
      name: item.product_name_snapshot || (product ? product.name : 'Unknown'),
      price: Number(item.unit_price) || 0,
      qty: Number(item.quantity) || 0,
      subtotal: Number(item.subtotal) || 0
    };
  },

  normalizeOrder(order) {
    const currentUser = Auth.getCurrentUser();
    const isOwnOrder = !!currentUser && currentUser.id === order.user_id;
    return {
      id: order.id,
      userId: order.user_id,
      userName: order.customer_name_snapshot || (isOwnOrder ? currentUser.name : 'Suspendre Customer'),
      userEmail: order.customer_email_snapshot || (isOwnOrder ? currentUser.email : ''),
      items: Array.isArray(order.order_items) ? order.order_items.map(item => this.normalizeItem(item)) : [],
      total: Number(order.total_amount) || 0,
      status: order.status || 'pending',
      paymentMethod: order.payment_method || '',
      paymentStatus: order.payment_status || 'pending',
      createdAt: order.created_at || new Date().toISOString()
    };
  },

  loadFallbackOrders() {
    const stored = localStorage.getItem(this.KEY);
    if (!stored) return [];

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to parse cached orders. Resetting fallback orders.', error);
      return [];
    }
  },

  persistCache() {
    localStorage.setItem(this.KEY, JSON.stringify(this.cache));
  },

  async loadFromSupabase() {
    const client = this.getClient();
    if (!client) return null;

    if (this.customerSnapshotColumnsAvailable !== false) {
      const { data, error } = await client
        .from('orders')
        .select(this.getSelectClause(true))
        .order('created_at', { ascending: false });

      if (!error) {
        this.customerSnapshotColumnsAvailable = true;
        return data || [];
      }

      if (!this.hasMissingColumnError(error, 'customer_name_snapshot') && !this.hasMissingColumnError(error, 'customer_email_snapshot')) {
        console.error('Failed to load orders from Supabase.', error);
        return null;
      }

      this.customerSnapshotColumnsAvailable = false;
    }

    const { data, error } = await client
      .from('orders')
      .select(this.getSelectClause(false))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load orders from Supabase.', error);
      return null;
    }

    return data || [];
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const remoteOrders = await this.loadFromSupabase();

      if (Array.isArray(remoteOrders)) {
        this.cache = remoteOrders.map(order => this.normalizeOrder(order));
        this.source = 'supabase';
      } else {
        this.cache = this.loadFallbackOrders();
        this.source = 'fallback';
      }

      this.persistCache();
      this.initialized = true;
      return this.getAll();
    })();

    return this.initPromise;
  },

  ready() {
    return this.init();
  },

  async refresh() {
    this.initPromise = null;
    this.initialized = false;
    return this.init();
  },

  getAll() {
    if (!this.initialized && this.cache.length === 0) {
      this.cache = this.loadFallbackOrders();
    }
    return this.cache.map(order => ({
      ...order,
      items: Array.isArray(order.items) ? order.items.map(item => ({ ...item })) : []
    }));
  },

  getById(orderId) {
    const match = this.cache.find(order => order.id === orderId);
    return match ? {
      ...match,
      items: Array.isArray(match.items) ? match.items.map(item => ({ ...item })) : []
    } : null;
  },

  async updateStatus(orderId, nextStatus) {
    await this.ready();

    const normalizedStatus = String(nextStatus || '').trim().toLowerCase();
    const allowedStatuses = ['pending', 'processing', 'shipped', 'cancelled'];
    if (!allowedStatuses.includes(normalizedStatus)) {
      return { success: false, message: 'That order status is not supported.' };
    }

    const existingOrder = this.cache.find(order => order.id === orderId);
    if (!existingOrder) {
      return { success: false, message: 'Order not found.' };
    }

    const client = this.getClient();
    if (!client || this.source === 'fallback') {
      this.cache = this.cache.map(order => (
        order.id === orderId
          ? { ...order, status: normalizedStatus }
          : order
      ));
      this.persistCache();
      return { success: true, order: this.getById(orderId) };
    }

    const { error } = await client
      .from('orders')
      .update({ status: normalizedStatus })
      .eq('id', orderId);

    if (error) {
      return { success: false, message: error.message || 'Could not update order status.', error };
    }

    await this.refresh();
    return { success: true, order: this.getById(orderId) };
  },

  buildOrderItems(cartItems) {
    return cartItems.map(item => {
      const product = ProductData.getById(item.productId);
      return {
        productId: item.productId,
        productDbId: product ? product.dbId : item.productId,
        name: product ? product.name : 'Unknown',
        price: product ? product.price : 0,
        qty: item.qty,
        subtotal: product ? product.price * item.qty : 0
      };
    });
  },

  createFallbackOrder(cartItems) {
    const orders = this.getAll();
    const user = Auth.getCurrentUser();
    const items = this.buildOrderItems(cartItems);

    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const order = {
      id: 'ORD-' + Date.now(),
      userId: user ? user.id : 'guest',
      userName: user ? user.name : 'Guest',
      userEmail: user ? user.email : '',
      items,
      total,
      status: 'processing',
      paymentMethod: 'paypal',
      paymentStatus: 'paid',
      createdAt: new Date().toISOString()
    };

    items.forEach(item => ProductData.decrementStock(item.productId, item.qty));

    orders.unshift(order);
    this.cache = orders;
    this.persistCache();
    return order;
  },

  async createOrder(cartItems, options = {}) {
    await Auth.ready();
    await ProductData.ready();

    const user = Auth.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Please log in to complete your purchase.' };
    }

    const items = this.buildOrderItems(cartItems).filter(item => item.qty > 0);
    if (items.length === 0) {
      return { success: false, message: 'Your cart is empty.' };
    }

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const client = this.getClient();
    if (!client) {
      return { success: true, order: this.createFallbackOrder(cartItems) };
    }

    const rpcPayload = {
      items_input: items.map(item => ({
        product_id: item.productDbId,
        quantity: item.qty
      })),
      customer_name_input: user.name || 'Suspendre Customer',
      customer_email_input: user.email || '',
      payment_method_input: options.paymentMethod || 'paypal',
      payment_status_input: options.paymentStatus || 'paid',
      status_input: options.status || 'processing'
    };

    const { data: rpcOrderId, error: rpcError } = await client.rpc('place_order', rpcPayload);

    if (!rpcError && rpcOrderId) {
      await Promise.all([this.refresh(), ProductData.refresh()]);
      return { success: true, order: this.getById(rpcOrderId) };
    }

    if (this.hasMissingFunctionError(rpcError, 'place_order')) {
      return {
        success: false,
        message: 'Checkout hardening is not installed yet. Run supabase/place-order-rpc.sql in Supabase SQL Editor first.',
        error: rpcError
      };
    }

    if (rpcError) {
      return {
        success: false,
        message: rpcError.message || 'Could not complete your order.',
        error: rpcError
      };
    }

    const basePayload = {
      user_id: user.id,
      status: options.status || 'processing',
      payment_method: options.paymentMethod || 'paypal',
      payment_status: options.paymentStatus || 'paid',
      total_amount: total
    };

    let payload = { ...basePayload };
    if (this.customerSnapshotColumnsAvailable !== false) {
      payload.customer_name_snapshot = user.name || 'Suspendre Customer';
      payload.customer_email_snapshot = user.email || '';
    }

    let query = client
      .from('orders')
      .insert(payload);

    if (this.customerSnapshotColumnsAvailable !== false) {
      query = query.select(this.getSelectClause(true));
    } else {
      query = query.select(this.getSelectClause(false));
    }

    let { data: orderRow, error } = await query.single();

    if (error && this.customerSnapshotColumnsAvailable !== false && (this.hasMissingColumnError(error, 'customer_name_snapshot') || this.hasMissingColumnError(error, 'customer_email_snapshot'))) {
      this.customerSnapshotColumnsAvailable = false;

      const fallbackInsert = await client
        .from('orders')
        .insert(basePayload)
        .select(this.getSelectClause(false))
        .single();

      orderRow = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error || !orderRow) {
      return { success: false, message: error ? error.message : 'Could not create order.', error };
    }

    const orderItemsPayload = items.map(item => ({
      order_id: orderRow.id,
      product_id: item.productDbId,
      product_name_snapshot: item.name,
      unit_price: item.price,
      quantity: item.qty,
      subtotal: item.subtotal
    }));

    const { error: itemsError } = await client
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      await client
        .from('orders')
        .delete()
        .eq('id', orderRow.id);
      return { success: false, message: itemsError.message, error: itemsError };
    }

    await this.refresh();
    return { success: true, order: this.getById(orderRow.id) };
  }
};

// ===== BACK-IN-STOCK REQUESTS =====
const RestockRequests = {
  requestedIds: new Set(),
  demandCounts: new Map(),

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  reset() {
    this.requestedIds = new Set();
    this.demandCounts = new Map();
  },

  async fetchRequestedIds(userId) {
    const client = this.getClient();
    if (!client || !userId) return [];

    const { data, error } = await client
      .from('back_in_stock_requests')
      .select('product_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to load back-in-stock requests.', error);
      return [];
    }

    return (data || [])
      .map((row) => {
        const product = ProductData.getById(row.product_id);
        return product ? product.id : null;
      })
      .filter(Boolean);
  },

  async refreshRequestedIds() {
    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      this.requestedIds = new Set();
      return [];
    }

    await ProductData.ready();
    const ids = await this.fetchRequestedIds(currentUser.id);
    this.requestedIds = new Set(ids);
    return [...ids];
  },

  async getRequestedIds() {
    if (!Auth.isLoggedIn()) return [];
    if (this.requestedIds.size === 0) {
      return this.refreshRequestedIds();
    }
    return [...this.requestedIds];
  },

  hasRequested(productId) {
    return this.requestedIds.has(productId);
  },

  async request(productId) {
    const client = this.getClient();
    const currentUser = Auth.getCurrentUser();
    if (!client || !currentUser) {
      return { success: false, message: 'Please login to request a restock alert.' };
    }

    await ProductData.ready();
    const product = ProductData.getById(productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    const { error } = await client
      .from('back_in_stock_requests')
      .upsert({
        user_id: currentUser.id,
        product_id: product.dbId,
        email_snapshot: currentUser.email || ''
      }, { onConflict: 'user_id,product_id' });

    if (error) {
      return { success: false, message: error.message || 'Could not save your restock request.', error };
    }

    this.requestedIds.add(product.id);
    const currentCount = this.demandCounts.get(product.id) || 0;
    this.demandCounts.set(product.id, currentCount + 1);
    return { success: true };
  },

  async remove(productId) {
    const client = this.getClient();
    const currentUser = Auth.getCurrentUser();
    if (!client || !currentUser) {
      return { success: false, message: 'Please login to manage your restock request.' };
    }

    await ProductData.ready();
    const product = ProductData.getById(productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    const { error } = await client
      .from('back_in_stock_requests')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('product_id', product.dbId);

    if (error) {
      return { success: false, message: error.message || 'Could not update your restock request.', error };
    }

    this.requestedIds.delete(product.id);
    const currentCount = this.demandCounts.get(product.id) || 0;
    this.demandCounts.set(product.id, Math.max(0, currentCount - 1));
    return { success: true };
  },

  async toggle(productId) {
    if (this.hasRequested(productId)) {
      const result = await this.remove(productId);
      return { ...result, requested: false };
    }
    const result = await this.request(productId);
    return { ...result, requested: true };
  },

  async getDemandCounts(forceRefresh = false) {
    const client = this.getClient();
    if (!client) return new Map();
    if (!forceRefresh && this.demandCounts.size > 0) return new Map(this.demandCounts);

    await ProductData.ready();
    const { data, error } = await client
      .from('back_in_stock_requests')
      .select('product_id');

    if (error) {
      console.error('Failed to load restock demand counts.', error);
      return new Map();
    }

    const counts = new Map();
    (data || []).forEach((row) => {
      const product = ProductData.getById(row.product_id);
      const key = product ? product.id : null;
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    this.demandCounts = counts;
    return new Map(counts);
  }
};

window.addEventListener('suspendre:auth-ready', () => {
  RestockRequests.reset();
});

// ===== UI UTILITIES =====
function showToast(message, type = 'default', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show';
  if (type !== 'default') toast.classList.add(type);
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

function formatPrice(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ===== NAV =====
async function initNav() {
  await Auth.ready();
  await ProductData.ready();
  await Cart.ready();

  const user = Auth.getCurrentUser();
  const loginItem = document.getElementById('navLoginItem');
  const signupItem = document.getElementById('navSignupItem');
  const logoutItem = document.getElementById('navLogoutItem');
  const cartItem = document.getElementById('navCartItem');
  const adminItem = document.getElementById('navAdminItem');

  if (loginItem) {
    loginItem.style.display = '';
    loginItem.innerHTML = '<a href="login.html">Login</a>';
  }
  if (signupItem) signupItem.style.display = '';
  if (logoutItem) logoutItem.style.display = 'none';
  if (adminItem) adminItem.style.display = 'none';

  if (user) {
    if (loginItem) {
      loginItem.style.display = '';
      if (user.avatar) {
        loginItem.innerHTML = `<a href="account.html" title="Account" style="padding: 0 16px;">
          <img src="${user.avatar}" id="navAvatarImg" alt="Account" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        </a>`;
      } else {
        loginItem.innerHTML = `<a href="account.html">Account</a>`;
      }
    }
    if (signupItem) signupItem.style.display = 'none';
    if (logoutItem) logoutItem.style.display = '';
    if (adminItem && user.role === 'admin') adminItem.style.display = '';
  }

  // Cart link is always visible (guests can browse their cart)
  if (cartItem) {
    cartItem.style.display = '';
    const cartLink = cartItem.querySelector('a');
    if (cartLink) {
      cartLink.addEventListener('click', (e) => {
        // Only redirect if actually inside the full cart page or mobile where drawer might be tight
        if (window.location.pathname.endsWith('cart.html')) return;
        e.preventDefault();
        CartDrawer.open();
      });
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await Cart.flushSync();
      Cart.clear({ syncRemote: false, owner: 'guest', includeSaved: true });
      await Auth.logout();
    });
  }

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  });

  Cart.updateNavCount();
}

// ===== PRODUCT CARD BUILDER =====
function buildProductCard(product) {
  const user = Auth.getCurrentUser();
  const outOfStock = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= 3;

  const card = document.createElement('div');
  card.className = 'product-card';

  const imgSrc = ProductData.getImageSrc(product);

  const isWished = user && user.wishlist && user.wishlist.includes(product.id);

  card.innerHTML = `
    <div class="product-img">
      <a href="product.html?id=${product.id}" style="display:block;height:100%">
        <img class="product-img-el" src="${imgSrc}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.src='./images/placeholder.svg'">
      </a>
      ${outOfStock ? '<div class="product-badge out">Sold Out</div>' : isLow ? '<div class="product-badge">Last ' + product.stock + '</div>' : ''}
      <button class="btn-wishlist ${isWished ? 'active' : ''}" data-id="${product.id}" aria-label="Add to Wishlist">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="${isWished ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>
    </div>
    <div class="product-info">
      <p class="product-category">${product.category}</p>
      <h3 class="product-name"><a href="product.html?id=${product.id}">${product.name}</a></h3>
      <p class="product-desc">${product.description}</p>
      <p class="product-price">${formatPrice(product.price)}</p>
      <div class="product-footer">
        <span class="product-stock">${outOfStock ? 'Out of stock' : product.stock + ' available'}</span>
        <button class="btn-add" data-id="${product.id}" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Sold Out' : 'Add to Cart'}
        </button>
      </div>
    </div>
  `;

  const wishBtn = card.querySelector('.btn-wishlist');
  if (wishBtn) {
    wishBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!Auth.isLoggedIn()) {
        showToast('Please login to save favorites.', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
      }

      const svg = wishBtn.querySelector('svg');
      const wasWished = Auth.getCurrentUser()?.wishlist?.includes(product.id);
      const result = await Auth.toggleWishlistItem(product.id);

      if (!result.success) {
        showToast(result.message || 'Could not update wishlist right now.', 'error');
        return;
      }

      if (wasWished) {
        wishBtn.classList.remove('active');
        svg.setAttribute('fill', 'none');
        showToast('Removed from Wishlist.');
      } else {
        wishBtn.classList.add('active');
        svg.setAttribute('fill', 'currentColor');
        showToast('Saved to Wishlist!', 'success');
      }
    });
  }

  const btn = card.querySelector('.btn-add');
  if (btn && !outOfStock) {
    btn.addEventListener('click', () => {
      const added = Cart.addItem(product.id);
      if (added) {
        btn.textContent = '✓ Added';
        setTimeout(() => { btn.textContent = 'Add to Cart'; }, 2000);
        
        // Open the drawer dynamically rather than just a passive toast
        CartDrawer.open();
      } else {
        showToast('Could not add item to cart.', 'error');
      }
    });
  }

  return card;
}

// Init nav on every page
document.addEventListener('DOMContentLoaded', initNav);

// ===== GLOBAL MODAL HANDLERS =====
// Close any visible modal overlay on Escape key or overlay background click
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (CartDrawer.initialized) CartDrawer.close();
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      // Exempt receipt modal so it must be closed via explicit buttons
      if (modal.id === 'receiptModal') return;
      
      if (modal.style.display === 'flex' || getComputedStyle(modal).display !== 'none') {
        modal.style.display = 'none';
      }
    });
  }
});
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    // Exempt receipt modal
    if (e.target.id === 'receiptModal') return;
    
    e.target.style.display = 'none';
  }
});
