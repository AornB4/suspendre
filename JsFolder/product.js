// =========================================
//  SUSPENDRE — Product Page Logic
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();

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
    if (!Auth.isLoggedIn()) {
      showToast('Please login to save favorites.', 'error');
      setTimeout(() => window.location.href = 'login.html', 1500);
      return;
    }

    const wasWished = Auth.getCurrentUser()?.wishlist?.includes(product.id);
    const result = await Auth.toggleWishlistItem(product.id);

    if (!result.success) {
      showToast(result.message || 'Could not update wishlist.', 'error');
      return;
    }

    if (wasWished) {
      wishSvg.setAttribute('fill', 'none');
      wishSvg.setAttribute('stroke', 'currentColor');
      wishBtn.style.borderColor = 'var(--border-light)';
      showToast('Removed from Wishlist.');
    } else {
      wishSvg.setAttribute('fill', '#c0392b');
      wishSvg.setAttribute('stroke', '#c0392b');
      wishBtn.style.borderColor = '#c0392b';
      showToast('Saved to Wishlist!', 'success');
    }
  });

  // Reveal UI
  loadingEl.style.display = 'none';
  contentEl.style.display = 'grid';

  // Reviews Logic
  await initSupabaseReviews(product.id);
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

// ===== SUPABASE REVIEWS SYSTEM =====
const SupabaseReviewsData = {
  userNameColumnAvailable: null,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  hasMissingColumnError(error, columnName) {
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return message.includes(columnName.toLowerCase()) && message.includes('column');
  },

  normalizeReview(review) {
    const currentUser = Auth.getCurrentUser();
    const isOwn = !!currentUser && currentUser.id === review.user_id;

    return {
      id: review.id,
      productId: review.product_id,
      userId: review.user_id,
      userName: review.user_name || (isOwn ? currentUser.name : 'Suspendre Customer'),
      rating: Number(review.rating) || 0,
      text: review.content || '',
      date: review.created_at || new Date().toISOString(),
      isOwn
    };
  },

  async fetchRows(productDbId) {
    const client = this.getClient();
    if (!client || !productDbId) return [];

    if (this.userNameColumnAvailable !== false) {
      const { data, error } = await client
        .from('reviews')
        .select('id, product_id, user_id, user_name, rating, content, created_at, updated_at')
        .eq('product_id', productDbId)
        .order('created_at', { ascending: false });

      if (!error) {
        this.userNameColumnAvailable = true;
        return data || [];
      }

      if (!this.hasMissingColumnError(error, 'user_name')) {
        console.error('Failed to load reviews.', error);
        return [];
      }

      this.userNameColumnAvailable = false;
    }

    const { data, error } = await client
      .from('reviews')
      .select('id, product_id, user_id, rating, content, created_at, updated_at')
      .eq('product_id', productDbId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load reviews.', error);
      return [];
    }

    return data || [];
  },

  async getByProduct(productId) {
    await ProductData.ready();

    const product = ProductData.getById(productId);
    if (!product) return [];

    const rows = await this.fetchRows(product.dbId);
    return rows.map((review) => this.normalizeReview(review));
  },

  async saveReview(productId, user, rating, text) {
    const client = this.getClient();
    if (!client || !user) {
      return { success: false, message: 'Please log in to write a review.' };
    }

    await ProductData.ready();
    const product = ProductData.getById(productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    const basePayload = {
      product_id: product.dbId,
      user_id: user.id,
      rating,
      content: text.trim()
    };

    let payload = { ...basePayload };
    if (this.userNameColumnAvailable !== false) {
      payload.user_name = user.name || 'Suspendre Customer';
    }

    let query = client
      .from('reviews')
      .upsert(payload, { onConflict: 'product_id,user_id' });

    if (this.userNameColumnAvailable !== false) {
      query = query.select('id, product_id, user_id, user_name, rating, content, created_at, updated_at');
    } else {
      query = query.select('id, product_id, user_id, rating, content, created_at, updated_at');
    }

    let { data, error } = await query.single();

    if (error && this.userNameColumnAvailable !== false && this.hasMissingColumnError(error, 'user_name')) {
      this.userNameColumnAvailable = false;

      const fallback = await client
        .from('reviews')
        .upsert(basePayload, { onConflict: 'product_id,user_id' })
        .select('id, product_id, user_id, rating, content, created_at, updated_at')
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return { success: false, message: error.message, error };
    }

    return {
      success: true,
      review: this.normalizeReview(data)
    };
  }
};

async function initSupabaseReviews(productId) {
  const section = document.getElementById('pdpReviews');
  section.style.display = 'block';

  let currentRating = 5;
  let existingUserReview = null;
  const starsContainer = document.getElementById('starRatingInput');
  const starSpans = starsContainer.querySelectorAll('span');
  const formContainer = document.getElementById('reviewFormContainer');
  const writeBtn = document.getElementById('writeReviewBtn');
  const cancelBtn = document.getElementById('cancelReviewBtn');
  const submitBtn = document.getElementById('submitReviewBtn');
  const textInput = document.getElementById('reviewTextInput');

  starSpans.forEach((span) => {
    span.addEventListener('click', (e) => {
      currentRating = parseInt(e.target.getAttribute('data-val'), 10);
      updateStarUI(currentRating);
    });
    span.addEventListener('mouseover', (e) => {
      updateStarUI(parseInt(e.target.getAttribute('data-val'), 10));
    });
  });

  starsContainer.addEventListener('mouseleave', () => {
    updateStarUI(currentRating);
  });

  function updateStarUI(value) {
    starSpans.forEach((span) => {
      span.classList.toggle('active', parseInt(span.getAttribute('data-val'), 10) <= value);
    });
  }

  function syncReviewCta() {
    writeBtn.textContent = existingUserReview ? 'Edit Your Review' : 'Write a Review';
    submitBtn.textContent = existingUserReview ? 'Update Review' : 'Submit Review';
  }

  function resetFormState() {
    textInput.value = existingUserReview ? existingUserReview.text : '';
    currentRating = existingUserReview ? existingUserReview.rating : 5;
    updateStarUI(currentRating);
    syncReviewCta();
  }

  writeBtn.addEventListener('click', () => {
    if (!Auth.isLoggedIn()) {
      showToast('Please log in to write a review.', 'error');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }

    resetFormState();
    formContainer.style.display = 'block';
    writeBtn.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    resetFormState();
    formContainer.style.display = 'none';
    writeBtn.style.display = 'block';
  });

  submitBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
      showToast('Please enter your review text.', 'error');
      return;
    }

    const user = Auth.getCurrentUser();
    const hadExistingReview = !!existingUserReview;

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    writeBtn.disabled = true;

    const result = await SupabaseReviewsData.saveReview(productId, user, currentRating, text);

    submitBtn.disabled = false;
    cancelBtn.disabled = false;
    writeBtn.disabled = false;

    if (!result.success) {
      showToast(result.message || 'Could not save your review right now.', 'error');
      return;
    }

    existingUserReview = result.review;
    resetFormState();
    formContainer.style.display = 'none';
    writeBtn.style.display = 'block';
    showToast(hadExistingReview ? 'Review updated successfully!' : 'Review submitted successfully!', 'success');

    await renderSupabaseReviewsList(productId, (review) => {
      existingUserReview = review;
      syncReviewCta();
    });
  });

  await renderSupabaseReviewsList(productId, (review) => {
    existingUserReview = review;
    syncReviewCta();
  });
  resetFormState();
}

async function renderSupabaseReviewsList(productId, onCurrentUserReviewChange = () => {}) {
  const listEl = document.getElementById('reviewsList');
  const countEl = document.getElementById('reviewCount');
  const avgStarsEl = document.getElementById('avgStars');
  const currentUserId = Auth.getCurrentUser()?.id || null;

  listEl.innerHTML = '<p style="color:var(--warm-gray); text-align:center; padding:40px 0;">Loading reviews...</p>';

  const reviews = await SupabaseReviewsData.getByProduct(productId);
  const currentUserReview = reviews.find((review) => review.userId === currentUserId) || null;
  onCurrentUserReviewChange(currentUserReview);

  countEl.textContent = `${reviews.length} Review${reviews.length !== 1 ? 's' : ''}`;

  if (reviews.length === 0) {
    avgStarsEl.textContent = '\u2605\u2605\u2605\u2605\u2605';
    listEl.innerHTML = '<p style="color:var(--warm-gray); text-align:center; padding:40px 0;">Be the first to review this piece.</p>';
    return [];
  }

  const avg = Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length);
  avgStarsEl.textContent = '\u2605'.repeat(avg) + '\u2606'.repeat(5 - avg);

  listEl.innerHTML = '';
  const safeString = (value) => String(value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  reviews.forEach((review) => {
    const el = document.createElement('div');
    el.className = 'review-item';
    const stars = '\u2605'.repeat(review.rating) + '\u2606'.repeat(5 - review.rating);
    el.innerHTML = `
      <div class="review-item-header">
        <div class="review-author">
          ${safeString(review.userName)} <span class="review-badge">${review.isOwn ? 'Your Review' : 'Customer'}</span>
        </div>
        <span class="review-date">${formatDate(review.date)}</span>
      </div>
      <div class="review-stars">${stars}</div>
      <div class="review-text">${safeString(review.text)}</div>
    `;
    listEl.appendChild(el);
  });

  return reviews;
}
