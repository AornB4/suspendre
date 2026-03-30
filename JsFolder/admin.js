// =========================================
//  SUSPENDRE — Admin Panel
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  // Require admin
  if (!Auth.requireAdmin()) return;

  initAdminNav();
  renderDashboard();
  renderProducts();
  renderAllOrders();
  initProductForm();
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

// ===== DASHBOARD =====
function renderDashboard() {
  const products = ProductData.getAll();
  const orders   = Orders.getAll();
  const users    = JSON.parse(localStorage.getItem('suspendre_users') || '[]');
  const revenue  = orders.reduce((s, o) => s + o.total, 0);

  setText('statProducts', products.length);
  setText('statOrders', orders.length);
  setText('statRevenue', formatPrice(revenue));
  setText('statUsers', users.length);

  const recentEl = document.getElementById('recentOrdersList');
  if (!recentEl) return;

  if (orders.length === 0) {
    recentEl.innerHTML = '<p style="color:var(--warm-gray);font-size:14px;padding:24px 0">No orders yet.</p>';
    return;
  }

  recentEl.innerHTML = '';
  orders.slice(0, 8).forEach(order => {
    const row = document.createElement('div');
    row.className = 'order-row';

    const idSpan = document.createElement('span');
    idSpan.className = 'order-id';
    idSpan.textContent = order.id;

    const userSpan = document.createElement('span');
    userSpan.className = 'order-user';
    userSpan.textContent = `${order.userName} <${order.userEmail}>`;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'order-amount';
    amountSpan.textContent = formatPrice(order.total);

    const dateSpan = document.createElement('span');
    dateSpan.className = 'order-date';
    dateSpan.textContent = formatDate(order.createdAt);

    row.append(idSpan, userSpan, amountSpan, dateSpan);
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
  if (!el) return;

  const orders = Orders.getAll();
  el.innerHTML = '';

  if (orders.length === 0) {
    el.innerHTML = '<p class="all-orders-empty">No orders have been placed yet.</p>';
    return;
  }

  orders.forEach(order => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:20px;border:1px solid var(--border-light);margin-bottom:12px;background:var(--cream);';

    const itemsList = order.items.map(i => `${i.name} × ${i.qty}`).join(', ');

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const orderId = document.createElement('strong');
    orderId.style.cssText = 'font-family:var(--font-display);font-size:1.05rem';
    orderId.textContent = order.id;
    const orderTotal = document.createElement('strong');
    orderTotal.style.cssText = 'font-family:var(--font-display);font-size:1.3rem';
    orderTotal.textContent = formatPrice(order.total);
    headerDiv.append(orderId, orderTotal);

    const detailDiv = document.createElement('div');
    detailDiv.style.cssText = 'font-size:13px;color:var(--warm-gray);margin-bottom:4px;';
    detailDiv.textContent = `${order.userName} · ${order.userEmail} · ${formatDate(order.createdAt)}`;

    const itemsDiv = document.createElement('div');
    itemsDiv.style.cssText = 'font-size:12px;color:var(--warm-gray);font-style:italic';
    itemsDiv.textContent = itemsList;

    card.append(headerDiv, detailDiv, itemsDiv);
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

function saveProduct() {
  const name     = getValue('prodName').trim();
  const category = getValue('prodCategory');
  const price    = parseFloat(getValue('prodPrice'));
  const stock    = parseInt(getValue('prodStock'), 10);
  const desc     = getValue('prodDesc').trim();
  const image    = getValue('prodImage').trim();
  const featured = document.getElementById('prodFeatured')?.checked || false;

  if (!name)          { showToast('Please enter a product name.', 'error'); return; }
  if (isNaN(price) || price <= 0) { showToast('Please enter a valid price.', 'error'); return; }
  if (isNaN(stock) || stock < 0)  { showToast('Please enter a valid stock quantity.', 'error'); return; }
  if (!desc)          { showToast('Please enter a description.', 'error'); return; }

  const productData = { name, category, price, stock, description: desc, image, featured };

  if (editingId) {
    ProductData.update(editingId, productData);
    showToast(`"${name}" updated successfully.`, 'success');
    editingId = null;
    setText('productFormTitle', 'Add New Product');
    document.getElementById('cancelEditBtn').style.display = 'none';
  } else {
    ProductData.add(productData);
    showToast(`"${name}" added to the collection.`, 'success');
  }

  clearForm();
  renderProducts();
  renderDashboard();

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

function confirmDelete() {
  if (!pendingDeleteId) return;
  const product = ProductData.getById(pendingDeleteId);
  ProductData.delete(pendingDeleteId);
  pendingDeleteId = null;
  closeDeleteModal();
  renderProducts();
  renderDashboard();
  showToast(product ? `"${product.name}" deleted.` : 'Product deleted.', 'success');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

// ===== HELPERS =====
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
