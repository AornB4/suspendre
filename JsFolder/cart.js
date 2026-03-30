// =========================================
//  SUSPENDRE — Cart Page
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  // Cart is accessible to everyone (guests and logged-in users)

  renderCart();

  document.getElementById('checkoutBtn')?.addEventListener('click', handleCheckout);
  document.getElementById('receiptClose')?.addEventListener('click', finalizeOrder);
  document.getElementById('receiptCancel')?.addEventListener('click', cancelCheckout);
});

function renderCart() {
  const items    = Cart.getItems();
  const layout   = document.getElementById('cartLayout');
  const empty    = document.getElementById('cartEmpty');
  const cartItemsEl = document.getElementById('cartItems');
  const summaryLines = document.getElementById('summaryLines');
  const totalEl  = document.getElementById('cartTotal');

  if (items.length === 0) {
    if (layout) layout.style.display = 'none';
    if (empty)  empty.style.display  = 'block';
    return;
  }

  if (layout) layout.style.display = '';
  if (empty)  empty.style.display  = 'none';

  // Build cart items
  if (cartItemsEl) {
    cartItemsEl.innerHTML = '';
    items.forEach((item, idx) => {
      const product = ProductData.getById(item.productId);
      if (!product) return;

      const row = document.createElement('div');
      row.className = 'cart-item';
      row.style.animationDelay = `${idx * 0.08}s`;

      const imgSrc = ProductData.getImageSrc(product);

      // Image container
      const imgDiv = document.createElement('div');
      imgDiv.className = 'cart-item-img';
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = product.name;
      img.loading = 'lazy';
      img.onerror = function() { this.onerror = null; this.src = './images/placeholder.svg'; };
      imgDiv.appendChild(img);

      // Info container
      const infoDiv = document.createElement('div');
      infoDiv.className = 'cart-item-info';
      const catP = document.createElement('p');
      catP.className = 'cart-item-category';
      catP.textContent = product.category;
      const nameH3 = document.createElement('h3');
      nameH3.className = 'cart-item-name';
      nameH3.textContent = product.name;
      const priceP = document.createElement('p');
      priceP.className = 'cart-item-price';
      priceP.textContent = formatPrice(product.price);
      infoDiv.append(catP, nameH3, priceP);

      // Controls container
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'cart-item-controls';
      const qtyDiv = document.createElement('div');
      qtyDiv.className = 'qty-control';
      const minusBtn = document.createElement('button');
      minusBtn.className = 'qty-btn btn-minus';
      minusBtn.dataset.id = product.id;
      minusBtn.textContent = '\u2212';
      const qtySpan = document.createElement('span');
      qtySpan.className = 'qty-display';
      qtySpan.textContent = item.qty;
      const plusBtn = document.createElement('button');
      plusBtn.className = 'qty-btn btn-plus';
      plusBtn.dataset.id = product.id;
      plusBtn.dataset.max = product.stock;
      plusBtn.textContent = '+';
      qtyDiv.append(minusBtn, qtySpan, plusBtn);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.dataset.id = product.id;
      removeBtn.textContent = 'Remove';
      controlsDiv.append(qtyDiv, removeBtn);

      row.append(imgDiv, infoDiv, controlsDiv);

      // Qty minus
      minusBtn.addEventListener('click', () => {
        Cart.updateQty(product.id, item.qty - 1);
        renderCart();
      });

      // Qty plus
      plusBtn.addEventListener('click', () => {
        if (item.qty >= product.stock) {
          showToast(`Only ${product.stock} available.`, 'error');
          return;
        }
        Cart.updateQty(product.id, item.qty + 1);
        renderCart();
      });

      // Remove
      removeBtn.addEventListener('click', () => {
        Cart.removeItem(product.id);
        showToast(`${product.name} removed from cart.`);
        renderCart();
      });

      cartItemsEl.appendChild(row);
    });
  }

  // Build summary
  if (summaryLines) {
    summaryLines.innerHTML = '';
    items.forEach(item => {
      const product = ProductData.getById(item.productId);
      if (!product) return;
      const line = document.createElement('div');
      line.className = 'summary-line';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${product.name} × ${item.qty}`;
      const priceSpan = document.createElement('span');
      priceSpan.textContent = formatPrice(product.price * item.qty);
      line.append(nameSpan, priceSpan);
      summaryLines.appendChild(line);
    });
  }

  const total = Cart.getTotal();
  if (totalEl) totalEl.textContent = formatPrice(total);
}

// Pending order data (not yet finalized)
let pendingOrderItems = null;

function handleCheckout() {
  const items = Cart.getItems();
  if (items.length === 0) return;

  // Require login at checkout
  if (!Auth.isLoggedIn()) {
    showToast('Please log in or sign up to complete your purchase.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  // Save items for finalization later, but do NOT create order yet
  pendingOrderItems = items;

  // Show receipt preview (order is NOT finalized yet)
  showReceiptPreview(items);
}

function finalizeOrder() {
  if (!pendingOrderItems || pendingOrderItems.length === 0) return;

  // NOW create the order, decrement stock, and clear cart
  Orders.createOrder(pendingOrderItems);
  Cart.clear();
  pendingOrderItems = null;

  document.getElementById('receiptModal').style.display = 'none';
  window.location.href = 'shop.html';
}

function cancelCheckout() {
  // Cancel — do NOT finalize, keep cart intact
  pendingOrderItems = null;
  document.getElementById('receiptModal').style.display = 'none';
  showToast('Checkout cancelled. Your cart is still intact.', 'default');
}

function showReceiptPreview(cartItems) {
  const modal       = document.getElementById('receiptModal');
  const receiptBody = document.getElementById('receiptBody');
  const receiptTotal = document.getElementById('receiptTotal');
  const receiptNum  = document.getElementById('receiptNumber');

  if (!modal) return;

  if (receiptNum) receiptNum.textContent = 'ORD-' + Date.now();

  let total = 0;
  if (receiptBody) {
    receiptBody.innerHTML = '';
    cartItems.forEach(item => {
      const product = ProductData.getById(item.productId);
      if (!product) return;
      const subtotal = product.price * item.qty;
      total += subtotal;

      const row = document.createElement('div');
      row.className = 'receipt-item';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'receipt-item-name';
      nameSpan.textContent = product.name;
      const qtySpan = document.createElement('span');
      qtySpan.className = 'receipt-item-qty';
      qtySpan.textContent = `× ${item.qty}`;
      const priceSpan = document.createElement('span');
      priceSpan.className = 'receipt-item-price';
      priceSpan.textContent = formatPrice(subtotal);
      row.append(nameSpan, qtySpan, priceSpan);
      receiptBody.appendChild(row);
    });
  }

  if (receiptTotal) receiptTotal.textContent = formatPrice(total);

  // Initialize PayPal Buttons (only once)
  if (!window.paypalButtonsRendered && window.paypal) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        // Calculate exact total dynamically at time of click
        const currentTotal = pendingOrderItems.reduce((sum, item) => {
          const p = ProductData.getById(item.productId);
          return sum + (p ? p.price * item.qty : 0);
        }, 0);
        
        return actions.order.create({
          purchase_units: [{
            amount: { value: currentTotal.toFixed(2) }
          }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then((details) => {
          // Success! Finalize the order globally.
          showToast('Payment successful via PayPal!', 'success');
          finalizeOrder(); 
        });
      },
      onError: (err) => {
        console.error('PayPal Error:', err);
        showToast('Payment failed or was cancelled.', 'error');
      }
    }).render('#paypal-button-container');
    window.paypalButtonsRendered = true;
  } else if (!window.paypal) {
    // Fallback if SDK is blocked
    const fallbackBtn = document.getElementById('receiptClose');
    if (fallbackBtn) fallbackBtn.style.display = 'block';
  }

  modal.style.display = 'flex';
}
