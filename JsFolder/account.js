// =========================================
//  SUSPENDRE — Account Dashboard Logic
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();
  await Orders.ready();
  await Cart.ready();

  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getCurrentUser();
  
  // Bind Profile Data
  const firstName = user.name ? user.name.split(' ')[0] : 'Guest';
  document.getElementById('welcomeMessage').textContent = `Welcome back, ${firstName}.`;
  document.getElementById('profileName').textContent = user.name || 'Guest User';
  document.getElementById('profileEmail').textContent = user.email || 'guest@suspendre.com';

  // Address Logic
  const addressDisplay = document.getElementById('addressDisplay');
  const addressEdit = document.getElementById('addressEdit');
  const profileAddress = document.getElementById('profileAddress');
  const addressInput = document.getElementById('addressInput');

  function renderAddress() {
    const currentUser = Auth.getCurrentUser();
    if (currentUser && currentUser.address) {
      profileAddress.innerHTML = currentUser.address.replace(/\n/g, '<br>');
      profileAddress.style.fontStyle = 'normal';
      profileAddress.style.color = 'var(--charcoal)';
    } else {
      profileAddress.innerHTML = 'No shipping address set.';
      profileAddress.style.fontStyle = 'italic';
      profileAddress.style.color = 'var(--warm-gray)';
    }
  }

  renderAddress();

  document.getElementById('editAddressBtn').addEventListener('click', () => {
    const currentUser = Auth.getCurrentUser();
    addressInput.value = currentUser.address || '';
    addressDisplay.style.display = 'none';
    addressEdit.style.display = 'block';
  });

  document.getElementById('cancelAddressBtn').addEventListener('click', () => {
    addressEdit.style.display = 'none';
    addressDisplay.style.display = 'block';
  });

  document.getElementById('saveAddressBtn').addEventListener('click', async () => {
    const newAddress = addressInput.value.trim();
    const res = await Auth.updateUser(user.id, { address: newAddress });
    if (res.success) {
      renderAddress();
      addressEdit.style.display = 'none';
      addressDisplay.style.display = 'block';
      showToast('Shipping address updated successfully.', 'success');
    } else {
      showToast('Failed to update address.', 'error');
    }
  });

  // Avatar Logic
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarInitial = document.getElementById('avatarInitial');

  function renderAvatar() {
    const currentUser = Auth.getCurrentUser();
    if (currentUser && currentUser.avatar) {
      avatarPreview.src = currentUser.avatar;
      avatarPreview.style.display = 'block';
      avatarInitial.style.display = 'none';
    } else {
      avatarPreview.style.display = 'none';
      avatarInitial.style.display = 'block';
      avatarInitial.textContent = (user.name ? user.name.charAt(0).toUpperCase() : 'U');
    }
  }
  
  renderAvatar();

  avatarInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = async function() {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const res = await Auth.updateUser(user.id, { avatar: dataUrl });
        if (res.success) {
          renderAvatar();
          
          // Sycn the top navbar immediately without a refresh
          const navImg = document.getElementById('navAvatarImg');
          if (navImg) {
            navImg.src = dataUrl;
          } else {
            const loginItem = document.getElementById('navLoginItem');
            if (loginItem) {
              loginItem.innerHTML = `<a href="account.html" title="Account" style="padding: 0 16px;">
                <img src="${dataUrl}" id="navAvatarImg" alt="Account" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              </a>`;
            }
          }

          showToast('Profile picture updated successfully.', 'success');
        } else {
          showToast('Failed to save profile picture.', 'error');
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const savePasswordBtn = document.getElementById('savePasswordBtn');
  const passwordMatchHint = document.getElementById('passwordMatchHint');
  const passwordRequirementEls = {
    length: document.getElementById('account-req-length'),
    upper: document.getElementById('account-req-upper'),
    lower: document.getElementById('account-req-lower'),
    number: document.getElementById('account-req-number'),
    special: document.getElementById('account-req-special')
  };

  function renderPasswordRequirements() {
    const value = newPasswordInput ? newPasswordInput.value : '';
    const checks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value)
    };

    Object.keys(checks).forEach((key) => {
      const el = passwordRequirementEls[key];
      if (!el) return;
      el.classList.toggle('valid', checks[key]);
    });
  }

  function validatePasswordMatch() {
    if (!newPasswordInput || !confirmPasswordInput || !passwordMatchHint) return true;
    if (!confirmPasswordInput.value) {
      passwordMatchHint.style.display = 'none';
      return true;
    }

    const matches = newPasswordInput.value === confirmPasswordInput.value;
    passwordMatchHint.style.display = 'block';
    passwordMatchHint.textContent = matches ? 'Passwords match' : 'Passwords do not match';
    passwordMatchHint.className = `password-hint ${matches ? 'success' : 'error'}`;
    return matches;
  }

  newPasswordInput?.addEventListener('input', () => {
    renderPasswordRequirements();
    validatePasswordMatch();
  });

  confirmPasswordInput?.addEventListener('input', validatePasswordMatch);

  savePasswordBtn?.addEventListener('click', async () => {
    const newPassword = newPasswordInput ? newPasswordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    if (!newPassword) {
      showToast('Please enter a new password.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      validatePasswordMatch();
      showToast('Passwords do not match.', 'error');
      return;
    }

    savePasswordBtn.disabled = true;
    savePasswordBtn.textContent = 'Saving...';

    const result = await Auth.updatePassword(newPassword);

    savePasswordBtn.disabled = false;
    savePasswordBtn.textContent = 'Set Password';

    if (!result.success) {
      showToast(result.message || 'Could not update password.', 'error');
      return;
    }

    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    renderPasswordRequirements();
    validatePasswordMatch();
    showToast('Password updated successfully.', 'success');
  });

  renderPasswordRequirements();

  await renderOrderHistory(user.id);
  await renderWishlist();
});

async function renderWishlist() {
  const container = document.getElementById('wishlistContainer');
  if (!container) return;
  const wishlistIds = await Auth.getWishlistIds();

  if (wishlistIds.length === 0) {
    container.style.display = 'block';
    container.innerHTML = `
      <div class="empty-orders">
        <p style="margin-bottom:24px;">Your wishlist is empty.</p>
        <a href="shop.html" class="btn-primary" style="padding:12px 24px; display:inline-block;">Discover Favorites</a>
      </div>
    `;
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';

  wishlistIds.forEach(id => {
    const product = ProductData.getById(id);
    if (!product) return;
    
    const card = buildProductCard(product);
    const actionBar = document.createElement('div');
    actionBar.className = 'wishlist-card-actions';

    const moveBtn = document.createElement('button');
    moveBtn.className = 'btn-primary wishlist-move-btn';
    moveBtn.textContent = 'Move to Cart';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-outline wishlist-remove-btn';
    removeBtn.textContent = 'Remove';

    moveBtn.addEventListener('click', async () => {
      const added = Cart.addItem(product.id);
      if (!added) {
        showToast('Could not move this item to cart.', 'error');
        return;
      }

      const result = await Auth.removeWishlistItem(product.id);
      if (!result.success) {
        showToast(result.message || 'Moved to cart, but wishlist could not update.', 'error');
        return;
      }

      showToast(`${product.name} moved to cart.`, 'success');
      renderWishlist();
      setTimeout(() => CartDrawer.open(), 100);
    });

    removeBtn.addEventListener('click', async () => {
      const result = await Auth.removeWishlistItem(product.id);
      if (!result.success) {
        showToast(result.message || 'Could not update wishlist.', 'error');
        return;
      }

      showToast(`${product.name} removed from wishlist.`);
      renderWishlist();
    });

    actionBar.append(moveBtn, removeBtn);
    card.appendChild(actionBar);
    container.appendChild(card);
  });
}

async function renderOrderHistory(userId) {
  const container = document.getElementById('orderHistoryContainer');
  
  const allOrders = Orders.getAll();
  const userOrders = allOrders.filter(o => o.userId === userId)
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (userOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-orders">
        <p style="margin-bottom:24px;">You haven't placed any orders yet.</p>
        <a href="shop.html" class="btn-primary" style="padding:12px 24px; display:inline-block;">Explore the Collection</a>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  userOrders.forEach((order) => {
    const normalizedStatus = String(order.status || '').toLowerCase();
    const statusClass = normalizedStatus === 'shipped'
      ? 'status-shipped'
      : normalizedStatus === 'processing' || normalizedStatus === 'paid' || normalizedStatus === 'pending'
        ? 'status-processing'
        : 'status-processing';
    const statusText = order.status
      ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
      : 'Processing';

    const orderEl = document.createElement('div');
    orderEl.className = 'order-item';
    
    // Build products list
    let productsHtml = '';
    const safeString = str => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
    
    order.items.forEach(item => {
      productsHtml += `<div class="order-product-line">${safeString(item.name)} <span>× ${item.qty}</span></div>`;
    });

    orderEl.innerHTML = `
      <div class="order-header">
        <div>
          <span class="order-id">${safeString(order.id)}</span>
          <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <span class="order-date">${formatDate(order.createdAt)}</span>
      </div>
      <div class="order-details">
        <div class="order-products">
          ${productsHtml}
        </div>
        <div class="order-actions">
          <span class="order-total">${formatPrice(order.total)}</span>
          <button class="btn-reorder" onclick="reorder('${safeString(order.id)}')">Buy Again</button>
        </div>
      </div>
    `;
    container.appendChild(orderEl);
  });
}

function formatTitleCase(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return fallback || '';
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getOrderStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'shipped') return { label: 'Shipped', className: 'status-shipped' };
  if (normalized === 'cancelled') return { label: 'Cancelled', className: 'status-cancelled' };
  if (normalized === 'paid') return { label: 'Paid', className: 'status-paid' };
  if (normalized === 'pending') return { label: 'Pending', className: 'status-pending' };

  return {
    label: formatTitleCase(status, 'Processing'),
    className: 'status-processing'
  };
}

function getPaymentStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'paid') return { label: 'Payment Confirmed', className: 'status-paid' };
  if (normalized === 'failed') return { label: 'Payment Failed', className: 'status-cancelled' };
  if (normalized === 'refunded') return { label: 'Refunded', className: 'status-pending' };

  return {
    label: formatTitleCase(status, 'Payment Pending'),
    className: 'status-pending'
  };
}

function formatPaymentMethodLabel(method) {
  const normalized = String(method || '').toLowerCase();
  if (!normalized) return 'Not recorded';
  if (normalized === 'paypal') return 'PayPal';
  if (normalized === 'manual') return 'Manual';
  return formatTitleCase(method, 'Not recorded');
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getOrderIcon(name) {
  const icons = {
    details: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      </svg>
    `,
    reorder: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M20 20v-6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M20 9a8 8 0 0 0-13.66-3L4 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M4 15a8 8 0 0 0 13.66 3L20 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
    calendar: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect>
        <path d="M16 3v4M8 3v4M3 10h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `,
    receipt: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M7 3h10a2 2 0 0 1 2 2v15l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
        <path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `,
    card: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect>
        <path d="M3 10h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `,
    bag: `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M6 8h12l-1 12H7L6 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
        <path d="M9 8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `
  };

  return icons[name] || '';
}

async function renderOrderHistory(userId) {
  const container = document.getElementById('orderHistoryContainer');

  const allOrders = Orders.getAll();
  const userOrders = allOrders
    .filter(order => order.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (userOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-orders">
        <p style="margin-bottom:24px;">You haven't placed any orders yet.</p>
        <a href="shop.html" class="btn-primary" style="padding:12px 24px; display:inline-block;">Explore the Collection</a>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  userOrders.forEach((order) => {
    const fulfillmentMeta = getOrderStatusMeta(order.status);
    const paymentMeta = getPaymentStatusMeta(order.paymentStatus);
    const itemCount = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
      : 0;
    const previewItems = Array.isArray(order.items) ? order.items.slice(0, 2) : [];
    const additionalItemCount = Math.max(0, (order.items || []).length - previewItems.length);
    const leadItem = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
    const leadProduct = leadItem ? ProductData.getById(leadItem.productId) : null;
    const leadImage = leadProduct ? ProductData.getImageSrc(leadProduct) : './images/placeholder.svg';

    const orderEl = document.createElement('div');
    orderEl.className = 'order-item';

    const safeString = (str) => str ? str.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    let productsHtml = '';
    let detailItemsHtml = '';

    previewItems.forEach((item) => {
      productsHtml += `<div class="order-product-line">${safeString(item.name)} <span>x ${item.qty}</span></div>`;
    });

    if (additionalItemCount > 0) {
      productsHtml += `<div class="order-product-line order-product-more">+ ${additionalItemCount} more item${additionalItemCount === 1 ? '' : 's'}</div>`;
    }

    (order.items || []).forEach((item) => {
      detailItemsHtml += `
        <div class="order-detail-line">
          <div class="order-detail-main">
            <span class="order-detail-name">${safeString(item.name)}</span>
            <span class="order-detail-qty">Qty ${item.qty}</span>
          </div>
          <div class="order-detail-pricing">
            <span>${formatPrice(Number(item.price) || 0)} each</span>
            <strong>${formatPrice(Number(item.subtotal) || ((Number(item.price) || 0) * (Number(item.qty) || 0)))}</strong>
          </div>
        </div>
      `;
    });

    orderEl.innerHTML = `
      <div class="order-header">
        <div class="order-header-main">
          <div class="order-hero">
            <div class="order-thumb-wrap">
              <img class="order-thumb" src="${leadImage}" alt="${safeString(leadItem ? leadItem.name : 'Order item')}" loading="lazy" onerror="this.onerror=null;this.src='./images/placeholder.svg'">
            </div>
            <div class="order-hero-copy">
              <span class="order-kicker">Recent Purchase</span>
              <span class="order-title">${safeString(leadItem ? leadItem.name : 'Order')}</span>
              <span class="order-reference-inline">Ref. ${safeString(order.id)}</span>
            </div>
          </div>
          <div class="order-status-row">
            <span class="order-status ${fulfillmentMeta.className}">${fulfillmentMeta.label}</span>
            <span class="order-status ${paymentMeta.className}">${paymentMeta.label}</span>
          </div>
        </div>
        <div class="order-header-side">
          <span class="order-date">${formatDate(order.createdAt)}</span>
          <span class="order-item-count">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="order-details">
        <div class="order-products">
          ${productsHtml}
        </div>
        <div class="order-actions">
          <span class="order-total">${formatPrice(order.total)}</span>
          <span class="order-support-copy">Saved to your account for reorder and support follow-up.</span>
          <div class="order-action-row">
            <button class="btn-outline btn-order-details" type="button" aria-expanded="false">
              <span class="btn-icon">${getOrderIcon('details')}</span>
              <span>View Details</span>
            </button>
            <button class="btn-reorder" onclick="reorder('${safeString(order.id)}')">
              <span class="btn-icon">${getOrderIcon('reorder')}</span>
              <span>Buy Again</span>
            </button>
          </div>
        </div>
      </div>
      <div class="order-detail-panel" hidden>
        <div class="order-detail-grid">
          <div class="order-detail-section">
            <span class="order-detail-label">Order Summary</span>
            <div class="order-detail-line compact">
              <div class="order-detail-main">
                <span class="order-detail-name">
                  <span class="order-detail-icon">${getOrderIcon('calendar')}</span>
                  <span>Order placed</span>
                </span>
              </div>
              <div class="order-detail-pricing">
                <span>${formatDateTime(order.createdAt)}</span>
              </div>
            </div>
            <div class="order-detail-line compact">
              <div class="order-detail-main">
                <span class="order-detail-name">
                  <span class="order-detail-icon">${getOrderIcon('receipt')}</span>
                  <span>Order reference</span>
                </span>
              </div>
              <div class="order-detail-pricing order-reference-value">
                <span>${safeString(order.id)}</span>
              </div>
            </div>
            <div class="order-detail-line compact">
              <div class="order-detail-main">
                <span class="order-detail-name">
                  <span class="order-detail-icon">${getOrderIcon('card')}</span>
                  <span>Payment method</span>
                </span>
              </div>
              <div class="order-detail-pricing">
                <span>${safeString(formatPaymentMethodLabel(order.paymentMethod))}</span>
              </div>
            </div>
          </div>
          <div class="order-detail-section">
            <span class="order-detail-label">Items</span>
            ${detailItemsHtml}
            <div class="order-detail-total">
              <span class="order-detail-name">
                <span class="order-detail-icon">${getOrderIcon('bag')}</span>
                <span>Total</span>
              </span>
              <strong>${formatPrice(order.total)}</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    const toggleBtn = orderEl.querySelector('.btn-order-details');
    const detailPanel = orderEl.querySelector('.order-detail-panel');
    if (toggleBtn && detailPanel) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = !detailPanel.hasAttribute('hidden');
        if (isOpen) {
          detailPanel.setAttribute('hidden', '');
          toggleBtn.textContent = 'View Details';
          toggleBtn.setAttribute('aria-expanded', 'false');
          orderEl.classList.remove('details-open');
        } else {
          detailPanel.removeAttribute('hidden');
          toggleBtn.textContent = 'Hide Details';
          toggleBtn.setAttribute('aria-expanded', 'true');
          orderEl.classList.add('details-open');
        }
      });
    }

    container.appendChild(orderEl);
  });
}

// Global function to attach to inline onclick
window.reorder = function(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;

  let addedCount = 0;
  order.items.forEach(item => {
    for (let i = 0; i < item.qty; i++) {
      if (Cart.addItem(item.productId)) addedCount++;
    }
  });

  if (addedCount > 0) {
    showToast('Items added to your cart!', 'success');
    setTimeout(() => CartDrawer.open(), 100);
  } else {
    showToast('Items are currently out of stock.', 'error');
  }
};
