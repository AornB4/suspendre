// =========================================
//  SUSPENDRE — Product Data
//  Images live in: ./images/
//  Naming: lowercase, hyphens, e.g. walnut-prestige.jpg
// =========================================

const PLACEHOLDER_IMAGE = './images/placeholder.svg';

const DEFAULT_PRODUCTS = [
  {
    id: 'p001',
    name: 'Walnut Prestige',
    category: 'wood',
    price: 289,
    stock: 15,
    description: 'Single-origin black walnut, hand-planed and finished with cold-pressed linseed oil. The grain speaks.',
    image: './images/luxury_HangerV1.png',
    featured: true
  },
  {
    id: 'p002',
    name: 'Aurum Gold Edition',
    category: 'gold',
    price: 890,
    stock: 5,
    description: 'Solid brass core, hand-applied 24K gold leaf finish. A statement for the truly discerning wardrobe.',
    image: './images/luxury_HangerV2.png',
    featured: true
  },
  {
    id: 'p003',
    name: 'Midnight Velvet',
    category: 'velvet',
    price: 185,
    stock: 22,
    description: 'French silk velvet in deep midnight, hand-stretched over a maple core. Prevents slippage without effort.',
    image: './images/luxury_HangerV3.png',
    featured: true
  },
  {
    id: 'p004',
    name: 'Chrome Architecte',
    category: 'metal',
    price: 340,
    stock: 10,
    description: 'Brushed 316L surgical steel with geometric precision. Industrial luxury for the modernist.',
    image: './images/chrome-architecte.jpg',
    featured: true
  },
  {
    id: 'p005',
    name: 'Mahogany Heirloom',
    category: 'wood',
    price: 420,
    stock: 8,
    description: 'Aged Cuban mahogany, hand-carved with Art Deco detail. Each piece unique, each piece eternal.',
    image: './images/luxury_HangerV5.png',
    featured: false
  },
  {
    id: 'p006',
    name: 'Ivory Velours',
    category: 'velvet',
    price: 210,
    stock: 18,
    description: 'Ivory French velvet over lightweight balsa. Pure elegance at a featherweight.',
    image: './images/luxury_HangerV6.png',
    featured: false
  },
  {
    id: 'p007',
    name: 'Titanium Reserve',
    category: 'metal',
    price: 560,
    stock: 6,
    description: 'Grade 5 aerospace titanium, CNC machined to 0.01mm tolerance. Lighter than air, stronger than time.',
    image: './images/luxury_HangerV7.png',
    featured: false
  },
  {
    id: 'p008',
    name: 'Rose Gold Atelier',
    category: 'gold',
    price: 740,
    stock: 4,
    description: '18K rose gold plated over solid brass. The most romantic hanger ever conceived.',
    image: './images/luxury_HangerV8.png',
    featured: false
  },
  {
    id: 'p009',
    name: 'Ebony Noir',
    category: 'wood',
    price: 650,
    stock: 3,
    description: 'African ebony, one of the densest woods on Earth. Hand-oiled to reveal a natural lustre that deepens with age.',
    image: './images/ebony-noir.jpg',
    featured: false
  },
  {
    id: 'p010',
    name: 'Champagne Velours',
    category: 'velvet',
    price: 195,
    stock: 0,
    description: "Champagne silk velvet. Discontinued colourway — a collector's piece for the true connoisseur.",
    image: './images/champagne-velours.jpg',
    featured: false
  }
];

const ProductData = {
  STORAGE_KEY: 'suspendre_products',

  init() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      // First visit — seed from DEFAULT_PRODUCTS
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    } else {
      // Already visited — sync image paths from DEFAULT_PRODUCTS so local
      // file changes in data.js always take effect (fixes stale URL caching)
      const products = JSON.parse(stored);
      let changed = false;
      DEFAULT_PRODUCTS.forEach(def => {
        const p = products.find(x => x.id === def.id);
        if (p && p.image !== def.image) {
          p.image = def.image;
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
      }
    }
  },

  getAll() {
    this.init();
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
  },

  getFeatured() {
    return this.getAll().filter(p => p.featured);
  },

  getById(id) {
    return this.getAll().find(p => p.id === id);
  },

  add(product) {
    const products = this.getAll();
    product.id = 'p' + Date.now();
    products.push(product);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
    return product;
  },

  update(id, updates) {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
    return products[idx];
  },

  delete(id) {
    const products = this.getAll().filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
  },

  decrementStock(id, qty = 1) {
    const product = this.getById(id);
    if (product) {
      this.update(id, { stock: Math.max(0, product.stock - qty) });
    }
  },

  // Returns the image src — falls back to placeholder if image is empty/missing
  getImageSrc(product) {
    return (product && product.image && product.image.trim() !== '')
      ? product.image
      : PLACEHOLDER_IMAGE;
  }
};
