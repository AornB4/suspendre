// =========================================
//  SUSPENDRE — Admin Panel
// =========================================

const adminOrderFilters = {
  search: '',
  status: 'all',
  sort: 'newest'
};

const adminFaqFilters = {
  visibility: 'all'
};

const AdminProductCatalog = {
  cache: [],
  initPromise: null,
  initialized: false,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = this.getClient();
      if (!client) {
        this.cache = ProductData.getAll();
        this.initialized = true;
        return this.getAll();
      }

      const { data, error } = await client
        .from('products')
        .select('id, legacy_id, slug, name, category, price, stock, description, image_url, featured, active, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load admin products.', error);
        this.cache = ProductData.getAll();
      } else {
        this.cache = ProductData.normalizeCollection(Array.isArray(data) ? data : []);
      }

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
    return this.cache.map((product) => ({ ...product }));
  },

  getById(id) {
    const match = this.cache.find((product) =>
      product.id === id ||
      product.dbId === id ||
      product.legacyId === id ||
      product.slug === id
    );
    return match ? { ...match } : null;
  }
};

const FaqAdmin = {
  cache: [],
  initPromise: null,
  initialized: false,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = this.getClient();
      if (!client) {
        this.cache = [];
        this.initialized = true;
        return this.getAll();
      }

      const { data, error } = await client
        .from('faqs')
        .select('id, question, answer, category, active, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Failed to load FAQs for admin.', error);
        this.cache = [];
      } else {
        this.cache = Array.isArray(data) ? data.map((faq) => ({ ...faq })) : [];
      }

      this.initialized = true;
      return this.getAll();
    })();

    return this.initPromise;
  },

  async refresh() {
    this.initPromise = null;
    this.initialized = false;
    return this.init();
  },

  ready() {
    return this.init();
  },

  getAll() {
    return this.cache.map((faq) => ({ ...faq }));
  },

  getById(id) {
    const match = this.cache.find((faq) => faq.id === id);
    return match ? { ...match } : null;
  },

  async create(payload) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase FAQ access is not configured.' };
    }

    const nextOrder = this.cache.length
      ? Math.max(...this.cache.map((faq) => Number(faq.display_order) || 0)) + 1
      : 1;

    const { error } = await client
      .from('faqs')
      .insert({
        question: payload.question,
        answer: payload.answer,
        category: payload.category,
        active: payload.active,
        display_order: nextOrder
      });

    if (error) {
      return { success: false, message: error.message || 'Could not create FAQ.', error };
    }

    await this.refresh();
    return { success: true };
  },

  async update(id, payload) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase FAQ access is not configured.' };
    }

    const { error } = await client
      .from('faqs')
      .update({
        question: payload.question,
        answer: payload.answer,
        category: payload.category,
        active: payload.active
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message || 'Could not update FAQ.', error };
    }

    await this.refresh();
    return { success: true };
  },

  async delete(id) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase FAQ access is not configured.' };
    }

    const { error } = await client
      .from('faqs')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message || 'Could not delete FAQ.', error };
    }

    await this.refresh();
    await this.resequence();
    return { success: true };
  },

  async resequence() {
    const client = this.getClient();
    if (!client) return { success: false, message: 'Supabase FAQ access is not configured.' };

    const updates = this.cache.map((faq, index) => ({
      id: faq.id,
      display_order: index + 1
    }));

    for (const update of updates) {
      const { error } = await client
        .from('faqs')
        .update({ display_order: update.display_order })
        .eq('id', update.id);

      if (error) {
        return { success: false, message: error.message || 'Could not resequence FAQs.', error };
      }
    }

    await this.refresh();
    return { success: true };
  },

  async move(id, direction) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase FAQ access is not configured.' };
    }

    const currentIndex = this.cache.findIndex((faq) => faq.id === id);
    if (currentIndex === -1) {
      return { success: false, message: 'FAQ not found.' };
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= this.cache.length) {
      return { success: false, message: 'FAQ is already at the edge of the list.' };
    }

    const reordered = this.getAll();
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(swapIndex, 0, item);
    const movedItem = reordered[swapIndex];
    const swappedItem = reordered[currentIndex];
    this.cache = reordered;

    Promise.all([
      client
        .from('faqs')
        .update({ display_order: swapIndex + 1 })
        .eq('id', movedItem.id),
      client
        .from('faqs')
        .update({ display_order: currentIndex + 1 })
        .eq('id', swappedItem.id)
    ])
      .then(async ([movedResult, swappedResult]) => {
        if (movedResult.error || swappedResult.error) {
          await this.refresh();
          renderFaqs();
          showToast(
            movedResult.error?.message || swappedResult.error?.message || 'Could not reorder FAQs.',
            'error'
          );
        }
      })
      .catch(async () => {
        await this.refresh();
        renderFaqs();
        showToast('Could not reorder FAQs.', 'error');
      });

    return { success: true };
  }
};

let editingFaqId = null;
let pendingFaqDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();
  await AdminProductCatalog.ready();
  await Orders.ready();
  await FaqAdmin.ready();

  if (!Auth.requireAdmin()) return;
  await RestockRequests.getDemandCounts(true);

  initAdminNav();
  initProductForm();
  initOrderControls();
  initFaqManager();
  await renderDashboard();
  await renderProducts();
  renderAllOrders();
  renderFaqs();
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
  if (tabId === 'faqs') {
    renderFaqs();
  }
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

function initFaqManager() {
  const faqVisibilityFilter = document.getElementById('adminFaqVisibilityFilter');
  document.getElementById('newFaqBtn')?.addEventListener('click', () => {
    cancelFaqEdit();
    switchTab('faqs');
  });

  document.getElementById('saveFaqBtn')?.addEventListener('click', saveFaq);
  document.getElementById('cancelFaqEditBtn')?.addEventListener('click', cancelFaqEdit);
  document.getElementById('confirmFaqDeleteBtn')?.addEventListener('click', confirmFaqDelete);
  document.getElementById('cancelFaqDeleteBtn')?.addEventListener('click', closeFaqDeleteModal);
  faqVisibilityFilter?.addEventListener('change', () => {
    adminFaqFilters.visibility = faqVisibilityFilter.value;
    renderFaqs();
  });
  document.querySelectorAll('[data-faq-visibility]').forEach((choice) => {
    choice.addEventListener('click', () => {
      setFaqVisibilityState(choice.dataset.faqVisibility === 'published');
    });
  });
  renderFaqVisibilityState();
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

function getAdminProductStockState(stock) {
  if (Number(stock) <= 0) {
    return {
      className: 'out',
      label: 'Sold Out',
      copy: 'No units available'
    };
  }

  if (Number(stock) <= 3) {
    return {
      className: 'low',
      label: 'Low Stock',
      copy: `${Number(stock)} left in stock`
    };
  }

  return {
    className: 'healthy',
    label: 'Healthy',
    copy: `${Number(stock)} in stock`
  };
}

// ===== PRODUCT LIST =====
async function renderProducts() {
  const listEl = document.getElementById('adminProductsList');
  if (!listEl) return;

  const products = AdminProductCatalog.getAll();
  const demandCounts = await RestockRequests.getDemandCounts(true);
  listEl.innerHTML = '';

  if (products.length === 0) {
    listEl.innerHTML = '<p style="color:var(--warm-gray);padding:24px 0">No products yet.</p>';
    return;
  }

  products.forEach(product => {
    const row = document.createElement('div');
    row.className = 'admin-product-row';

    const stockState = getAdminProductStockState(product.stock);
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
    const metaDiv = document.createElement('div');
    metaDiv.className = 'admin-product-meta';
    metaDiv.innerHTML = `
      <span class="admin-product-pill ${product.active === false ? 'hidden' : ''}">${product.active === false ? 'Hidden Draft' : 'Published'}</span>
      <span class="admin-product-pill ${stockState.className}">${stockState.label}</span>
      ${product.featured ? '<span class="admin-product-pill featured">Featured</span>' : ''}
    `;
    infoDiv.append(nameDiv, catDiv, metaDiv);

    const priceDiv = document.createElement('div');
    priceDiv.className = 'admin-product-price';
    priceDiv.textContent = formatPrice(product.price);

    const stockDiv = document.createElement('div');
    stockDiv.className = `admin-product-stock ${stockState.className}`;
    stockDiv.textContent = stockState.copy;

    const demandDiv = document.createElement('div');
    const demandCount = demandCounts.get(product.id) || 0;
    demandDiv.className = `admin-product-demand ${demandCount > 0 ? 'active' : ''}`;
    demandDiv.textContent = demandCount > 0 ? `${demandCount} alert${demandCount === 1 ? '' : 's'}` : 'No alerts';

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

    row.append(img, infoDiv, priceDiv, stockDiv, demandDiv, editBtn, delBtn);
    listEl.appendChild(row);
  });
}

function renderFaqs() {
  const listEl = document.getElementById('adminFaqList');
  const countEl = document.getElementById('adminFaqResultsCount');
  const noticeEl = document.getElementById('adminFaqHomepageNotice');
  if (!listEl) return;

  const allFaqs = FaqAdmin.getAll();
  const publishedCount = allFaqs.filter((faq) => !!faq.active).length;
  const faqs = allFaqs.filter((faq) => {
    if (adminFaqFilters.visibility === 'published') return !!faq.active;
    if (adminFaqFilters.visibility === 'hidden') return !faq.active;
    return true;
  });

  if (countEl) {
    countEl.textContent = `${faqs.length} FAQ${faqs.length === 1 ? '' : 's'}`;
  }

  if (noticeEl) {
    noticeEl.innerHTML = publishedCount > 4
      ? '<strong>Homepage curation</strong><span>You currently have more than 4 published FAQs. The homepage will only show the first 4 by position.</span>'
      : `<strong>Homepage curation</strong><span>The homepage currently surfaces the first 4 published FAQs by position. ${publishedCount} published right now.</span>`;
  }

  if (faqs.length === 0) {
    listEl.innerHTML = '<p class="admin-faq-empty">No FAQs match the current filter. Adjust visibility or add a new one from the editor.</p>';
    return;
  }

  listEl.innerHTML = '';
  faqs.forEach((faq, index) => {
    const item = document.createElement('article');
    item.className = 'admin-faq-item';
    item.innerHTML = `
      <div class="admin-faq-item-header">
        <div class="admin-faq-item-copy">
          <h3>${safeString(faq.question)}</h3>
          <div class="admin-faq-meta">
            <span class="admin-faq-pill active">${safeString(formatTitleCase(faq.category || 'general'))}</span>
            <span class="admin-faq-pill ${faq.active ? 'active' : 'inactive'}">${faq.active ? 'Published' : 'Hidden'}</span>
          </div>
        </div>
        <span class="admin-faq-order">Position ${index + 1}</span>
      </div>
      <p class="admin-faq-answer">${safeString(faq.answer)}</p>
      <div class="admin-faq-actions">
        <div class="admin-faq-reorder">
          <button class="btn-faq-lite" type="button" data-faq-move="up" ${index === 0 ? 'disabled' : ''}>
            <span class="admin-faq-arrow" aria-hidden="true">↑</span>
            <span>Move Up</span>
          </button>
          <button class="btn-faq-lite" type="button" data-faq-move="down" ${index === faqs.length - 1 ? 'disabled' : ''}>
            <span class="admin-faq-arrow" aria-hidden="true">↓</span>
            <span>Move Down</span>
          </button>
        </div>
        <div class="admin-faq-manage">
          <button class="btn-edit" type="button" data-faq-edit>Edit</button>
          <button class="btn-del" type="button" data-faq-delete>Delete</button>
        </div>
      </div>
    `;

    item.querySelector('[data-faq-edit]')?.addEventListener('click', () => openFaqEdit(faq.id));
    item.querySelector('[data-faq-delete]')?.addEventListener('click', () => openFaqDeleteModal(faq.id));
    item.querySelector('[data-faq-move="up"]')?.addEventListener('click', async () => {
      const result = await FaqAdmin.move(faq.id, 'up');
      if (!result.success) {
        showToast(result.message || 'Could not reorder FAQ.', 'error');
        return;
      }
      renderFaqs();
      showToast('FAQ moved up.', 'success');
    });
    item.querySelector('[data-faq-move="down"]')?.addEventListener('click', async () => {
      const result = await FaqAdmin.move(faq.id, 'down');
      if (!result.success) {
        showToast(result.message || 'Could not reorder FAQ.', 'error');
        return;
      }
      renderFaqs();
      showToast('FAQ moved down.', 'success');
    });

    listEl.appendChild(item);
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
  document.querySelectorAll('[data-product-visibility]').forEach((choice) => {
    choice.addEventListener('click', () => {
      setProductVisibilityState(choice.dataset.productVisibility === 'published');
    });
  });
  document.querySelectorAll('[data-product-featured]').forEach((choice) => {
    choice.addEventListener('click', () => {
      setProductFeaturedState(choice.dataset.productFeatured === 'true');
    });
  });
  renderProductVisibilityState();
  renderProductFeaturedState();
}

function openEditForm(productId) {
  const product = AdminProductCatalog.getById(productId);
  if (!product) return;

  editingId = productId;
  setText('productFormTitle', 'Edit Product');

  setValue('prodName', product.name);
  setValue('prodCategory', product.category);
  setValue('prodPrice', product.price);
  setValue('prodStock', product.stock);
  setValue('prodDesc', product.description);
  setValue('prodImage', product.image || '');
  setProductFeaturedState(!!product.featured);
  setProductVisibilityState(product.active !== false);

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

function setProductVisibilityState(isPublished) {
  const activeEl = document.getElementById('prodActive');
  if (activeEl) {
    activeEl.value = isPublished ? 'true' : 'false';
  }
  renderProductVisibilityState();
}

function renderProductVisibilityState() {
  const isPublished = String(document.getElementById('prodActive')?.value || 'true') === 'true';
  document.querySelectorAll('[data-product-visibility]').forEach((choice) => {
    const isChoicePublished = choice.dataset.productVisibility === 'published';
    choice.classList.toggle('active', isChoicePublished === isPublished);
  });
}

function setProductFeaturedState(isFeatured) {
  const featuredEl = document.getElementById('prodFeatured');
  if (featuredEl) {
    featuredEl.value = isFeatured ? 'true' : 'false';
  }
  renderProductFeaturedState();
}

function renderProductFeaturedState() {
  const isFeatured = String(document.getElementById('prodFeatured')?.value || 'false') === 'true';
  document.querySelectorAll('[data-product-featured]').forEach((choice) => {
    const isChoiceFeatured = choice.dataset.productFeatured === 'true';
    choice.classList.toggle('active', isChoiceFeatured === isFeatured);
  });
}

async function saveProduct() {
  const name     = getValue('prodName').trim();
  const category = getValue('prodCategory');
  const price    = parseFloat(getValue('prodPrice'));
  const stock    = parseInt(getValue('prodStock'), 10);
  const desc     = getValue('prodDesc').trim();
  const image    = getValue('prodImage').trim();
  const featured = String(document.getElementById('prodFeatured')?.value || 'false') === 'true';
  const active   = String(document.getElementById('prodActive')?.value || 'true') === 'true';
  const saveBtn = document.getElementById('saveProductBtn');

  if (!name)          { showToast('Please enter a product name.', 'error'); return; }
  if (isNaN(price) || price <= 0) { showToast('Please enter a valid price.', 'error'); return; }
  if (isNaN(stock) || stock < 0)  { showToast('Please enter a valid stock quantity.', 'error'); return; }
  if (!desc)          { showToast('Please enter a description.', 'error'); return; }

  const productData = { name, category, price, stock, description: desc, image, featured, active };
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
  await ProductData.refresh();
  await AdminProductCatalog.refresh();
  await renderProducts();
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
  setProductFeaturedState(false);
  setProductVisibilityState(true);
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
  const product = AdminProductCatalog.getById(pendingDeleteId);
  const result = await ProductData.delete(pendingDeleteId, { remote: true });
  if (!result.success) {
    showToast(result.message || 'Could not delete product.', 'error');
    return;
  }

  pendingDeleteId = null;
  closeDeleteModal();
  await ProductData.refresh();
  await AdminProductCatalog.refresh();
  await renderProducts();
  await renderDashboard();
  showToast(product ? `"${product.name}" deleted.` : 'Product deleted.', 'success');
}

function openFaqEdit(faqId) {
  const faq = FaqAdmin.getById(faqId);
  if (!faq) return;

  editingFaqId = faqId;
  setText('faqFormTitle', 'Edit FAQ');
  setText('faqFormSubcopy', 'Adjust the question, answer, category, or visibility for this entry.');
  setValue('faqQuestion', faq.question || '');
  setValue('faqCategory', faq.category || 'products');
  setValue('faqAnswer', faq.answer || '');
  setFaqVisibilityState(!!faq.active);
  const cancelBtn = document.getElementById('cancelFaqEditBtn');
  if (cancelBtn) cancelBtn.style.display = '';
  renderFaqVisibilityState();

  switchTab('faqs');
  document.querySelectorAll('.admin-nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.tab === 'faqs');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelFaqEdit() {
  editingFaqId = null;
  setText('faqFormTitle', 'Add New FAQ');
  setText('faqFormSubcopy', 'Write a clear answer that can work both on the homepage and inside Atelier.');
  setValue('faqQuestion', '');
  setValue('faqCategory', 'products');
  setValue('faqAnswer', '');
  setFaqVisibilityState(true);
  const cancelBtn = document.getElementById('cancelFaqEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  renderFaqVisibilityState();
}

function setFaqVisibilityState(isPublished) {
  const activeEl = document.getElementById('faqActive');
  if (activeEl) {
    activeEl.value = isPublished ? 'true' : 'false';
  }

  document.querySelectorAll('[data-faq-visibility]').forEach((choice) => {
    const choicePublished = choice.dataset.faqVisibility === 'published';
    choice.classList.toggle('active', choicePublished === isPublished);
  });
}

function renderFaqVisibilityState() {
  const activeEl = document.getElementById('faqActive');
  const labelEl = document.getElementById('faqVisibilityLabel');
  const helpEl = document.getElementById('faqVisibilityHelp');
  const isPublished = String(activeEl?.value || 'true') === 'true';

  if (labelEl) {
    labelEl.textContent = isPublished ? 'Published' : 'Hidden Draft';
  }

  if (helpEl) {
    helpEl.textContent = isPublished
      ? 'Visible on the homepage and inside Atelier.'
      : 'Saved for editing only and hidden from the storefront.';
  }
}

async function saveFaq() {
  const question = getValue('faqQuestion').trim();
  const category = getValue('faqCategory');
  const answer = getValue('faqAnswer').trim();
  const active = String(document.getElementById('faqActive')?.value || 'true') === 'true';
  const saveBtn = document.getElementById('saveFaqBtn');
  const isEditing = !!editingFaqId;

  if (!question) {
    showToast('Please enter an FAQ question.', 'error');
    return;
  }
  if (!answer) {
    showToast('Please enter an FAQ answer.', 'error');
    return;
  }

  const originalLabel = saveBtn ? saveBtn.textContent : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = editingFaqId ? 'Saving Changes...' : 'Saving FAQ...';
  }

  const payload = { question, category, answer, active };
  const result = isEditing
    ? await FaqAdmin.update(editingFaqId, payload)
    : await FaqAdmin.create(payload);

  if (!result.success) {
    showToast(result.message || 'Could not save FAQ.', 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    }
    return;
  }

  renderFaqs();
  cancelFaqEdit();
  showToast(isEditing ? 'FAQ updated successfully.' : 'FAQ added successfully.', 'success');

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

function openFaqDeleteModal(faqId) {
  pendingFaqDeleteId = faqId;
  const modal = document.getElementById('faqDeleteModal');
  if (modal) modal.style.display = 'flex';
}

function closeFaqDeleteModal() {
  pendingFaqDeleteId = null;
  const modal = document.getElementById('faqDeleteModal');
  if (modal) modal.style.display = 'none';
}

async function confirmFaqDelete() {
  if (!pendingFaqDeleteId) return;

  const faq = FaqAdmin.getById(pendingFaqDeleteId);
  const result = await FaqAdmin.delete(pendingFaqDeleteId);
  if (!result.success) {
    showToast(result.message || 'Could not delete FAQ.', 'error');
    return;
  }

  if (editingFaqId === pendingFaqDeleteId) {
    cancelFaqEdit();
  }

  closeFaqDeleteModal();
  renderFaqs();
  showToast(faq ? `Removed "${faq.question}".` : 'FAQ deleted.', 'success');
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
