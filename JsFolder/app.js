// =========================================
//  SUSPENDRE — App Utilities
// =========================================

// ===== CART =====
const Cart = {
  KEY: 'suspendre_cart',

  getItems() {
    return JSON.parse(localStorage.getItem(this.KEY)) || [];
  },

  saveItems(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.updateNavCount();
  },

  addItem(productId, qty = 1) {
    const product = ProductData.getById(productId);
    if (!product) return false;
    if (product.stock === 0) return false;

    const items = this.getItems();
    const existing = items.find(i => i.productId === productId);

    if (existing) {
      const newQty = existing.qty + qty;
      if (newQty > product.stock) {
        existing.qty = product.stock;
      } else {
        existing.qty = newQty;
      }
    } else {
      items.push({ productId, qty: Math.min(qty, product.stock) });
    }

    this.saveItems(items);
    return true;
  },

  updateQty(productId, qty) {
    const items = this.getItems();
    const item = items.find(i => i.productId === productId);
    if (!item) return;
    if (qty <= 0) {
      this.removeItem(productId);
      return;
    }
    const product = ProductData.getById(productId);
    item.qty = product ? Math.min(qty, product.stock) : qty;
    this.saveItems(items);
  },

  removeItem(productId) {
    const items = this.getItems().filter(i => i.productId !== productId);
    this.saveItems(items);
  },

  clear() {
    localStorage.removeItem(this.KEY);
    this.updateNavCount();
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

  getAll() {
    return JSON.parse(localStorage.getItem(this.KEY)) || [];
  },

  createOrder(cartItems) {
    const orders = this.getAll();
    const user = Auth.getCurrentUser();
    const items = cartItems.map(item => {
      const product = ProductData.getById(item.productId);
      return {
        productId: item.productId,
        name: product ? product.name : 'Unknown',
        price: product ? product.price : 0,
        qty: item.qty,
        subtotal: product ? product.price * item.qty : 0
      };
    });

    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const order = {
      id: 'ORD-' + Date.now(),
      userId: user ? user.id : 'guest',
      userName: user ? user.name : 'Guest',
      userEmail: user ? user.email : '',
      items,
      total,
      createdAt: new Date().toISOString()
    };

    // Decrement stock
    items.forEach(item => ProductData.decrementStock(item.productId, item.qty));

    orders.unshift(order);
    localStorage.setItem(this.KEY, JSON.stringify(orders));
    return order;
  }
};

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
function initNav() {
  const user = Auth.getCurrentUser();
  const loginItem = document.getElementById('navLoginItem');
  const signupItem = document.getElementById('navSignupItem');
  const logoutItem = document.getElementById('navLogoutItem');
  const cartItem = document.getElementById('navCartItem');
  const adminItem = document.getElementById('navAdminItem');

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
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Cart.clear();
      Auth.logout();
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
    wishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentUser = Auth.getCurrentUser();
      if (!currentUser) {
        showToast('Please login to save favorites.', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
      }
      let wishlist = currentUser.wishlist || [];
      const svg = wishBtn.querySelector('svg');
      if (wishlist.includes(product.id)) {
        wishlist = wishlist.filter(id => id !== product.id);
        wishBtn.classList.remove('active');
        svg.setAttribute('fill', 'none');
        showToast('Removed from Wishlist.');
      } else {
        wishlist.push(product.id);
        wishBtn.classList.add('active');
        svg.setAttribute('fill', 'currentColor');
        showToast('Saved to Wishlist!', 'success');
      }
      Auth.updateUser(currentUser.id, { wishlist });
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
