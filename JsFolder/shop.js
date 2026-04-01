// =========================================
//  SUSPENDRE — Shop Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();

  const grid = document.getElementById('shopGrid');
  const sortBy = document.getElementById('sortBy');
  const countEl = document.getElementById('productCount');
  const searchInput = document.getElementById('searchInput');
  const availabilityFilter = document.getElementById('availabilityFilter');
  const priceFilter = document.getElementById('priceFilter');
  const activeSummary = document.getElementById('activeSummary');
  const clearBtn = document.getElementById('clearDiscoveryBtn');
  const categoryButtons = Array.from(document.querySelectorAll('.filter-chip[data-category]'));

  const discoveryState = {
    category: 'all',
    availability: 'all',
    price: 'all',
    sort: sortBy ? sortBy.value : 'curated',
    query: ''
  };

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getSearchTokens(query) {
    return normalizeText(query)
      .split(' ')
      .filter(token => token.length > 1);
  }

  function scoreProduct(product, tokens, rawQuery) {
    if (!tokens.length && !rawQuery) return 0;

    const haystacks = {
      name: normalizeText(product.name),
      description: normalizeText(product.description),
      category: normalizeText(product.category)
    };

    let score = 0;
    tokens.forEach(token => {
      if (haystacks.name.includes(token)) score += 14;
      if (haystacks.description.includes(token)) score += 6;
      if (haystacks.category.includes(token)) score += 10;
    });

    if (rawQuery && haystacks.name.includes(rawQuery)) score += 18;
    if (product.featured) score += 2;
    if (product.stock > 0) score += 2;

    return score;
  }

  function matchesAvailability(product, availability) {
    if (availability === 'all') return true;
    if (availability === 'in-stock') return product.stock > 0;
    if (availability === 'low-stock') return product.stock > 0 && product.stock <= 3;
    if (availability === 'sold-out') return product.stock === 0;
    return true;
  }

  function matchesPrice(product, priceBand) {
    if (priceBand === 'all') return true;
    if (priceBand === 'under-250') return product.price < 250;
    if (priceBand === '250-500') return product.price >= 250 && product.price <= 500;
    if (priceBand === 'over-500') return product.price > 500;
    return true;
  }

  function summarizeState(total) {
    const fragments = [];

    if (discoveryState.category !== 'all') {
      fragments.push(`${discoveryState.category} pieces`);
    }

    if (discoveryState.availability === 'in-stock') {
      fragments.push('currently in stock');
    } else if (discoveryState.availability === 'low-stock') {
      fragments.push('rare low-stock pieces');
    } else if (discoveryState.availability === 'sold-out') {
      fragments.push('archived sold-out pieces');
    }

    if (discoveryState.price === 'under-250') {
      fragments.push('under $250');
    } else if (discoveryState.price === '250-500') {
      fragments.push('$250 to $500');
    } else if (discoveryState.price === 'over-500') {
      fragments.push('above $500');
    }

    if (discoveryState.query) {
      fragments.push(`matching "${discoveryState.query}"`);
    }

    if (!fragments.length) {
      return 'Showing the full Suspendre collection.';
    }

    return `Showing ${total} refined result${total !== 1 ? 's' : ''} for ${fragments.join(' · ')}.`;
  }

  function renderEmptyState() {
    if (!grid) return;
    grid.innerHTML = `
      <div class="shop-empty-state">
        <h3>No pieces matched this curation.</h3>
        <p>Try a broader search, another material, or reset the filters to rediscover the full collection.</p>
        <button type="button" class="shop-clear-btn" id="emptyStateReset">Reset Discovery</button>
      </div>
    `;

    const resetBtn = document.getElementById('emptyStateReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }
  }

  function resetFilters() {
    discoveryState.category = 'all';
    discoveryState.availability = 'all';
    discoveryState.price = 'all';
    discoveryState.sort = 'curated';
    discoveryState.query = '';

    if (searchInput) searchInput.value = '';
    if (availabilityFilter) availabilityFilter.value = 'all';
    if (priceFilter) priceFilter.value = 'all';
    if (sortBy) sortBy.value = 'curated';

    categoryButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.category === 'all');
    });

    render();
  }

  function render() {
    if (!grid) return;

    const allProducts = ProductData.getAll();
    const rawQuery = normalizeText(discoveryState.query);
    const tokens = getSearchTokens(discoveryState.query);

    let products = allProducts
      .map(product => ({
        ...product,
        searchScore: scoreProduct(product, tokens, rawQuery)
      }))
      .filter(product => {
        if (discoveryState.category !== 'all' && product.category !== discoveryState.category) return false;
        if (!matchesAvailability(product, discoveryState.availability)) return false;
        if (!matchesPrice(product, discoveryState.price)) return false;
        if (rawQuery && product.searchScore <= 0) return false;
        return true;
      });

    const sort = rawQuery && discoveryState.sort === 'curated'
      ? 'relevance'
      : discoveryState.sort;

    if (sort === 'relevance') {
      products.sort((a, b) => b.searchScore - a.searchScore || Number(b.featured) - Number(a.featured) || a.price - b.price);
    } else if (sort === 'price-asc') {
      products.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    } else if (sort === 'price-desc') {
      products.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    } else if (sort === 'name') {
      products.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'stock-desc') {
      products.sort((a, b) => b.stock - a.stock || a.price - b.price);
    } else {
      products.sort((a, b) =>
        Number(b.featured) - Number(a.featured) ||
        Number(b.stock > 0) - Number(a.stock > 0) ||
        a.price - b.price ||
        a.name.localeCompare(b.name)
      );
    }

    if (countEl) {
      countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
    }

    if (activeSummary) {
      activeSummary.textContent = summarizeState(products.length);
    }

    grid.innerHTML = '';

    if (products.length === 0) {
      renderEmptyState();
      return;
    }

    products.forEach((product, index) => {
      const card = buildProductCard(product);
      card.style.animation = `fadeIn 0.4s ${index * 0.05}s both`;
      grid.appendChild(card);
    });
  }

  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      discoveryState.category = button.dataset.category || 'all';
      categoryButtons.forEach(entry => {
        entry.classList.toggle('active', entry === button);
      });
      render();
    });
  });

  if (sortBy) {
    sortBy.addEventListener('change', () => {
      discoveryState.sort = sortBy.value;
      render();
    });
  }

  if (availabilityFilter) {
    availabilityFilter.addEventListener('change', () => {
      discoveryState.availability = availabilityFilter.value;
      render();
    });
  }

  if (priceFilter) {
    priceFilter.addEventListener('change', () => {
      discoveryState.price = priceFilter.value;
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      discoveryState.query = searchInput.value.trim();
      if (!discoveryState.query && discoveryState.sort === 'relevance' && sortBy) {
        discoveryState.sort = 'curated';
        sortBy.value = 'curated';
      }
      render();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', resetFilters);
  }

  render();
});
