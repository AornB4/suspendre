// =========================================
//  SUSPENDRE — Index Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  await ProductData.ready();

  const grid = document.getElementById('featuredGrid');
  if (grid) {
    const featured = ProductData.getFeatured().slice(0, 5);

    if (featured.length === 0) {
      grid.innerHTML = '<p style="padding:48px;color:var(--warm-gray)">No featured products available.</p>';
    } else {
      featured.forEach((product, i) => {
        const card = buildProductCard(product);
        card.style.animationDelay = `${i * 0.1}s`;
        grid.appendChild(card);
      });
    }
  }

  await renderHomeFaqs();
});

const HOME_FAQ_FALLBACK = [
  {
    question: 'Do you ship internationally?',
    answer: 'Yes, international shipping can be made available depending on destination. Shipping timelines and fees may vary based on location and order size.',
    category: 'shipping'
  },
  {
    question: 'Which hanger is best for suits, coats, or structured garments?',
    answer: 'For suits, coats, jackets, and tailored pieces, we recommend our structured wood or premium metal hangers. These provide stronger shoulder support and help preserve the garment silhouette over time.',
    category: 'products'
  },
  {
    question: 'Which hanger is best for delicate garments like silk or satin?',
    answer: 'For silk, satin, slip dresses, and delicate fabrics, our velvet styles are ideal. They help prevent slipping while remaining gentle on lighter garments.',
    category: 'products'
  },
  {
    question: 'Can I return my order?',
    answer: 'Yes, returns may be accepted within a limited return window, provided the item is unused and in its original condition. Return approval may depend on the nature of the item and its packaging.',
    category: 'returns'
  }
];

async function loadHomeFaqs() {
  const db = window.SUSPENDRE_SUPABASE;
  if (!db || !db.isConfigured()) return HOME_FAQ_FALLBACK.slice();

  try {
    const client = db.getClient();
    const { data, error } = await client
      .from('faqs')
      .select('question, answer, category, display_order')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .limit(4);

    if (error || !Array.isArray(data) || data.length === 0) {
      return HOME_FAQ_FALLBACK.slice();
    }

    return data.map((faq) => ({
      question: faq.question || '',
      answer: faq.answer || '',
      category: faq.category || 'general'
    }));
  } catch (error) {
    console.warn('Home FAQ section could not load Supabase FAQs. Using fallback copy.', error);
    return HOME_FAQ_FALLBACK.slice();
  }
}

function formatFaqCategory(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Store Guidance';
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildHomeFaqItem(faq, index) {
  const item = document.createElement('article');
  item.className = 'home-faq-item';

  const button = document.createElement('button');
  button.className = 'home-faq-question';
  button.type = 'button';
  button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');

  const answerId = `homeFaqAnswer${index + 1}`;
  button.setAttribute('aria-controls', answerId);

  button.innerHTML = `
    <span class="home-faq-index">0${index + 1}</span>
    <span class="home-faq-copy">
      <span class="home-faq-kicker">${formatFaqCategory(faq.category)}</span>
      <h3>${faq.question}</h3>
    </span>
    <span class="home-faq-chevron" aria-hidden="true">+</span>
  `;

  const answer = document.createElement('div');
  answer.className = 'home-faq-answer';
  answer.id = answerId;
  answer.textContent = faq.answer;
  if (index !== 0) {
    answer.hidden = true;
  } else {
    item.classList.add('open');
  }

  button.addEventListener('click', () => {
    const grid = item.parentElement;
    if (!grid) return;

    const isOpen = item.classList.contains('open');
    grid.querySelectorAll('.home-faq-item').forEach((entry) => {
      entry.classList.remove('open');
      const entryButton = entry.querySelector('.home-faq-question');
      const entryAnswer = entry.querySelector('.home-faq-answer');
      entryButton?.setAttribute('aria-expanded', 'false');
      if (entryAnswer) entryAnswer.hidden = true;
    });

    if (isOpen) return;

    item.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    answer.hidden = false;
  });

  item.append(button, answer);
  return item;
}

async function renderHomeFaqs() {
  const container = document.getElementById('homeFaqGrid');
  if (!container) return;

  const faqs = await loadHomeFaqs();
  if (!Array.isArray(faqs) || faqs.length === 0) {
    container.innerHTML = '<div class="home-faq-loading">No frequently asked questions are available right now.</div>';
    return;
  }

  container.innerHTML = '';
  faqs.slice(0, 4).forEach((faq, index) => {
    container.appendChild(buildHomeFaqItem(faq, index));
  });
}
