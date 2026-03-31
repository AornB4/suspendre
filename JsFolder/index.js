// =========================================
//  SUSPENDRE — Index Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();

  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  const featured = ProductData.getFeatured().slice(0, 4);

  if (featured.length === 0) {
    grid.innerHTML = '<p style="padding:48px;color:var(--warm-gray)">No featured products available.</p>';
    return;
  }

  featured.forEach((product, i) => {
    const card = buildProductCard(product);
    card.style.animationDelay = `${i * 0.1}s`;
    grid.appendChild(card);
  });
});
