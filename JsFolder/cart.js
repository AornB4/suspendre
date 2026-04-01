// =========================================
//  SUSPENDRE — Cart Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();
  await Cart.ready();

  // Cart is accessible to everyone (guests and logged-in users)

  renderCart();
  window.addEventListener('suspendre:cart-updated', renderCart);

  document.getElementById('checkoutBtn')?.addEventListener('click', handleCheckout);
  document.getElementById('receiptClose')?.addEventListener('click', () => {
    void finalizeOrder();
  });
  document.getElementById('receiptCancel')?.addEventListener('click', cancelCheckout);
  document.getElementById('receiptScrollBtn')?.addEventListener('click', toggleReceiptScroll);
  document.querySelector('.receipt-modal')?.addEventListener('scroll', updateReceiptScrollButton);
});

function renderCart() {
  const items    = Cart.getItems();
  const savedItems = Cart.getSavedItems();
  const layout   = document.getElementById('cartLayout');
  const empty    = document.getElementById('cartEmpty');
  const cartItemsEl = document.getElementById('cartItems');
  const savedItemsPanel = document.getElementById('savedItemsPanel');
  const savedItemsEl = document.getElementById('savedItems');
  const summary = document.getElementById('cartSummary');
  const summaryLines = document.getElementById('summaryLines');
  const totalEl  = document.getElementById('cartTotal');

  if (items.length === 0 && savedItems.length === 0) {
    if (layout) layout.style.display = 'none';
    if (empty)  empty.style.display  = 'block';
    return;
  }

  if (layout) layout.style.display = '';
  if (empty)  empty.style.display  = 'none';
  if (summary) summary.style.display = items.length > 0 ? '' : 'none';

  // Build cart items
  if (cartItemsEl) {
    cartItemsEl.innerHTML = '';
    if (items.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="cart-inline-empty">
          <p style="margin-bottom:12px;">Your active cart is empty.</p>
          <p style="color:var(--warm-gray);">Saved pieces remain below whenever you're ready.</p>
        </div>
      `;
    }

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
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-save-later';
      saveBtn.dataset.id = product.id;
      saveBtn.textContent = 'Save for Later';
      const linksDiv = document.createElement('div');
      linksDiv.className = 'cart-item-links';
      linksDiv.append(saveBtn, removeBtn);
      controlsDiv.append(qtyDiv, linksDiv);

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

      saveBtn.addEventListener('click', () => {
        const moved = Cart.saveForLater(product.id);
        if (!moved) {
          showToast('Could not save this item for later.', 'error');
          return;
        }
        showToast(`${product.name} saved for later.`, 'success');
        renderCart();
      });

      cartItemsEl.appendChild(row);
    });
  }

  if (savedItemsPanel && savedItemsEl) {
    savedItemsPanel.style.display = savedItems.length > 0 ? 'block' : 'none';
    savedItemsEl.innerHTML = '';

    savedItems.forEach((item, idx) => {
      const product = ProductData.getById(item.productId);
      if (!product) return;

      const row = document.createElement('div');
      row.className = 'cart-item';
      row.style.animationDelay = `${idx * 0.06}s`;

      const imgSrc = ProductData.getImageSrc(product);

      const imgDiv = document.createElement('div');
      imgDiv.className = 'cart-item-img';
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = product.name;
      img.loading = 'lazy';
      img.onerror = function() { this.onerror = null; this.src = './images/placeholder.svg'; };
      imgDiv.appendChild(img);

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
      const qtyNote = document.createElement('p');
      qtyNote.className = 'cart-item-category';
      qtyNote.style.marginTop = '10px';
      qtyNote.textContent = `Saved quantity: ${item.qty}`;
      infoDiv.append(catP, nameH3, priceP, qtyNote);

      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'cart-item-controls';
      const moveBtn = document.createElement('button');
      moveBtn.className = 'btn-move-to-cart';
      moveBtn.dataset.id = product.id;
      moveBtn.textContent = 'Move to Cart';
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.dataset.id = product.id;
      removeBtn.textContent = 'Remove';
      const linksDiv = document.createElement('div');
      linksDiv.className = 'cart-item-links';
      linksDiv.append(moveBtn, removeBtn);
      controlsDiv.appendChild(linksDiv);

      moveBtn.addEventListener('click', () => {
        const moved = Cart.moveSavedToCart(product.id);
        if (!moved) {
          showToast('Could not move this item back to cart.', 'error');
          return;
        }
        showToast(`${product.name} moved back to cart.`, 'success');
        renderCart();
      });

      removeBtn.addEventListener('click', () => {
        Cart.removeSavedItem(product.id);
        showToast(`${product.name} removed from saved items.`);
        renderCart();
      });

      row.append(imgDiv, infoDiv, controlsDiv);
      savedItemsEl.appendChild(row);
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

async function handleCheckout() {
  await Auth.ready();

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

async function finalizeOrder() {
  if (!pendingOrderItems || pendingOrderItems.length === 0) return;

  const closeBtn = document.getElementById('receiptClose');
  const cancelBtn = document.getElementById('receiptCancel');

  if (closeBtn) {
    closeBtn.disabled = true;
    closeBtn.textContent = 'Finalizing...';
  }
  if (cancelBtn) cancelBtn.disabled = true;

  const result = await Orders.createOrder(pendingOrderItems, {
    paymentMethod: window.paypal ? 'paypal' : 'manual',
    paymentStatus: 'paid',
    status: 'processing'
  });

  if (closeBtn) {
    closeBtn.disabled = false;
    closeBtn.textContent = 'Complete Order';
  }
  if (cancelBtn) cancelBtn.disabled = false;

  if (!result.success) {
    showToast(result.message || 'Could not complete your order.', 'error');
    return;
  }

  Cart.clear();
  await Cart.flushSync();
  pendingOrderItems = null;

  document.getElementById('receiptModal').style.display = 'none';
  showToast('Order placed successfully!', 'success');
  window.location.href = 'shop.html';
}

function cancelCheckout() {
  // Cancel — do NOT finalize, keep cart intact
  pendingOrderItems = null;
  document.getElementById('receiptModal').style.display = 'none';
  updateReceiptScrollButton();
  showToast('Checkout cancelled. Your cart is still intact.', 'default');
}

function updateReceiptScrollButton() {
  const modal = document.querySelector('.receipt-modal');
  const button = document.getElementById('receiptScrollBtn');
  const icon = button?.querySelector('.receipt-scroll-icon');
  const label = button?.querySelector('.receipt-scroll-label');

  if (!modal || !button || !icon || !label) return;

  const canScroll = modal.scrollHeight > modal.clientHeight + 24;
  if (!canScroll) {
    button.classList.remove('visible');
    return;
  }

  const nearBottom = modal.scrollTop + modal.clientHeight >= modal.scrollHeight - 32;
  button.classList.add('visible');
  icon.textContent = nearBottom ? '↑' : '↓';
  label.textContent = nearBottom ? 'Top' : 'Scroll';
}

function toggleReceiptScroll() {
  const modal = document.querySelector('.receipt-modal');
  if (!modal) return;

  const nearBottom = modal.scrollTop + modal.clientHeight >= modal.scrollHeight - 32;
  modal.scrollTo({
    top: nearBottom ? 0 : modal.scrollHeight,
    behavior: 'smooth'
  });
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
  const modalCard = modal.querySelector('.receipt-modal');
  if (modalCard) {
    modalCard.scrollTop = 0;
  }
  updateReceiptScrollButton();
}
