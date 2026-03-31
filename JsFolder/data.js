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
    image: 'images/luxury_HangerV1.png',
    featured: true
  },
  {
    id: 'p002',
    name: 'Aurum Gold Edition',
    category: 'gold',
    price: 890,
    stock: 5,
    description: 'Solid brass core, hand-applied 24K gold leaf finish. A statement for the truly discerning wardrobe.',
    image: 'images/luxury_HangerV2.png',
    featured: true
  },
  {
    id: 'p003',
    name: 'Midnight Velvet',
    category: 'velvet',
    price: 185,
    stock: 22,
    description: 'French silk velvet in deep midnight, hand-stretched over a maple core. Prevents slippage without effort.',
    image: 'images/luxury_HangerV3.png',
    featured: true
  },
  {
    id: 'p004',
    name: 'Chrome Architecte',
    category: 'metal',
    price: 340,
    stock: 10,
    description: 'Brushed 316L surgical steel with geometric precision. Industrial luxury for the modernist.',
    image: 'images/placeholder.svg',
    featured: true
  },
  {
    id: 'p005',
    name: 'Mahogany Heirloom',
    category: 'wood',
    price: 420,
    stock: 8,
    description: 'Aged Cuban mahogany, hand-carved with Art Deco detail. Each piece unique, each piece eternal.',
    image: 'images/luxury_HangerV5.png',
    featured: false
  },
  {
    id: 'p006',
    name: 'Ivory Velours',
    category: 'velvet',
    price: 210,
    stock: 18,
    description: 'Ivory French velvet over lightweight balsa. Pure elegance at a featherweight.',
    image: 'images/luxury_HangerV6.png',
    featured: false
  },
  {
    id: 'p007',
    name: 'Titanium Reserve',
    category: 'metal',
    price: 560,
    stock: 6,
    description: 'Grade 5 aerospace titanium, CNC machined to 0.01mm tolerance. Lighter than air, stronger than time.',
    image: 'images/luxury_HangerV7.png',
    featured: false
  },
  {
    id: 'p008',
    name: 'Rose Gold Atelier',
    category: 'gold',
    price: 740,
    stock: 4,
    description: '18K rose gold plated over solid brass. The most romantic hanger ever conceived.',
    image: 'images/luxury_HangerV8.png',
    featured: false
  },
  {
    id: 'p009',
    name: 'Ebony Noir',
    category: 'wood',
    price: 650,
    stock: 3,
    description: 'African ebony, one of the densest woods on Earth. Hand-oiled to reveal a natural lustre that deepens with age.',
    image: 'images/placeholder.svg',
    featured: false
  },
  {
    id: 'p010',
    name: 'Champagne Velours',
    category: 'velvet',
    price: 195,
    stock: 0,
    description: "Champagne silk velvet. Discontinued colourway — a collector's piece for the true connoisseur.",
    image: 'images/placeholder.svg',
    featured: false
  }
];

const ProductData = {
  STORAGE_KEY: 'suspendre_products',
  cache: [],
  initPromise: null,
  initialized: false,
  source: 'fallback',

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  shouldUseRemoteWrite(options = {}) {
    return !!options.remote && !!this.getClient();
  },

  normalizeImage(image) {
    if (!image || !String(image).trim()) return PLACEHOLDER_IMAGE;
    return String(image).trim();
  },

  slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  },

  normalizeRecord(product) {
    const resolvedId = product.legacy_id || product.id;
    return {
      id: resolvedId,
      dbId: product.id || resolvedId,
      legacyId: product.legacy_id || resolvedId,
      slug: product.slug || '',
      name: product.name || 'Untitled Product',
      category: product.category || 'wood',
      price: Number(product.price) || 0,
      stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
      description: product.description || '',
      image: this.normalizeImage(product.image || product.image_url),
      featured: !!product.featured,
      active: product.active !== false
    };
  },

  normalizeCollection(products) {
    return products.map(product => this.normalizeRecord(product));
  },

  persistCache() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
  },

  loadFallbackProducts() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return this.normalizeCollection(DEFAULT_PRODUCTS);
    }

    try {
      return this.normalizeCollection(JSON.parse(stored));
    } catch (error) {
      console.warn('Failed to parse cached products. Resetting to defaults.', error);
      return this.normalizeCollection(DEFAULT_PRODUCTS);
    }
  },

  async loadFromSupabase() {
    const client = this.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('products')
      .select('id, legacy_id, slug, name, category, price, stock, description, image_url, featured, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load products from Supabase.', error);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return this.normalizeCollection(data);
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const remoteProducts = await this.loadFromSupabase();

      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        this.cache = remoteProducts;
        this.source = 'supabase';
      } else {
        this.cache = this.loadFallbackProducts();
        this.source = 'fallback';
      }

      this.persistCache();
      this.initialized = true;
      return this.getAll();
    })();

    return this.initPromise;
  },

  ready() {
    return this.init();
  },

  async refresh() {
    this.initPromise = null;
    this.initialized = false;
    return this.init();
  },

  getAll() {
    if (!this.initialized && this.cache.length === 0) {
      this.cache = this.loadFallbackProducts();
    }
    return this.cache.map(product => ({ ...product }));
  },

  getFeatured() {
    return this.getAll().filter(product => product.featured);
  },

  getById(id) {
    if (!id) return null;
    const match = this.cache.find(product =>
      product.id === id ||
      product.dbId === id ||
      product.legacyId === id ||
      product.slug === id
    );
    return match ? { ...match } : null;
  },

  async add(product, options = {}) {
    const client = this.getClient();
    if (!this.shouldUseRemoteWrite(options) || !client) {
      const localId = product.id || `local-${Date.now()}`;
      const normalized = this.normalizeRecord({
        ...product,
        id: product.dbId || localId,
        legacy_id: product.legacyId || localId
      });

      this.cache.push(normalized);
      this.persistCache();
      return { success: true, product: { ...normalized } };
    }

    const payload = {
      legacy_id: product.legacyId || product.id || null,
      slug: this.slugify(product.slug || product.name),
      name: product.name,
      category: product.category,
      price: Number(product.price),
      stock: Number(product.stock),
      description: product.description,
      image_url: this.normalizeImage(product.image),
      featured: !!product.featured,
      active: true
    };

    const { data, error } = await client
      .from('products')
      .insert(payload)
      .select('id, legacy_id, slug, name, category, price, stock, description, image_url, featured, active, created_at')
      .single();

    if (error) {
      return { success: false, message: error.message, error };
    }

    const normalized = this.normalizeRecord(data);
    this.cache.push(normalized);
    this.persistCache();
    await this.refresh();
    return { success: true, product: { ...this.getById(normalized.id) } };
  },

  async update(id, updates, options = {}) {
    const index = this.cache.findIndex(product =>
      product.id === id || product.dbId === id || product.legacyId === id
    );

    if (index === -1) return { success: false, message: 'Product not found.' };

    const existing = this.cache[index];
    const client = this.getClient();

    if (!this.shouldUseRemoteWrite(options) || !client) {
      const merged = this.normalizeRecord({
        ...existing,
        ...updates,
        id: existing.dbId,
        legacy_id: existing.legacyId
      });

      this.cache[index] = merged;
      this.persistCache();
      return { success: true, product: { ...merged } };
    }

    const payload = {
      slug: this.slugify(updates.slug || updates.name || existing.slug || existing.name),
      name: updates.name ?? existing.name,
      category: updates.category ?? existing.category,
      price: Number(updates.price ?? existing.price),
      stock: Number(updates.stock ?? existing.stock),
      description: updates.description ?? existing.description,
      image_url: this.normalizeImage(updates.image ?? existing.image),
      featured: typeof updates.featured === 'boolean' ? updates.featured : existing.featured
    };

    const { data, error } = await client
      .from('products')
      .update(payload)
      .eq('id', existing.dbId)
      .select('id, legacy_id, slug, name, category, price, stock, description, image_url, featured, active, created_at')
      .single();

    if (error) {
      return { success: false, message: error.message, error };
    }

    this.cache[index] = this.normalizeRecord(data);
    this.persistCache();
    await this.refresh();
    return { success: true, product: { ...this.getById(existing.id) } };
  },

  async delete(id, options = {}) {
    const product = this.getById(id);
    if (!product) return { success: false, message: 'Product not found.' };

    const client = this.getClient();
    if (!this.shouldUseRemoteWrite(options) || !client) {
      this.cache = this.cache.filter(entry =>
        entry.id !== id && entry.dbId !== id && entry.legacyId !== id
      );
      this.persistCache();
      return { success: true };
    }

    const { error } = await client
      .from('products')
      .update({ active: false })
      .eq('id', product.dbId);

    if (error) {
      return { success: false, message: error.message, error };
    }

    this.cache = this.cache.filter(entry =>
      entry.id !== id && entry.dbId !== id && entry.legacyId !== id
    );
    this.persistCache();
    await this.refresh();
    return { success: true };
  },

  decrementStock(id, qty = 1) {
    const product = this.getById(id);
    if (!product) return;
    this.update(id, { stock: Math.max(0, product.stock - qty) });
  },

  getImageSrc(product) {
    return product && product.image && product.image.trim() !== ''
      ? product.image
      : PLACEHOLDER_IMAGE;
  }
};

void ProductData.init();
