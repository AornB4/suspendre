// =========================================
//  SUSPENDRE - Atelier Chatbot Shell
// =========================================

(function () {
  const FALLBACK_FAQS = [
    {
      question: 'What materials do you offer?',
      answer: 'Suspendre offers luxury hangers in wood, metal, velvet, and gold-accented finishes. Each material is selected for both structure and presentation, so garments are stored beautifully while maintaining their shape.',
      category: 'products'
    },
    {
      question: 'Which hanger is best for suits, coats, or structured garments?',
      answer: 'For suits, coats, jackets, and tailored pieces, Atelier usually recommends our structured wood or premium metal hangers. They provide stronger shoulder support and help preserve a garment silhouette over time.',
      category: 'products'
    },
    {
      question: 'Which hanger is best for delicate garments like silk or satin?',
      answer: 'For silk, satin, slip dresses, and delicate fabrics, our velvet styles are ideal. They help prevent slipping while remaining gentle on lighter garments.',
      category: 'products'
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes. International shipping can be made available depending on destination, with timelines and fees varying by location and order size.',
      category: 'shipping'
    },
    {
      question: 'How long does order processing take?',
      answer: 'Orders are typically prepared within 1 to 3 business days before dispatch. During high-volume periods, processing may take slightly longer.',
      category: 'orders'
    },
    {
      question: 'Can I return my order?',
      answer: 'Returns may be accepted within a limited return window, provided the item is unused and in its original condition. Return approval may depend on the nature of the item and its packaging.',
      category: 'returns'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'Suspendre currently supports secure checkout with the payment methods shown at checkout, including PayPal where enabled.',
      category: 'payments'
    }
  ];

  const PAGE_META = {
    'index.html': {
      label: 'Homepage',
      promptLabel: 'Ask about the collection'
    },
    'shop.html': {
      label: 'Shop Page',
      promptLabel: 'Ask for a recommendation'
    },
    'product.html': {
      label: 'Product Page',
      promptLabel: 'Ask about this piece'
    },
    'cart.html': {
      label: 'Cart',
      promptLabel: 'Ask before checkout'
    },
    'account.html': {
      label: 'Account',
      promptLabel: 'Ask about orders or care'
    }
  };

  const Atelier = {
    shell: null,
    elements: {},
    context: null,
    faqs: [],
    messages: [],
    isOpen: false,
    typingTimer: null,

    async init() {
      if (this.shell) return;

      await Promise.allSettled([
        window.Auth && typeof Auth.ready === 'function' ? Auth.ready() : Promise.resolve(),
        window.ProductData && typeof ProductData.ready === 'function' ? ProductData.ready() : Promise.resolve()
      ]);

      this.context = this.buildContext();
      this.faqs = await this.loadFaqs();
      this.render();
      this.bindEvents();
      this.seedConversation();
    },

    buildContext() {
      const pathname = window.location.pathname.split('/').pop() || 'index.html';
      const pageType = PAGE_META[pathname] ? pathname : 'index.html';
      const params = new URLSearchParams(window.location.search);
      const currentProductId = params.get('id');
      const currentProduct = currentProductId && window.ProductData
        ? ProductData.getById(currentProductId)
        : null;
      const cartItems = window.Cart ? Cart.getItems() : [];
      const cartProducts = cartItems
        .map(item => {
          const product = window.ProductData ? ProductData.getById(item.productId) : null;
          return product ? { ...product, qty: item.qty } : null;
        })
        .filter(Boolean);

      return {
        pageType,
        pageMeta: PAGE_META[pageType] || PAGE_META['index.html'],
        currentProduct,
        cartProducts
      };
    },

    async loadFaqs() {
      const db = window.SUSPENDRE_SUPABASE;
      if (!db || !db.isConfigured()) return FALLBACK_FAQS.slice();

      try {
        const client = db.getClient();
        const { data, error } = await client
          .from('faqs')
          .select('question, answer, category')
          .eq('active', true)
          .order('display_order', { ascending: true });

        if (error || !Array.isArray(data) || data.length === 0) {
          return FALLBACK_FAQS.slice();
        }

        return data;
      } catch (error) {
        console.warn('Atelier could not load FAQs. Falling back to local copy.', error);
        return FALLBACK_FAQS.slice();
      }
    },

    render() {
      this.shell = document.createElement('section');
      this.shell.className = 'atelier-shell';
      this.shell.setAttribute('aria-label', 'Atelier chat assistant');
      this.shell.innerHTML = `
        <div class="atelier-backdrop" data-close-chat></div>
        <button class="atelier-launcher" type="button" aria-expanded="false" aria-controls="atelierPanel">
          <span class="atelier-launcher-icon">A</span>
          <span class="atelier-launcher-copy">
            <strong>Atelier</strong>
            <span>${this.context.pageMeta.promptLabel}</span>
          </span>
        </button>
        <aside class="atelier-panel" id="atelierPanel" aria-hidden="true">
          <header class="atelier-header">
            <div class="atelier-branding">
              <div class="atelier-avatar">A</div>
              <div>
                <div class="atelier-title">Atelier</div>
                <p class="atelier-subtitle">Suspendre shopping concierge</p>
                <div class="atelier-status">Warm luxury guidance</div>
              </div>
            </div>
            <button class="atelier-close" type="button" aria-label="Close Atelier">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
                <path d="M18 6L6 18"></path>
                <path d="M6 6l12 12"></path>
              </svg>
            </button>
          </header>
          <div class="atelier-context" id="atelierContext"></div>
          <div class="atelier-messages" id="atelierMessages" aria-live="polite"></div>
          <div class="atelier-composer">
            <div class="atelier-prompts" id="atelierPrompts"></div>
            <div class="atelier-input-wrap">
              <textarea class="atelier-input" id="atelierInput" rows="1" placeholder="Ask Atelier for a recommendation, comparison, or store guidance."></textarea>
              <button class="atelier-send" id="atelierSend" type="button" aria-label="Send message">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                </svg>
              </button>
            </div>
            <p class="atelier-footer-note">Atelier can guide product discovery, compare finishes, and answer store questions from the current Suspendre catalog.</p>
          </div>
        </aside>
      `;

      document.body.appendChild(this.shell);

      this.elements.launcher = this.shell.querySelector('.atelier-launcher');
      this.elements.panel = this.shell.querySelector('.atelier-panel');
      this.elements.messages = this.shell.querySelector('#atelierMessages');
      this.elements.prompts = this.shell.querySelector('#atelierPrompts');
      this.elements.input = this.shell.querySelector('#atelierInput');
      this.elements.send = this.shell.querySelector('#atelierSend');
      this.elements.close = this.shell.querySelector('.atelier-close');
      this.elements.context = this.shell.querySelector('#atelierContext');
      this.elements.backdrop = this.shell.querySelector('.atelier-backdrop');

      this.renderContextCard();
      this.renderPrompts(this.getPromptSet());
    },

    bindEvents() {
      this.elements.launcher.addEventListener('click', () => this.open());
      this.elements.close.addEventListener('click', () => this.close());
      this.elements.backdrop.addEventListener('click', () => this.close());
      this.elements.send.addEventListener('click', () => this.handleSubmit());
      this.elements.input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          this.handleSubmit();
        }
      });
      this.elements.input.addEventListener('input', () => this.autoResizeInput());
      this.elements.prompts.addEventListener('click', event => {
        const button = event.target.closest('[data-prompt]');
        if (!button) return;
        this.sendMessage(button.getAttribute('data-prompt'));
      });
      this.elements.messages.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.getAttribute('data-action');
        const productId = button.getAttribute('data-product-id');

        if (action === 'view-product' && productId) {
          window.location.href = `product.html?id=${productId}`;
          return;
        }

        if (action === 'add-cart' && productId) {
          const success = window.Cart ? Cart.addItem(productId) : false;
          if (success) {
            if (typeof showToast === 'function') {
              showToast('Added to cart.', 'success');
            }
            button.textContent = 'Added';
            button.disabled = true;
          } else if (typeof showToast === 'function') {
            showToast('Could not add that piece right now.', 'error');
          }
        }
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    },

    seedConversation() {
      const opening = this.getOpeningMessage();
      this.pushMessage('assistant', opening.text, opening);
    },

    getOpeningMessage() {
      const user = window.Auth && typeof Auth.getCurrentUser === 'function'
        ? Auth.getCurrentUser()
        : null;

      if (this.context.currentProduct) {
        return {
          text: `${user ? `${user.name || 'Welcome back'}, ` : ''}I am Atelier. I can help you decide whether ${this.context.currentProduct.name} is the right piece, compare it with similar finishes, or answer shipping and care questions.`,
          cards: [this.context.currentProduct]
        };
      }

      if (this.context.pageType === 'cart.html' && this.context.cartProducts.length > 0) {
        return {
          text: `${user ? `${user.name || 'Welcome back'}, ` : ''}I can review what is already in your cart, suggest complementary pieces, or answer checkout questions before you complete your order.`,
          cards: this.context.cartProducts.slice(0, 2)
        };
      }

      if (this.context.pageType === 'account.html') {
        return {
          text: `${user ? `${user.name || 'Welcome back'}, ` : ''}I can help with product care, future recommendations, or store policy questions while you review your account.`,
          cards: this.getFeaturedProducts(2)
        };
      }

      return {
        text: `${user ? `${user.name || 'Welcome back'}, ` : ''}I am Atelier, your Suspendre concierge. Tell me what you are shopping for and I will narrow the collection, compare finishes, or answer delivery and returns questions.`,
        cards: this.getFeaturedProducts(2)
      };
    },

    getPromptSet() {
      const basePrompts = [
        'Recommend a hanger',
        'Compare two products',
        'Shipping and returns'
      ];

      if (this.context.currentProduct) {
        return [
          'Is this good for coats?',
          'Compare this with velvet',
          'Is this item in stock?'
        ];
      }

      if (this.context.pageType === 'cart.html') {
        return [
          'Review my cart',
          'What pairs well with this?',
          'Help before checkout'
        ];
      }

      if (this.context.pageType === 'account.html') {
        return [
          'Recommend something new',
          'How should I care for wood hangers?',
          'When do sold out items return?'
        ];
      }

      return basePrompts;
    },

    renderPrompts(prompts) {
      this.elements.prompts.innerHTML = prompts
        .map(prompt => `<button class="atelier-prompt" type="button" data-prompt="${this.escape(prompt)}">${this.escape(prompt)}</button>`)
        .join('');
    },

    renderContextCard() {
      const product = this.context.currentProduct;
      this.elements.context.classList.remove('is-empty', 'is-compact');

      if (product) {
        this.elements.context.innerHTML = `
          <div class="atelier-context-compact">
            <span class="atelier-context-dot" aria-hidden="true"></span>
            <span><strong>Viewing ${this.escape(product.name)}</strong> · ${this.escape(this.buildStockCopy(product))}</span>
          </div>
        `;
        this.elements.context.classList.add('is-compact');
        return;
      }

      if (this.context.pageType === 'cart.html' && this.context.cartProducts.length > 0) {
        this.elements.context.innerHTML = `
          <div class="atelier-context-compact">
            <span class="atelier-context-dot" aria-hidden="true"></span>
            <span><strong>Cart in view</strong> · ${this.context.cartProducts.length} item${this.context.cartProducts.length === 1 ? '' : 's'} ready for review</span>
          </div>
        `;
        this.elements.context.classList.add('is-compact');
        return;
      }

      this.elements.context.innerHTML = '';
      this.elements.context.classList.add('is-empty');
    },

    autoResizeInput() {
      const input = this.elements.input;
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    },

    open() {
      this.isOpen = true;
      this.shell.classList.add('open');
      this.elements.launcher.setAttribute('aria-expanded', 'true');
      this.elements.panel.setAttribute('aria-hidden', 'false');
      document.body.classList.add('atelier-open');
      window.setTimeout(() => {
        this.elements.input.focus();
      }, 160);
    },

    close() {
      this.isOpen = false;
      this.shell.classList.remove('open');
      this.elements.launcher.setAttribute('aria-expanded', 'false');
      this.elements.panel.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('atelier-open');
    },

    handleSubmit() {
      const value = this.elements.input.value.trim();
      if (!value) return;
      this.elements.input.value = '';
      this.autoResizeInput();
      this.sendMessage(value);
    },

    sendMessage(text) {
      this.open();
      this.pushMessage('user', text);
      this.showTyping();

      window.clearTimeout(this.typingTimer);
      this.typingTimer = window.setTimeout(async () => {
        const response = await this.invokeAssistant(text);
        this.hideTyping();
        this.pushMessage('assistant', response.text, response);
        this.renderPrompts(response.prompts || this.getPromptSet());
      }, 520);
    },

    showTyping() {
      const typingId = 'atelier-typing-row';
      const existing = document.getElementById(typingId);
      if (existing) return;

      const row = document.createElement('div');
      row.className = 'atelier-message assistant';
      row.id = typingId;
      row.innerHTML = `
        <div class="atelier-message-meta">Atelier</div>
        <div class="atelier-bubble">
          <div class="atelier-typing" aria-label="Atelier is typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
      this.elements.messages.appendChild(row);
      this.scrollMessages();
    },

    hideTyping() {
      const row = document.getElementById('atelier-typing-row');
      if (row) row.remove();
    },

    pushMessage(role, text, extras = {}) {
      this.messages.push({ role, text, extras });
      const message = document.createElement('div');
      message.className = `atelier-message ${role}`;

      const metaLabel = role === 'assistant' ? 'Atelier' : 'You';
      message.innerHTML = `
        <div class="atelier-message-meta">${metaLabel}</div>
        <div class="atelier-bubble">${this.escape(text)}</div>
      `;

      if (role === 'assistant' && Array.isArray(extras.cards) && extras.cards.length > 0) {
        const cards = document.createElement('div');
        cards.className = 'atelier-product-cards';
        extras.cards.forEach(product => {
          cards.appendChild(this.buildProductCard(product));
        });
        message.appendChild(cards);
      }

      this.elements.messages.appendChild(message);
      this.scrollMessages();
    },

    buildProductCard(product) {
      const card = document.createElement('article');
      card.className = 'atelier-product-card';
      const image = this.getProductImage(product);
      const outOfStock = Number(product.stock) <= 0;

      card.innerHTML = `
        <div class="atelier-product-image">
          <img src="${this.escape(image)}" alt="${this.escape(product.name)}" loading="lazy">
        </div>
        <div class="atelier-product-body">
          <div class="atelier-product-category">${this.escape(product.category)}</div>
          <div class="atelier-product-name">${this.escape(product.name)}</div>
          <p class="atelier-product-copy">${this.escape(product.description || 'A refined Suspendre piece.')}</p>
          <div class="atelier-product-meta">
            <div class="atelier-product-price">${typeof formatPrice === 'function' ? formatPrice(Number(product.price) || 0) : `$${Number(product.price || 0).toFixed(2)}`}</div>
            <div class="atelier-product-stock">${this.escape(this.buildStockCopy(product))}</div>
          </div>
          <div class="atelier-product-actions">
            <button class="atelier-card-btn secondary" type="button" data-action="view-product" data-product-id="${this.escape(product.id)}">View Product</button>
            <button class="atelier-card-btn primary" type="button" data-action="add-cart" data-product-id="${this.escape(product.id)}" ${outOfStock ? 'disabled' : ''}>
              ${outOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
          </div>
        </div>
      `;

      return card;
    },

    async invokeAssistant(message) {
      const db = window.SUSPENDRE_SUPABASE;
      if (!db || !db.isConfigured()) {
        return this.resolveResponse(message);
      }

      try {
        const client = db.getClient();
        const { data, error } = await client.functions.invoke('atelier-chat', {
          body: {
            message,
            page: {
              type: this.context.pageType,
              productId: this.context.currentProduct ? this.context.currentProduct.id : null
            },
            cart: this.context.cartProducts.map(item => ({
              productId: item.id,
              qty: item.qty || 1
            }))
          }
        });

        if (error) {
          throw error;
        }

        if (!data || typeof data.answer !== 'string') {
          throw new Error('Atelier returned an invalid response.');
        }

        return {
          text: data.answer,
          cards: Array.isArray(data.products) ? data.products : [],
          prompts: Array.isArray(data.prompts) && data.prompts.length > 0
            ? data.prompts
            : this.getPromptSet()
        };
      } catch (error) {
        if (error && error.context && typeof error.context.text === 'function') {
          try {
            const details = await error.context.text();
            console.warn('Atelier AI fallback engaged.', error, details);
          } catch (contextError) {
            console.warn('Atelier AI fallback engaged.', error, contextError);
          }
        } else {
          console.warn('Atelier AI fallback engaged.', error);
        }
        return this.resolveResponse(message);
      }
    },

    resolveResponse(message) {
      const text = String(message || '').trim();
      const lowered = text.toLowerCase();
      const mentionedProducts = this.findProductsInMessage(lowered);
      const faqMatch = this.findFaqMatch(lowered);

      if (this.isComparisonPrompt(lowered, mentionedProducts)) {
        return this.buildComparisonResponse(mentionedProducts, lowered);
      }

      if (this.isCurrentProductPrompt(lowered) && this.context.currentProduct) {
        return this.buildCurrentProductResponse(lowered);
      }

      if (this.isCartPrompt(lowered) && this.context.cartProducts.length > 0) {
        return this.buildCartResponse();
      }

      if (faqMatch) {
        return {
          text: faqMatch.answer,
          cards: this.context.currentProduct ? [this.context.currentProduct] : [],
          prompts: ['Recommend a hanger', 'Compare two products', 'What is best for delicate fabrics?']
        };
      }

      if (this.isRecommendationPrompt(lowered)) {
        return this.buildRecommendationResponse(lowered, mentionedProducts);
      }

      if (mentionedProducts.length === 1) {
        return this.buildSingleProductResponse(mentionedProducts[0]);
      }

      return {
        text: 'I can help in three useful ways right now: recommend the right Suspendre piece for a garment type, compare finishes across the collection, or answer shipping, returns, and care questions.',
        cards: this.context.currentProduct ? [this.context.currentProduct] : this.getFeaturedProducts(2),
        prompts: ['Recommend a hanger', 'Compare two products', 'Shipping and returns']
      };
    },

    isComparisonPrompt(lowered, mentionedProducts) {
      return mentionedProducts.length >= 2 || lowered.includes('compare') || lowered.includes('vs') || lowered.includes('versus');
    },

    isRecommendationPrompt(lowered) {
      return ['recommend', 'best', 'suggest', 'gift', 'need', 'looking for', 'choose'].some(term => lowered.includes(term));
    },

    isCurrentProductPrompt(lowered) {
      return ['this', 'current', 'in stock', 'available', 'worth it', 'good for', 'best for'].some(term => lowered.includes(term));
    },

    isCartPrompt(lowered) {
      return ['cart', 'checkout', 'buy again', 'pair', 'match what i added', 'before checkout'].some(term => lowered.includes(term));
    },

    buildRecommendationResponse(lowered, mentionedProducts) {
      if (mentionedProducts.length >= 1) {
        return {
          text: `If you are already considering ${mentionedProducts[0].name}, I would pair it with a second option that serves a different wardrobe need so you can compare structure, finish, and feel side by side.`,
          cards: [mentionedProducts[0]].concat(this.getRelatedProducts(mentionedProducts[0], 1)),
          prompts: ['Compare two products', 'Is this item in stock?', 'Shipping and returns']
        };
      }

      const category = this.inferCategoryFromMessage(lowered);
      const recommended = category
        ? this.getProductsByCategory(category, 2)
        : this.getFeaturedProducts(2);

      const copyByCategory = {
        wood: 'For tailored jackets, suits, and heavier pieces, I would start with our wood silhouettes because they offer elegant shoulder structure and a more heritage feel.',
        metal: 'For a sharper, more architectural look, our metal pieces are ideal. They feel especially strong for structured garments and modern wardrobes.',
        velvet: 'For silk, satin, and delicate fabrics, I would guide you toward velvet. It keeps garments from slipping while staying gentle on lighter materials.',
        gold: 'If the goal is display, gifting, or a statement wardrobe moment, the gold-accented collection offers the most dramatic finish.'
      };

      return {
        text: copyByCategory[category] || 'To begin, I would show you a pair of Suspendre signatures that balance structure, finish, and everyday elegance. From there I can refine the recommendation around coats, dresses, tailoring, or gifting.',
        cards: recommended,
        prompts: ['What is best for coats?', 'What is best for delicate fabrics?', 'Compare two products']
      };
    },

    buildComparisonResponse(products, lowered) {
      let chosen = products.length >= 2
        ? products.slice(0, 2)
        : this.context.currentProduct
          ? [this.context.currentProduct].concat(this.getRelatedProducts(this.context.currentProduct, 1))
          : this.getFeaturedProducts(2);

      const requestedCategory = this.inferCategoryFromMessage(lowered);
      if (this.context.currentProduct && requestedCategory && this.context.currentProduct.category !== requestedCategory) {
        const categoryMatch = this.getProductsByCategory(requestedCategory, 1)
          .find(product => product.id !== this.context.currentProduct.id);
        if (categoryMatch) {
          chosen = [this.context.currentProduct, categoryMatch];
        }
      }

      const first = chosen[0];
      const second = chosen[1];

      if (!first || !second) {
        return {
          text: 'I can compare any two pieces once you mention them by name. For example, ask me to compare Walnut Prestige and Mahogany Heirloom.',
          cards: this.getFeaturedProducts(2),
          prompts: ['Compare Walnut Prestige and Mahogany Heirloom', 'Compare this with velvet', 'Recommend a hanger']
        };
      }

      return {
        text: `${first.name} feels more ${this.describeCategory(first.category)}, while ${second.name} leans ${this.describeCategory(second.category)}. If you want stronger shoulder structure, start with the ${first.category === 'velvet' ? second.name : first.name}. If slip resistance or softness matters more, ${first.category === 'velvet' ? first.name : second.name} is the better fit.`,
        cards: chosen,
        prompts: ['Which is better for suits?', 'Which is better for silk?', 'Show me another option']
      };
    },

    buildCurrentProductResponse(lowered) {
      const product = this.context.currentProduct;
      const garmentIntent = this.inferGarmentIntent(lowered);
      const suitability = this.describeSuitability(product, garmentIntent);

      return {
        text: `${product.name} is ${suitability} It is currently ${product.stock > 0 ? `available with ${product.stock} piece${product.stock === 1 ? '' : 's'} in stock` : 'out of stock'} and carries a ${product.category} finish, which gives it a distinctly ${this.describeCategory(product.category)} presence.`,
        cards: [product].concat(this.getRelatedProducts(product, 1)),
        prompts: ['Compare this with velvet', 'Shipping and returns', 'What is best for coats?']
      };
    },

    buildCartResponse() {
      const items = this.context.cartProducts;
      const summary = items
        .map(item => `${item.name} x${item.qty}`)
        .join(', ');
      const suggestionBase = items[0];
      const suggestions = suggestionBase ? this.getRelatedProducts(suggestionBase, 2) : [];

      return {
        text: `Your cart currently includes ${summary}. If you want to round it out, I would keep the mix intentional: one structured option for tailoring, one softer option for delicate pieces, and a statement finish only if it suits how you display the wardrobe.`,
        cards: suggestions,
        prompts: ['Help before checkout', 'Recommend a hanger', 'Shipping and returns']
      };
    },

    buildSingleProductResponse(product) {
      return {
        text: `${product.name} is one of the clearest expressions of the Suspendre collection. It offers a ${this.describeCategory(product.category)} finish, ${this.buildStockCopy(product).toLowerCase()}, and works especially well when you want presentation to feel considered rather than purely functional.`,
        cards: [product].concat(this.getRelatedProducts(product, 1)),
        prompts: ['Compare two products', 'Is this item in stock?', 'Recommend a hanger']
      };
    },

    findProductsInMessage(lowered) {
      if (!window.ProductData || typeof ProductData.getAll !== 'function') return [];

      return ProductData.getAll().filter(product => {
        const name = String(product.name || '').toLowerCase();
        const slug = String(product.slug || '').toLowerCase();
        return name && (lowered.includes(name) || (slug && lowered.includes(slug.replace(/-/g, ' '))));
      });
    },

    findFaqMatch(lowered) {
      if (!Array.isArray(this.faqs) || this.faqs.length === 0) return null;

      const keywordSets = [
        { terms: ['ship', 'shipping', 'international', 'delivery'], category: 'shipping' },
        { terms: ['return', 'refund', 'exchange'], category: 'returns' },
        { terms: ['payment', 'paypal', 'pay'], category: 'payments' },
        { terms: ['care', 'clean', 'maintain'], category: 'care' },
        { terms: ['stock', 'available', 'sold out'], category: 'orders' }
      ];

      const matchedSet = keywordSets.find(set => set.terms.some(term => lowered.includes(term)));
      if (matchedSet) {
        const categoryMatch = this.faqs.find(faq => String(faq.category || '').toLowerCase() === matchedSet.category);
        if (categoryMatch) return categoryMatch;
      }

      return this.faqs.find(faq => {
        const question = String(faq.question || '').toLowerCase();
        return lowered.split(/\s+/).filter(Boolean).some(term => term.length > 3 && question.includes(term));
      }) || null;
    },

    inferCategoryFromMessage(lowered) {
      if (/(coat|coats|jacket|jackets|suit|suits|tailored|structure|structured)/.test(lowered)) {
        return lowered.includes('modern') || lowered.includes('metal') ? 'metal' : 'wood';
      }
      if (/(silk|satin|delicate|dress|slip|lingerie|soft)/.test(lowered)) {
        return 'velvet';
      }
      if (/(gift|display|statement|luxury|gold)/.test(lowered)) {
        return 'gold';
      }
      if (/(minimal|architectural|chrome|titanium|modern)/.test(lowered)) {
        return 'metal';
      }
      return null;
    },

    inferGarmentIntent(lowered) {
      if (/(coat|coats|jacket|jackets|suit|suits|tailored|structured)/.test(lowered)) return 'structured';
      if (/(silk|satin|dress|slip|delicate|soft)/.test(lowered)) return 'delicate';
      return 'general';
    },

    describeSuitability(product, garmentIntent) {
      if (garmentIntent === 'structured') {
        return ['wood', 'metal'].includes(product.category)
          ? 'a strong choice for tailored garments and heavier pieces.'
          : 'better suited to lighter garments than heavily structured tailoring.';
      }

      if (garmentIntent === 'delicate') {
        return product.category === 'velvet'
          ? 'an excellent choice for delicate garments because the finish helps prevent slipping.'
          : 'beautiful, though velvet remains the gentlest option for delicate fabrics.';
      }

      return 'well suited to customers who want both wardrobe support and a refined display presence.';
    },

    describeCategory(category) {
      const labels = {
        wood: 'heritage and structured',
        metal: 'architectural and precise',
        velvet: 'soft and slip-resistant',
        gold: 'dramatic and ceremonial'
      };
      return labels[category] || 'refined';
    },

    getFeaturedProducts(limit) {
      if (!window.ProductData || typeof ProductData.getFeatured !== 'function') return [];
      return ProductData.getFeatured().slice(0, limit);
    },

    getProductsByCategory(category, limit) {
      if (!window.ProductData || typeof ProductData.getAll !== 'function') return [];
      return ProductData.getAll()
        .filter(product => product.category === category)
        .slice(0, limit);
    },

    getRelatedProducts(product, limit) {
      if (!window.ProductData || typeof ProductData.getAll !== 'function') return [];
      return ProductData.getAll()
        .filter(entry => entry.id !== product.id)
        .sort((a, b) => {
          const aScore = (a.category === product.category ? 2 : 0) + (a.featured ? 1 : 0);
          const bScore = (b.category === product.category ? 2 : 0) + (b.featured ? 1 : 0);
          return bScore - aScore;
        })
        .slice(0, limit);
    },

    getProductImage(product) {
      if (window.ProductData && typeof ProductData.getImageSrc === 'function') {
        return ProductData.getImageSrc(product);
      }
      return './images/placeholder.svg';
    },

    buildStockCopy(product) {
      if (Number(product.stock) <= 0) return 'Currently sold out';
      if (Number(product.stock) <= 3) return `Only ${product.stock} left`;
      return `${product.stock} available`;
    },

    scrollMessages() {
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    },

    escape(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.AtelierChatbot = Atelier;
  document.addEventListener('DOMContentLoaded', () => {
    void Atelier.init();
  });
})();
