// =========================================
//  SUSPENDRE — Admin Panel
// =========================================

const adminOrderFilters = {
  search: '',
  status: 'all',
  sort: 'newest'
};

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();
  await Orders.ready();

  if (!Auth.requireAdmin()) return;

  initAdminNav();
  initProductForm();
  initOrderControls();
  await renderDashboard();
  renderProducts();
  renderAllOrders();
});

// ===== TAB NAVIGATION =====
function initAdminNav() {
  const navItems = document.querySelectorAll('.admin-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.dataset.tab;
      switchTab(tab);
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
}

function initOrderControls() {
  const searchInput = document.getElementById('adminOrderSearch');
  const statusFilter = document.getElementById('adminOrderStatusFilter');
  const sortFilter = document.getElementById('adminOrderSort');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      adminOrderFilters.search = searchInput.value.trim().toLowerCase();
      renderAllOrders();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      adminOrderFilters.status = statusFilter.value;
      renderAllOrders();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      adminOrderFilters.sort = sortFilter.value;
      renderAllOrders();
    });
  }
}

// ===== DASHBOARD =====
async function renderDashboard() {
  const products = ProductData.getAll();
  const orders = Orders.getAll();
  const userCount = await Auth.getUserCount();
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  setText('statProducts', products.length);
  setText('statOrders', orders.length);
  setText('statRevenue', formatPrice(revenue));
  setText('statUsers', userCount);

  const recentEl = document.getElementById('recentOrdersList');
  if (!recentEl) return;

  if (orders.length === 0) {
    recentEl.innerHTML = '<p style="color:var(--warm-gray);font-size:14px;padding:24px 0">No orders yet.</p>';
    return;
  }

  recentEl.innerHTML = '';
  orders.slice(0, 8).forEach(order => {
    const fulfillmentMeta = getOrderStatusMeta(order.status);
    const paymentMeta = getPaymentStatusMeta(order.paymentStatus);
    const leadItem = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
    const row = document.createElement('div');
    row.className = 'order-row';
    row.innerHTML = `
      <div class="order-row-main">
        <div class="order-row-thumb-wrap">
          <img class="order-row-thumb" src="${safeString(getOrderItemImage(leadItem))}" alt="${safeString(leadItem ? leadItem.name : 'Order item')}" loading="lazy" onerror="this.onerror=null;this.src='./images/placeholder.svg'">
        </div>
        <div class="order-row-copy">
          <span class="order-id">Ref. ${safeString(shortOrderId(order.id))}</span>
          <span class="order-row-title">${safeString(order.userName || 'Suspendre Customer')}</span>
          <span class="order-user">${safeString(order.userEmail || (leadItem ? leadItem.name : 'Customer order'))}</span>
        </div>
      </div>
      <div class="order-row-statuses">
        <span class="admin-status-pill ${fulfillmentMeta.className}">${fulfillmentMeta.label}</span>
        <span class="admin-status-pill ${paymentMeta.className}">${paymentMeta.label}</span>
      </div>
      <span class="order-amount">${formatPrice(order.total)}</span>
      <span class="order-date">${formatDate(order.createdAt)}</span>
    `;
    recentEl.appendChild(row);
  });
}

// ===== PRODUCT LIST =====
function renderProducts() {
  const listEl = document.getElementById('adminProductsList');
  if (!listEl) return;

  const products = ProductData.getAll();
  listEl.innerHTML = '';

  if (products.length === 0) {
    listEl.innerHTML = '<p style="color:var(--warm-gray);padding:24px 0">No products yet.</p>';
    return;
  }

  products.forEach(product => {
    const row = document.createElement('div');
    row.className = 'admin-product-row';

    const stockClass = product.stock === 0 ? 'out' : product.stock <= 3 ? 'low' : '';
    const imgSrc = ProductData.getImageSrc(product);

    const img = document.createElement('img');
    img.className = 'admin-product-img';
    img.src = imgSrc;
    img.alt = product.name;
    img.onerror = function() { this.onerror = null; this.src = './images/placeholder.svg'; };

    const infoDiv = document.createElement('div');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'admin-product-name';
    nameDiv.textContent = product.name;
    const catDiv = document.createElement('div');
    catDiv.className = 'admin-product-cat';
    catDiv.textContent = product.category;
    infoDiv.append(nameDiv, catDiv);

    const priceDiv = document.createElement('div');
    priceDiv.className = 'admin-product-price';
    priceDiv.textContent = formatPrice(product.price);

    const stockDiv = document.createElement('div');
    stockDiv.className = `admin-product-stock ${stockClass}`;
    stockDiv.textContent = `Stock: ${product.stock}`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.dataset.id = product.id;
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditForm(product.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del';
    delBtn.dataset.id = product.id;
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => openDeleteModal(product.id));

    row.append(img, infoDiv, priceDiv, stockDiv, editBtn, delBtn);
    listEl.appendChild(row);
  });
}

// ===== ALL ORDERS =====
function renderAllOrders() {
  const el = document.getElementById('allOrdersList');
  const resultsEl = document.getElementById('adminOrderResultsCount');
  if (!el) return;

  const orders = getFilteredOrders();
  el.innerHTML = '';

  if (resultsEl) {
    resultsEl.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
  }

  if (orders.length === 0) {
    el.innerHTML = '<p class="all-orders-empty">No orders have been placed yet.</p>';
    return;
  }

  orders.forEach(order => {
    const fulfillmentMeta = getOrderStatusMeta(order.status);
    const paymentMeta = getPaymentStatusMeta(order.paymentStatus);
    const leadItem = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
    const itemCount = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
      : 0;
    const card = document.createElement('article');
    card.className = 'admin-order-card';
    card.dataset.orderId = order.id;
    card.innerHTML = `
      <div class="admin-order-header">
        <div class="admin-order-hero">
          <div class="admin-order-thumb-wrap">
            <img class="admin-order-thumb" src="${safeString(getOrderItemImage(leadItem))}" alt="${safeString(leadItem ? leadItem.name : 'Order item')}" loading="lazy" onerror="this.onerror=null;this.src='./images/placeholder.svg'">
          </div>
          <div class="admin-order-hero-copy">
            <span class="admin-order-kicker">Customer Order</span>
            <h3>${safeString(order.userName || 'Suspendre Customer')}</h3>
            <p>${safeString(order.userEmail || 'No customer email saved')}</p>
            <span class="admin-order-reference">Ref. ${safeString(order.id)}</span>
          </div>
        </div>
        <div class="admin-order-summary">
          <span class="admin-order-total">${formatPrice(order.total)}</span>
          <span class="admin-order-date">
            <span class="admin-inline-icon" aria-hidden="true">${getAdminIcon('calendar')}</span>
            ${formatDate(order.createdAt)}
          </span>
          <span class="admin-order-count">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="admin-order-status-row">
        <span class="admin-status-pill ${fulfillmentMeta.className}">${fulfillmentMeta.label}</span>
        <span class="admin-status-pill ${paymentMeta.className}">${paymentMeta.label}</span>
        <span class="admin-order-method">
          <span class="admin-inline-icon" aria-hidden="true">${getAdminIcon('card')}</span>
          ${safeString(formatPaymentMethodLabel(order.paymentMethod))}
        </span>
      </div>
      <div class="admin-order-body">
        <div class="admin-order-copy">
          <span class="admin-order-section-label">Order Snapshot</span>
          <p>${safeString(buildOrderPreview(order.items))}</p>
        </div>
        <div class="admin-order-controls">
          <label class="admin-order-control">
            <span>Fulfillment status</span>
            <select class="admin-status-select" data-order-id="${safeString(order.id)}">
              ${renderStatusOptions(order.status)}
            </select>
          </label>
          <button class="btn-primary btn-admin-status" type="button" data-order-id="${safeString(order.id)}">Update Status</button>
        </div>
      </div>
    `;

    const saveBtn = card.querySelector('.btn-admin-status');
    const select = card.querySelector('.admin-status-select');
    if (saveBtn && select) {
      saveBtn.addEventListener('click', async () => {
        await handleOrderStatusUpdate(order.id, select.value, saveBtn);
      });
    }

    el.appendChild(card);
  });
}

// ===== PRODUCT FORM =====
let editingId = null;

function initProductForm() {
  const saveBtn   = document.getElementById('saveProductBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');

  if (saveBtn) saveBtn.addEventListener('click', saveProduct);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
}

function openEditForm(productId) {
  const product = ProductData.getById(productId);
  if (!product) return;

  editingId = productId;
  setText('productFormTitle', 'Edit Product');

  setValue('prodName', product.name);
  setValue('prodCategory', product.category);
  setValue('prodPrice', product.price);
  setValue('prodStock', product.stock);
  setValue('prodDesc', product.description);
  setValue('prodImage', product.image || '');
  document.getElementById('prodFeatured').checked = !!product.featured;

  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = '';

  switchTab('add-product');
  document.querySelectorAll('.admin-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === 'add-product');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  setText('productFormTitle', 'Add New Product');
  clearForm();
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  switchTab('products');
  document.querySelectorAll('.admin-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === 'products');
  });
}

async function saveProduct() {
  const name     = getValue('prodName').trim();
  const category = getValue('prodCategory');
  const price    = parseFloat(getValue('prodPrice'));
  const stock    = parseInt(getValue('prodStock'), 10);
  const desc     = getValue('prodDesc').trim();
  const image    = getValue('prodImage').trim();
  const featured = document.getElementById('prodFeatured')?.checked || false;
  const saveBtn = document.getElementById('saveProductBtn');

  if (!name)          { showToast('Please enter a product name.', 'error'); return; }
  if (isNaN(price) || price <= 0) { showToast('Please enter a valid price.', 'error'); return; }
  if (isNaN(stock) || stock < 0)  { showToast('Please enter a valid stock quantity.', 'error'); return; }
  if (!desc)          { showToast('Please enter a description.', 'error'); return; }

  const productData = { name, category, price, stock, description: desc, image, featured };
  const originalLabel = saveBtn ? saveBtn.textContent : '';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = editingId ? 'Saving Changes...' : 'Saving Product...';
  }

  if (editingId) {
    const result = await ProductData.update(editingId, productData, { remote: true });
    if (!result.success) {
      showToast(result.message || 'Could not update product.', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
      return;
    }

    showToast(`"${name}" updated successfully.`, 'success');
    editingId = null;
    setText('productFormTitle', 'Add New Product');
    document.getElementById('cancelEditBtn').style.display = 'none';
  } else {
    const result = await ProductData.add(productData, { remote: true });
    if (!result.success) {
      showToast(result.message || 'Could not add product.', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
      return;
    }

    showToast(`"${name}" added to the collection.`, 'success');
  }

  clearForm();
  await ProductData.ready();
  renderProducts();
  await renderDashboard();

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }

  switchTab('products');
  document.querySelectorAll('.admin-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === 'products');
  });
}

function clearForm() {
  ['prodName','prodPrice','prodStock','prodDesc','prodImage'].forEach(id => setValue(id, ''));
  setValue('prodCategory', 'wood');
  const feat = document.getElementById('prodFeatured');
  if (feat) feat.checked = false;
}

// ===== DELETE MODAL =====
let pendingDeleteId = null;

function openDeleteModal(productId) {
  pendingDeleteId = productId;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'flex';

  document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete, { once: true });
  document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal, { once: true });
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const product = ProductData.getById(pendingDeleteId);
  const result = await ProductData.delete(pendingDeleteId, { remote: true });
  if (!result.success) {
    showToast(result.message || 'Could not delete product.', 'error');
    return;
  }

  pendingDeleteId = null;
  closeDeleteModal();
  await ProductData.ready();
  renderProducts();
  await renderDashboard();
  showToast(product ? `"${product.name}" deleted.` : 'Product deleted.', 'success');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

// ===== HELPERS =====
async function handleOrderStatusUpdate(orderId, nextStatus, button) {
  const originalLabel = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Updating...';
  }

  const result = await Orders.updateStatus(orderId, nextStatus);
  if (!result.success) {
    showToast(result.message || 'Could not update order status.', 'error');
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
    return;
  }

  await renderDashboard();
  renderAllOrders();
  showToast(`Order marked ${formatTitleCase(nextStatus)}.`, 'success');
}

function getOrderStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'shipped') return { label: 'Shipped', className: 'status-shipped' };
  if (normalized === 'cancelled') return { label: 'Cancelled', className: 'status-cancelled' };
  if (normalized === 'pending') return { label: 'Pending', className: 'status-pending' };
  return { label: 'Processing', className: 'status-processing' };
}

function getPaymentStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return { label: 'Payment Confirmed', className: 'status-paid' };
  if (normalized === 'failed') return { label: 'Payment Failed', className: 'status-cancelled' };
  if (normalized === 'refunded') return { label: 'Refunded', className: 'status-pending' };
  return { label: 'Payment Pending', className: 'status-pending' };
}

function formatPaymentMethodLabel(method) {
  const normalized = String(method || '').trim().toLowerCase();
  if (!normalized) return 'Not specified';
  if (normalized === 'paypal') return 'PayPal';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTitleCase(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildOrderPreview(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'No item summary is available for this order yet.';
  }

  const preview = items
    .slice(0, 3)
    .map((item) => `${item.name} x ${item.qty}`)
    .join(', ');

  return items.length > 3 ? `${preview}, +${items.length - 3} more` : preview;
}

function shortOrderId(orderId) {
  const value = String(orderId || '');
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getOrderItemImage(item) {
  if (!item) return './images/placeholder.svg';
  const product = ProductData.getById(item.productId);
  return product ? ProductData.getImageSrc(product) : './images/placeholder.svg';
}

function safeString(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStatusOptions(currentStatus) {
  const normalized = String(currentStatus || '').toLowerCase();
  return ['pending', 'processing', 'shipped', 'cancelled']
    .map((status) => `<option value="${status}"${status === normalized ? ' selected' : ''}>${formatTitleCase(status)}</option>`)
    .join('');
}

function getFilteredOrders() {
  const filtered = Orders.getAll().filter((order) => {
    const matchesStatus = adminOrderFilters.status === 'all'
      ? true
      : String(order.status || '').toLowerCase() === adminOrderFilters.status;

    if (!matchesStatus) return false;

    if (!adminOrderFilters.search) return true;

    const haystack = [
      order.id,
      order.userName,
      order.userEmail,
      ...(Array.isArray(order.items) ? order.items.map((item) => item.name) : [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(adminOrderFilters.search);
  });

  filtered.sort((a, b) => {
    if (adminOrderFilters.sort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (adminOrderFilters.sort === 'highest') {
      return b.total - a.total;
    }
    if (adminOrderFilters.sort === 'lowest') {
      return a.total - b.total;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return filtered;
}

function getAdminIcon(name) {
  if (name === 'calendar') {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2"></rect>
        <path d="M16 3v4M8 3v4M3 10h18"></path>
      </svg>
    `;
  }

  if (name === 'card') {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <path d="M3 10h18"></path>
      </svg>
    `;
  }

  return '';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
