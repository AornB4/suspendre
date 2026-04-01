// =========================================
//  SUSPENDRE — Product Page Logic
// =========================================

const RECENTLY_VIEWED_KEY = 'suspendre_recently_viewed';

function getReturnQuery() {
  const params = new URLSearchParams(window.location.search);
  const returnParam = params.get('return');
  if (!returnParam || !returnParam.startsWith('?')) return '';
  return returnParam;
}

function configureBackLinks() {
  const backHref = `shop.html${getReturnQuery()}`;
  const backLink = document.querySelector('.pdp-back-link');
  const breadcrumbLink = document.querySelector('.pdp-breadcrumbs a');

  if (backLink) backLink.href = backHref;
  if (breadcrumbLink) breadcrumbLink.href = backHref;
}

function buildProductHref(productId) {
  const backQuery = getReturnQuery();
  return `product.html?id=${productId}${backQuery ? `&return=${encodeURIComponent(backQuery)}` : ''}`;
}

function getCategoryLabel(category) {
  return String(category || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function updateRecentlyViewedToggle(isExpanded) {
  const toggle = document.getElementById('recentlyViewedToggle');
  const grid = document.getElementById('recentlyViewedGrid');
  if (!toggle || !grid) return;

  toggle.textContent = isExpanded ? 'Hide Recently Viewed' : 'View Recently Viewed';
  toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  grid.style.display = isExpanded ? 'grid' : 'none';
}

function getRelatedProducts(currentProduct) {
  const allProducts = ProductData.getAll()
    .filter((product) => product.active !== false && product.id !== currentProduct.id);

  const currentPrice = Number(currentProduct.price) || 0;

  return allProducts
    .map((product) => {
      const priceGap = Math.abs((Number(product.price) || 0) - currentPrice);
      let score = 0;

      if (product.category === currentProduct.category) score += 80;
      if (product.stock > 0) score += 35;
      if (product.stock > 0 && product.stock <= 4) score += 4;
      if (product.featured) score += 16;
      score += Math.max(0, 28 - Math.min(28, priceGap / 18));

      if (product.category !== currentProduct.category && product.featured) score += 6;
      if (product.category !== currentProduct.category && product.stock > 0) score += 4;
      if (product.stock <= 0) score -= 42;

      return {
        product,
        score,
        priceGap
      };
    })
    .sort((a, b) => (
      b.score - a.score ||
      a.priceGap - b.priceGap ||
      (b.product.stock || 0) - (a.product.stock || 0) ||
      a.product.name.localeCompare(b.product.name)
    ))
    .slice(0, 4)
    .map((entry) => entry.product);
}

function renderRelatedProducts(currentProduct) {
  const section = document.getElementById('pdpRelatedSection');
  const grid = document.getElementById('relatedProductsGrid');
  const eyebrow = document.getElementById('pdpRelatedEyebrow');
  const title = document.getElementById('pdpRelatedTitle');
  const copy = document.getElementById('pdpRelatedCopy');

  if (!section || !grid || !currentProduct) return;

  const relatedProducts = getRelatedProducts(currentProduct);
  if (!relatedProducts.length) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  const categoryLabel = getCategoryLabel(currentProduct.category);
  if (eyebrow) eyebrow.textContent = `${categoryLabel} Collection`;
  if (title) title.textContent = `Selected Around ${currentProduct.name}`;
  if (copy) {
    copy.textContent = `Pieces chosen for a similar material story, strong availability, and a price rhythm that sits naturally beside ${currentProduct.name}.`;
  }

  grid.innerHTML = '';
  relatedProducts.forEach((product) => {
    const stockLabel = product.stock <= 0
      ? 'Sold Out'
      : product.stock <= 4
        ? `Only ${product.stock} Left`
        : 'In Stock';

    const card = document.createElement('a');
    card.className = 'pdp-related-card';
    card.href = buildProductHref(product.id);
    card.innerHTML = `
      <img src="${ProductData.getImageSrc(product)}" alt="${product.name}">
      <div class="pdp-related-copy">
        <span class="pdp-related-category">${getCategoryLabel(product.category)}</span>
        <div class="pdp-related-title">${product.name}</div>
        <div class="pdp-related-price">${formatPrice(product.price)}</div>
        <div class="pdp-related-meta">
          <span class="pdp-related-stock">${stockLabel}</span>
          <span class="pdp-related-link">View Piece</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  section.style.display = 'block';
}

function rememberRecentlyViewed(productId) {
  if (!productId) return;

  let recentIds = [];
  try {
    recentIds = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
  } catch (error) {
    recentIds = [];
  }

  const nextIds = [productId, ...recentIds.filter(id => id !== productId)].slice(0, 8);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(nextIds));
}

function renderRecentlyViewed(currentProductId) {
  const section = document.getElementById('pdpRecentlyViewed');
  const grid = document.getElementById('recentlyViewedGrid');
  const toggle = document.getElementById('recentlyViewedToggle');
  if (!section || !grid) return;

  let recentIds = [];
  try {
    recentIds = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
  } catch (error) {
    recentIds = [];
  }

  const products = recentIds
    .filter(id => id !== currentProductId)
    .map(id => ProductData.getById(id))
    .filter(product => product && product.active !== false)
    .slice(0, 4);

  if (!products.length) {
    section.style.display = 'none';
    grid.innerHTML = '';
    if (toggle) toggle.style.display = 'none';
    return;
  }

  grid.innerHTML = '';

  products.forEach(product => {
    const card = document.createElement('a');
    card.className = 'pdp-recent-card';
    card.href = buildProductHref(product.id);
    card.innerHTML = `
      <img src="${ProductData.getImageSrc(product)}" alt="${product.name}">
      <div class="pdp-recent-copy">
        <span class="pdp-recent-category">${getCategoryLabel(product.category)}</span>
        <div class="pdp-recent-title">${product.name}</div>
        <div class="pdp-recent-price">${formatPrice(product.price)}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  section.style.display = 'block';
  if (toggle) {
    toggle.style.display = '';
    toggle.onclick = () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      updateRecentlyViewedToggle(!expanded);
    };
  }
  updateRecentlyViewedToggle(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();
  configureBackLinks();

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
  document.title = `${product.name} - SUSPENDRE`;
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
  let restockRequested = false;

  function syncRestockButtonState() {
    if (product.stock > 0) return;
    btnAdd.disabled = false;
    btnAdd.textContent = restockRequested ? 'Alert Requested' : 'Notify Me';
    btnAdd.classList.toggle('btn-outline', restockRequested);
    btnAdd.classList.toggle('btn-primary', !restockRequested);
  }

  if (product.stock <= 0) {
    stockEl.textContent = 'Out of Stock';
    stockEl.className = 'pdp-stock-status out-of-stock';
    if (Auth.isLoggedIn()) {
      const requestedIds = await RestockRequests.getRequestedIds();
      restockRequested = requestedIds.includes(product.id);
    }
    syncRestockButtonState();
  } else if (product.stock <= 5) {
    stockEl.textContent = `Only ${product.stock} left in stock — Order soon`;
    stockEl.className = 'pdp-stock-status low-stock';
  } else {
    stockEl.textContent = 'In Stock';
    stockEl.className = 'pdp-stock-status in-stock';
  }

  btnAdd.addEventListener('click', () => {
    if (product.stock <= 0) {
      if (!Auth.isLoggedIn()) {
        showToast('Please login to request a restock alert.', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
      }

      void (async () => {
        const result = await RestockRequests.toggle(product.id);
        if (!result.success) {
          showToast(result.message || 'Could not update your restock alert.', 'error');
          return;
        }

        restockRequested = !!result.requested;
        syncRestockButtonState();
        showToast(
          restockRequested
            ? `${product.name} will stay on your radar for restock.`
            : `Restock alert removed for ${product.name}.`
        );
      })();
      return;
    }

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
  renderRelatedProducts(product);
  rememberRecentlyViewed(product.id);
  renderRecentlyViewed(product.id);

  // Reviews Logic
  await initSupabaseReviews(product.id);
});

// ===== REVIEWS SYSTEM =====
const ReviewsData = {
  getAll() {
    return [];
  },
  getByProduct() {
    return [];
  },
  addReview() {
    console.warn('Legacy local reviews are disabled. SupabaseReviewsData is the active review source.');
  }
};

function initReviews(productId, productName) {
  void productName;
  return initSupabaseReviews(productId);

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
  return renderSupabaseReviewsList(productId);

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
const ReviewsUIState = {
  sort: 'newest'
};

const SupabaseReviewsData = {
  userNameColumnAvailable: null,
  verifiedPurchaseColumnAvailable: null,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  hasMissingColumnError(error, columnName) {
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return message.includes(columnName.toLowerCase()) && message.includes('column');
  },

  getSelectFields(options = {}) {
    const fields = ['id', 'product_id', 'user_id', 'rating', 'content', 'created_at', 'updated_at'];
    if (options.includeUserName) fields.splice(3, 0, 'user_name');
    if (options.includeVerifiedPurchase) fields.splice(options.includeUserName ? 4 : 3, 0, 'verified_purchase');
    return fields.join(', ');
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
      isOwn,
      verifiedPurchase: !!review.verified_purchase
    };
  },

  async fetchRows(productDbId) {
    const client = this.getClient();
    if (!client || !productDbId) return [];

    const includeUserName = this.userNameColumnAvailable !== false;
    const includeVerifiedPurchase = this.verifiedPurchaseColumnAvailable !== false;

    const initial = await client
      .from('reviews')
      .select(this.getSelectFields({ includeUserName, includeVerifiedPurchase }))
      .eq('product_id', productDbId)
      .order('created_at', { ascending: false });

    if (!initial.error) {
      if (includeUserName) this.userNameColumnAvailable = true;
      if (includeVerifiedPurchase) this.verifiedPurchaseColumnAvailable = true;
      return initial.data || [];
    }

    const missingUserName = includeUserName && this.hasMissingColumnError(initial.error, 'user_name');
    const missingVerifiedPurchase = includeVerifiedPurchase && this.hasMissingColumnError(initial.error, 'verified_purchase');

    if (!missingUserName && !missingVerifiedPurchase) {
      console.error('Failed to load reviews.', initial.error);
      return [];
    }

    if (missingUserName) this.userNameColumnAvailable = false;
    if (missingVerifiedPurchase) this.verifiedPurchaseColumnAvailable = false;

    const fallback = await client
      .from('reviews')
      .select(this.getSelectFields({
        includeUserName: this.userNameColumnAvailable !== false,
        includeVerifiedPurchase: this.verifiedPurchaseColumnAvailable !== false
      }))
      .eq('product_id', productDbId)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      console.error('Failed to load reviews.', fallback.error);
      return [];
    }

    return fallback.data || [];
  },

  async getByProduct(productId) {
    await ProductData.ready();

    const product = ProductData.getById(productId);
    if (!product) return [];

    const rows = await this.fetchRows(product.dbId);
    return rows.map((review) => this.normalizeReview(review));
  },

  async hasVerifiedPurchase(productDbId) {
    const client = this.getClient();
    if (!client || !productDbId || !Auth.isLoggedIn()) return false;

    const { data, error } = await client
      .from('order_items')
      .select('id')
      .eq('product_id', productDbId)
      .limit(1);

    if (error) {
      console.warn('Could not verify purchase status for review.', error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
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

    const verifiedPurchase = await this.hasVerifiedPurchase(product.dbId);

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
    if (this.verifiedPurchaseColumnAvailable !== false) {
      payload.verified_purchase = verifiedPurchase;
    }

    let query = client
      .from('reviews')
      .upsert(payload, { onConflict: 'product_id,user_id' })
      .select(this.getSelectFields({
        includeUserName: this.userNameColumnAvailable !== false,
        includeVerifiedPurchase: this.verifiedPurchaseColumnAvailable !== false
      }));

    let { data, error } = await query.single();

    const missingUserName = this.userNameColumnAvailable !== false && this.hasMissingColumnError(error, 'user_name');
    const missingVerifiedPurchase = this.verifiedPurchaseColumnAvailable !== false && this.hasMissingColumnError(error, 'verified_purchase');

    if (error && (missingUserName || missingVerifiedPurchase)) {
      if (missingUserName) this.userNameColumnAvailable = false;
      if (missingVerifiedPurchase) this.verifiedPurchaseColumnAvailable = false;

      const fallbackPayload = { ...basePayload };
      if (this.userNameColumnAvailable !== false) {
        fallbackPayload.user_name = user.name || 'Suspendre Customer';
      }
      if (this.verifiedPurchaseColumnAvailable !== false) {
        fallbackPayload.verified_purchase = verifiedPurchase;
      }

      const fallback = await client
        .from('reviews')
        .upsert(fallbackPayload, { onConflict: 'product_id,user_id' })
        .select(this.getSelectFields({
          includeUserName: this.userNameColumnAvailable !== false,
          includeVerifiedPurchase: this.verifiedPurchaseColumnAvailable !== false
        }))
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

function sortReviews(reviews, sortValue) {
  const list = [...reviews];
  switch (sortValue) {
    case 'oldest':
      return list.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'highest':
      return list.sort((a, b) => b.rating - a.rating || new Date(b.date) - new Date(a.date));
    case 'lowest':
      return list.sort((a, b) => a.rating - b.rating || new Date(b.date) - new Date(a.date));
    case 'verified':
      return list.sort((a, b) => Number(b.verifiedPurchase) - Number(a.verifiedPurchase) || b.rating - a.rating || new Date(b.date) - new Date(a.date));
    case 'newest':
    default:
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

function updateReviewSummary(reviews) {
  const countEl = document.getElementById('reviewCount');
  const avgStarsEl = document.getElementById('avgStars');
  const avgRatingValueEl = document.getElementById('avgRatingValue');
  const breakdownEl = document.getElementById('reviewsBreakdown');

  if (!countEl || !avgStarsEl || !avgRatingValueEl || !breakdownEl) return;

  countEl.textContent = `${reviews.length} Review${reviews.length !== 1 ? 's' : ''}`;

  if (reviews.length === 0) {
    avgStarsEl.textContent = '\u2605\u2605\u2605\u2605\u2605';
    avgRatingValueEl.textContent = '0.0';
    breakdownEl.querySelectorAll('.review-breakdown-row').forEach((row) => {
      const fill = row.querySelector('.review-breakdown-track span');
      const count = row.querySelector('strong');
      if (fill) fill.style.width = '0%';
      if (count) count.textContent = '0';
    });
    return;
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const average = total / reviews.length;
  const roundedStars = Math.round(average);
  avgStarsEl.textContent = '\u2605'.repeat(roundedStars) + '\u2606'.repeat(5 - roundedStars);
  avgRatingValueEl.textContent = average.toFixed(1);

  const countsByRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((review) => {
    countsByRating[review.rating] = (countsByRating[review.rating] || 0) + 1;
  });

  breakdownEl.querySelectorAll('.review-breakdown-row').forEach((row) => {
    const rating = Number(row.querySelector('span')?.textContent || 0);
    const count = countsByRating[rating] || 0;
    const fill = row.querySelector('.review-breakdown-track span');
    const countLabel = row.querySelector('strong');
    if (fill) fill.style.width = `${(count / reviews.length) * 100}%`;
    if (countLabel) countLabel.textContent = String(count);
  });
}

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
  const sortSelect = document.getElementById('reviewsSort');

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

  if (sortSelect) {
    sortSelect.addEventListener('change', async () => {
      ReviewsUIState.sort = sortSelect.value || 'newest';
      await renderSupabaseReviewsList(productId, (review) => {
        existingUserReview = review;
        syncReviewCta();
      });
    });
  }

  await renderSupabaseReviewsList(productId, (review) => {
    existingUserReview = review;
    syncReviewCta();
  });
  resetFormState();
}

async function renderSupabaseReviewsList(productId, onCurrentUserReviewChange = () => {}) {
  const listEl = document.getElementById('reviewsList');
  const currentUserId = Auth.getCurrentUser()?.id || null;

  listEl.innerHTML = '<p style="color:var(--warm-gray); text-align:center; padding:40px 0;">Loading reviews...</p>';

  const rawReviews = await SupabaseReviewsData.getByProduct(productId);
  const currentUserReview = rawReviews.find((review) => review.userId === currentUserId) || null;
  onCurrentUserReviewChange(currentUserReview);

  updateReviewSummary(rawReviews);

  if (rawReviews.length === 0) {
    listEl.innerHTML = '<p style="color:var(--warm-gray); text-align:center; padding:40px 0;">Be the first to review this piece.</p>';
    return [];
  }

  const reviews = sortReviews(rawReviews, ReviewsUIState.sort);
  listEl.innerHTML = '';
  const safeString = (value) => String(value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  reviews.forEach((review) => {
    const el = document.createElement('div');
    el.className = 'review-item';
    const stars = '\u2605'.repeat(review.rating) + '\u2606'.repeat(5 - review.rating);
    const badges = [
      review.isOwn ? '<span class="review-badge customer-note">Your Review</span>' : '<span class="review-badge customer-note">Customer</span>',
      review.verifiedPurchase ? `
        <span class="review-badge verified-purchase">
          <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.16"></circle>
            <path d="M6.4 10.1 8.7 12.4 13.6 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <span>Verified Purchase</span>
        </span>
      ` : ''
    ].filter(Boolean).join('');

    el.innerHTML = `
      <div class="review-item-header">
        <div class="review-author">
          ${safeString(review.userName)} ${badges}
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
