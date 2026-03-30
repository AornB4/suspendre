// =========================================
//  SUSPENDRE — Account Dashboard Logic
// =========================================

document.addEventListener('DOMContentLoaded', () => {
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

  document.getElementById('saveAddressBtn').addEventListener('click', () => {
    const newAddress = addressInput.value.trim();
    const res = Auth.updateUser(user.id, { address: newAddress });
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
      img.onload = function() {
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
        
        const res = Auth.updateUser(user.id, { avatar: dataUrl });
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

  renderOrderHistory(user.id);
  renderWishlist();
});

function renderWishlist() {
  const container = document.getElementById('wishlistContainer');
  if (!container) return;
  const currentUser = Auth.getCurrentUser();
  const wishlistIds = currentUser.wishlist || [];

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
    container.appendChild(card);
  });
}

function renderOrderHistory(userId) {
  const container = document.getElementById('orderHistoryContainer');
  
  // Get orders sorted by newest first
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

  userOrders.forEach((order, index) => {
    // Simulate status: newest order is 'Processing', older ones are 'Shipped'
    // A real app would get this from the backend
    const ageHrs = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60);
    const isRecent = index === 0 && ageHrs < 24;
    const statusClass = isRecent ? 'status-processing' : 'status-shipped';
    const statusText = isRecent ? 'Processing' : 'Shipped';

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

// Global function to attach to inline onclick
window.reorder = function(orderId) {
  const order = Orders.getAll().find(o => o.id === orderId);
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
