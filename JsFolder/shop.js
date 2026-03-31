// =========================================
//  SUSPENDRE — Shop Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();

  const grid = document.getElementById('shopGrid');
  const filterCat = document.getElementById('filterCategory');
  const sortBy = document.getElementById('sortBy');
  const countEl = document.getElementById('productCount');
  const searchInput = document.getElementById('searchInput');

  function render() {
    if (!grid) return;
    grid.innerHTML = '';

    let products = ProductData.getAll();

    // Search
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }

    // Filter
    const cat = filterCat ? filterCat.value : 'all';
    if (cat !== 'all') products = products.filter(p => p.category.toLowerCase() === cat.toLowerCase());

    // Sort
    const sort = sortBy ? sortBy.value : 'default';
    if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
    else if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));

    if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

    if (products.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:80px 0;text-align:center;color:var(--warm-gray)">No products found in this category.</div>';
      return;
    }

    products.forEach((product, i) => {
      const card = buildProductCard(product);
      card.style.animation = `fadeIn 0.4s ${i * 0.05}s both`;
      grid.appendChild(card);
    });
  }

  if (filterCat) filterCat.addEventListener('change', render);
  if (sortBy) sortBy.addEventListener('change', render);
  if (searchInput) searchInput.addEventListener('input', render);

  render();
});
