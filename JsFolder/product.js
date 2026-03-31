// =========================================
//  SUSPENDRE — Product Page Logic
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  const loadingEl = document.getElementById('pdpLoading');
  const errorEl = document.getElementById('pdpError');
  const contentEl = document.getElementById('pdpContent');

  if (!productId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  const product = ProductData.getById(productId);

  if (!product) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  // Bind Data
  document.title = `${product.name} — SUSPENDRE`;
  document.getElementById('pdpBreadcrumbCategory').textContent = product.category;
  document.getElementById('pdpTitle').textContent = product.name;
  document.getElementById('pdpPrice').textContent = formatPrice(product.price);
  
  // Use existing description or fallback
  document.getElementById('pdpDesc').textContent = product.description || 'A timeless piece of craftsmanship, designed to elevate your wardrobe instantly.';
  
  const imgSrc = ProductData.getImageSrc(product);
  const imgEl = document.getElementById('pdpMainImage') || document.getElementById('pdpImage');
  if (imgEl) imgEl.src = imgSrc;

  // Hover-to-Zoom Logic
  const imgContainer = document.querySelector('.pdp-gallery');
  if (imgContainer && imgEl) {
    imgContainer.addEventListener('mousemove', (e) => {
      const rect = imgContainer.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
      
      imgEl.style.transformOrigin = `${xPercent}% ${yPercent}%`;
      imgEl.style.transform = 'scale(2)';
    });
    
    imgContainer.addEventListener('mouseleave', () => {
      imgEl.style.transformOrigin = 'center center';
      imgEl.style.transform = 'scale(1)';
    });
  }

  const stockEl = document.getElementById('pdpStockStatus');
  const btnAdd = document.getElementById('pdpAddBtn');

  if (product.stock <= 0) {
    stockEl.textContent = 'Out of Stock';
    stockEl.className = 'pdp-stock-status out-of-stock';
    btnAdd.textContent = 'Sold Out';
    btnAdd.disabled = true;
  } else if (product.stock <= 5) {
    stockEl.textContent = `Only ${product.stock} left in stock — Order soon`;
    stockEl.className = 'pdp-stock-status low-stock';
  } else {
    stockEl.textContent = 'In Stock';
    stockEl.className = 'pdp-stock-status in-stock';
  }

  btnAdd.addEventListener('click', () => {
    if (product.stock <= 0) return;
    const added = Cart.addItem(product.id);
    if (added) {
      btnAdd.textContent = '\u2713 Added to Cart';
      setTimeout(() => { btnAdd.textContent = 'Add to Cart'; }, 2000);
      CartDrawer.open();
    } else {
      showToast('Could not add item to cart.', 'error');
    }
  });

  // Wishlist Logic for PDP
  const wishBtn = document.getElementById('pdpWishBtn');
  const wishSvg = document.getElementById('pdpWishSvg');
  const currentUser = Auth.getCurrentUser();
  
  if (currentUser && currentUser.wishlist && currentUser.wishlist.includes(product.id)) {
    wishSvg.setAttribute('fill', '#c0392b');
    wishSvg.setAttribute('stroke', '#c0392b');
    wishBtn.style.borderColor = '#c0392b';
  }

  wishBtn.addEventListener('click', async () => {
    const user = Auth.getCurrentUser();
    if (!user) {
      showToast('Please login to save favorites.', 'error');
      setTimeout(() => window.location.href = 'login.html', 1500);
      return;
    }
    
    let wishlist = user.wishlist || [];
    if (wishlist.includes(product.id)) {
      wishlist = wishlist.filter(id => id !== product.id);
      wishSvg.setAttribute('fill', 'none');
      wishSvg.setAttribute('stroke', 'currentColor');
      wishBtn.style.borderColor = 'var(--border-light)';
      showToast('Removed from Wishlist.');
    } else {
      wishlist.push(product.id);
      wishSvg.setAttribute('fill', '#c0392b');
      wishSvg.setAttribute('stroke', '#c0392b');
      wishBtn.style.borderColor = '#c0392b';
      showToast('Saved to Wishlist!', 'success');
    }
    const result = await Auth.updateUser(user.id, { wishlist });
    if (!result.success) {
      showToast(result.message || 'Could not update wishlist.', 'error');
    }
  });

  // Reveal UI
  loadingEl.style.display = 'none';
  contentEl.style.display = 'grid';

  // Reviews Logic
  initReviews(product.id, product.name);
});

// ===== REVIEWS SYSTEM =====
const ReviewsData = {
  KEY: 'suspendre_reviews',
  getAll() {
    let reviews = JSON.parse(localStorage.getItem(this.KEY));
    if (!reviews) {
      // Seed some incredible dummy reviews
      reviews = [
        { id: 1, productId: 'p1', userName: 'Eleanor V.', rating: 5, text: 'These hangers completely revitalized my closet. The solid brass hook glides silently on the rail, and the shoulder flare prevents any puckering on my silk blouses. Worth every penny.', date: new Date(Date.now() - 86400000 * 4).toISOString() },
        { id: 2, productId: 'p2', userName: 'Jonathan P.', rating: 5, text: 'You don\'t realize what a difference a structural hanger makes until you use one of these. Impeccable craftsmanship.', date: new Date(Date.now() - 86400000 * 12).toISOString() },
        { id: 3, productId: 'p1', userName: 'Alistair C.', rating: 4, text: 'Beautiful finish. They are somewhat heavier than expected, which screams quality, but took some adjusting on my lightweight racks.', date: new Date(Date.now() - 86400000 * 20).toISOString() }
      ];
      localStorage.setItem(this.KEY, JSON.stringify(reviews));
    }
    return reviews;
  },
  getByProduct(productId) {
    return this.getAll().filter(r => r.productId === productId).sort((a,b) => new Date(b.date) - new Date(a.date));
  },
  addReview(productId, userName, rating, text) {
    const reviews = this.getAll();
    reviews.unshift({
      id: Date.now(),
      productId,
      userName,
      rating,
      text,
      date: new Date().toISOString()
    });
    localStorage.setItem(this.KEY, JSON.stringify(reviews));
  }
};

function initReviews(productId, productName) {
  const section = document.getElementById('pdpReviews');
  section.style.display = 'block';

  let currentRating = 5;
  const starsContainer = document.getElementById('starRatingInput');
  const starSpans = starsContainer.querySelectorAll('span');
  
  // Setup Star Hover & Click
  starSpans.forEach(span => {
    span.addEventListener('click', (e) => {
      currentRating = parseInt(e.target.getAttribute('data-val'));
      updateStarUI(currentRating);
    });
    span.addEventListener('mouseover', (e) => {
      updateStarUI(parseInt(e.target.getAttribute('data-val')));
    });
  });
  starsContainer.addEventListener('mouseleave', () => {
    updateStarUI(currentRating);
  });

  function updateStarUI(val) {
    starSpans.forEach(span => {
      span.classList.toggle('active', parseInt(span.getAttribute('data-val')) <= val);
    });
  }
  updateStarUI(currentRating);

  // Form toggling
  const formContainer = document.getElementById('reviewFormContainer');
  const writeBtn = document.getElementById('writeReviewBtn');
  
  writeBtn.addEventListener('click', () => {
    if (!Auth.isLoggedIn()) {
      showToast('Please log in to write a review.', 'error');
      setTimeout(() => window.location.href = 'login.html', 1500);
      return;
    }
    formContainer.style.display = 'block';
    writeBtn.style.display = 'none';
  });

  document.getElementById('cancelReviewBtn').addEventListener('click', () => {
    formContainer.style.display = 'none';
    writeBtn.style.display = 'block';
  });

  document.getElementById('submitReviewBtn').addEventListener('click', () => {
    const text = document.getElementById('reviewTextInput').value.trim();
    if (!text) {
      showToast('Please enter your review text.', 'error');
      return;
    }
    
    const user = Auth.getCurrentUser();
    ReviewsData.addReview(productId, user.name || 'Verified Buyer', currentRating, text);
    
    document.getElementById('reviewTextInput').value = '';
    currentRating = 5;
    updateStarUI(5);
    formContainer.style.display = 'none';
    writeBtn.style.display = 'block';
    showToast('Review submitted successfully!', 'success');
    
    renderReviewsList(productId);
  });

  renderReviewsList(productId);
}

function renderReviewsList(productId) {
  const reviews = ReviewsData.getByProduct(productId);
  const listEl = document.getElementById('reviewsList');
  const countEl = document.getElementById('reviewCount');
  const avgStarsEl = document.getElementById('avgStars');

  countEl.textContent = `${reviews.length} Review${reviews.length !== 1 ? 's' : ''}`;

  if (reviews.length === 0) {
    avgStarsEl.textContent = '★★★★★';
    listEl.innerHTML = '<p style="color:var(--warm-gray); text-align:center; padding:40px 0;">Be the first to review this piece.</p>';
    return;
  }

  const avg = Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
  avgStarsEl.textContent = '★'.repeat(avg) + '☆'.repeat(5 - avg);

  listEl.innerHTML = '';
  const safeString = str => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  reviews.forEach(r => {
    const el = document.createElement('div');
    el.className = 'review-item';
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    el.innerHTML = `
      <div class="review-item-header">
        <div class="review-author">
          ${safeString(r.userName)} <span class="review-badge">Verified</span>
        </div>
        <span class="review-date">${formatDate(r.date)}</span>
      </div>
      <div class="review-stars">${stars}</div>
      <div class="review-text">${safeString(r.text)}</div>
    `;
    listEl.appendChild(el);
  });
}
