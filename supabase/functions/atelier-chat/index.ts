import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type ChatRequest = {
  message?: string;
  page?: {
    type?: string;
    productId?: string | null;
  };
  cart?: Array<{ productId?: string; qty?: number }>;
};

type ProductRecord = {
  id: string;
  legacy_id: string | null;
  slug: string | null;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image_url: string | null;
  featured: boolean;
  active: boolean;
};

type FaqRecord = {
  question: string;
  answer: string;
  category: string | null;
};

const GEMINI_MODEL = 'gemini-2.0-flash';

const jsonSchema = {
  type: 'OBJECT',
  properties: {
    answer: {
      type: 'STRING'
    },
    product_ids: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      },
      maxItems: 3
    },
    follow_up_prompts: {
      type: 'ARRAY',
      items: {
        type: 'STRING'
      },
      maxItems: 3
    }
  },
  required: ['answer', 'product_ids', 'follow_up_prompts']
};

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizeMessage(message: string) {
  return message.replace(/\s+/g, ' ').trim();
}

function tokenize(value: string) {
  return normalizeMessage(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2);
}

function scoreProduct(product: ProductRecord, tokens: string[], currentProductId?: string | null) {
  let score = product.featured ? 2 : 0;

  if (currentProductId && (product.id === currentProductId || product.legacy_id === currentProductId || product.slug === currentProductId)) {
    score += 8;
  }

  const haystack = [
    product.name,
    product.category,
    product.description,
    product.slug || '',
    product.legacy_id || ''
  ].join(' ').toLowerCase();

  tokens.forEach(token => {
    if (haystack.includes(token)) score += 3;
  });

  return score;
}

function scoreFaq(faq: FaqRecord, tokens: string[]) {
  let score = 0;
  const haystack = `${faq.question} ${faq.answer} ${faq.category || ''}`.toLowerCase();
  tokens.forEach(token => {
    if (haystack.includes(token)) score += 2;
  });
  return score;
}

function selectRelevantProducts(products: ProductRecord[], payload: ChatRequest, tokens: string[]) {
  const currentProductId = payload.page?.productId || null;
  const cartIds = new Set((payload.cart || []).map(item => item.productId).filter(Boolean));

  const prioritized = [...products]
    .sort((a, b) => scoreProduct(b, tokens, currentProductId) - scoreProduct(a, tokens, currentProductId))
    .filter((product, index, list) => index === list.findIndex(entry => entry.id === product.id));

  const chosen: ProductRecord[] = [];

  prioritized.forEach(product => {
    const isCurrent = currentProductId && (product.id === currentProductId || product.legacy_id === currentProductId || product.slug === currentProductId);
    if (isCurrent || cartIds.has(product.legacy_id || product.id) || scoreProduct(product, tokens, currentProductId) > 0) {
      if (!chosen.find(entry => entry.id === product.id)) {
        chosen.push(product);
      }
    }
  });

  if (chosen.length < 6) {
    prioritized.slice(0, 6).forEach(product => {
      if (!chosen.find(entry => entry.id === product.id)) {
        chosen.push(product);
      }
    });
  }

  return chosen.slice(0, 6);
}

function selectRelevantFaqs(faqs: FaqRecord[], tokens: string[]) {
  const ranked = [...faqs].sort((a, b) => scoreFaq(b, tokens) - scoreFaq(a, tokens));
  const chosen = ranked.filter((faq, index) => index < 5 || scoreFaq(faq, tokens) > 0);
  return chosen.slice(0, 5);
}

function buildContextBlock(products: ProductRecord[], faqs: FaqRecord[], payload: ChatRequest) {
  const productLines = products.map(product => {
    const stableId = product.legacy_id || product.id;
    return [
      `id=${stableId}`,
      `name=${product.name}`,
      `category=${product.category}`,
      `price=${Number(product.price).toFixed(2)}`,
      `stock=${product.stock}`,
      `featured=${product.featured ? 'yes' : 'no'}`,
      `description=${product.description}`
    ].join(' | ');
  });

  const faqLines = faqs.map(faq => {
    return `category=${faq.category || 'general'} | q=${faq.question} | a=${faq.answer}`;
  });

  const cartLines = Array.isArray(payload.cart)
    ? payload.cart
        .filter(item => item && item.productId)
        .map(item => `productId=${item.productId} qty=${item.qty || 1}`)
    : [];

  return [
    'STORE_PRODUCTS:',
    productLines.join('\n'),
    '',
    'STORE_FAQS:',
    faqLines.join('\n'),
    '',
    'PAGE_CONTEXT:',
    `pageType=${payload.page?.type || 'unknown'}`,
    `currentProductId=${payload.page?.productId || 'none'}`,
    `cart=${cartLines.length ? cartLines.join('; ') : 'empty'}`
  ].join('\n');
}

function getCurrentProduct(products: ProductRecord[], productId?: string | null) {
  if (!productId) return null;
  return products.find(product =>
    product.id === productId ||
    product.legacy_id === productId ||
    product.slug === productId
  ) || null;
}

function toPublicProduct(product: ProductRecord) {
  return {
    id: product.legacy_id || product.id,
    name: product.name,
    category: product.category,
    price: Number(product.price),
    stock: Number(product.stock),
    description: product.description,
    image: product.image_url,
    featured: !!product.featured
  };
}

function findMentionedProducts(products: ProductRecord[], lowered: string) {
  return products.filter(product => {
    const name = product.name.toLowerCase();
    const slug = (product.slug || '').toLowerCase().replace(/-/g, ' ');
    const legacy = (product.legacy_id || '').toLowerCase();
    return lowered.includes(name) || (!!slug && lowered.includes(slug)) || (!!legacy && lowered.includes(legacy));
  });
}

function describeCategory(category: string) {
  const labels: Record<string, string> = {
    wood: 'heritage and structured',
    metal: 'architectural and precise',
    velvet: 'soft and slip-resistant',
    gold: 'dramatic and ceremonial'
  };
  return labels[category] || 'refined';
}

function describeSuitability(product: ProductRecord, lowered: string) {
  const wantsStructured = /(coat|coats|jacket|jackets|suit|suits|tailored|structured)/.test(lowered);
  const wantsDelicate = /(silk|satin|dress|slip|delicate|soft)/.test(lowered);

  if (wantsStructured) {
    return ['wood', 'metal'].includes(product.category)
      ? 'a strong option for tailored garments and heavier pieces.'
      : 'better suited to lighter garments than heavily structured tailoring.';
  }

  if (wantsDelicate) {
    return product.category === 'velvet'
      ? 'an excellent option for delicate garments because it helps prevent slipping.'
      : 'beautiful, though velvet remains the gentlest option for delicate fabrics.';
  }

  return 'well suited to customers who want wardrobe support with a refined display presence.';
}

function pickCategoryRecommendation(products: ProductRecord[], lowered: string) {
  let category: string | null = null;

  if (/(coat|coats|jacket|jackets|suit|suits|tailored|structured)/.test(lowered)) {
    category = lowered.includes('metal') || lowered.includes('modern') ? 'metal' : 'wood';
  } else if (/(silk|satin|dress|slip|delicate|soft)/.test(lowered)) {
    category = 'velvet';
  } else if (/(gift|display|statement|gold|luxury)/.test(lowered)) {
    category = 'gold';
  }

  if (!category) return null;

  const matches = products.filter(product => product.category === category).slice(0, 2);
  if (!matches.length) return null;

  const answerByCategory: Record<string, string> = {
    wood: 'For suits, coats, and tailored pieces, I would start with our wood silhouettes because they provide elegant shoulder structure and a more heritage feel.',
    metal: 'For a sharper, more architectural look, our metal pieces are ideal. They feel especially strong for structured garments and modern wardrobes.',
    velvet: 'For silk, satin, and delicate fabrics, velvet is the clearest recommendation. It helps prevent slipping while remaining gentle on lighter garments.',
    gold: 'For display, gifting, or a statement wardrobe moment, the gold-accented collection gives the most dramatic finish.'
  };

  return {
    answer: answerByCategory[category],
    products: matches.map(toPublicProduct),
    prompts: ['Compare two products', 'Is this item in stock?', 'Shipping and returns'],
    source: 'direct'
  };
}

function pickFaqAnswer(faqs: FaqRecord[], lowered: string) {
  const categoryTerms = [
    { category: 'shipping', terms: ['ship', 'shipping', 'international', 'delivery'] },
    { category: 'returns', terms: ['return', 'refund', 'exchange'] },
    { category: 'payments', terms: ['payment', 'paypal', 'pay'] },
    { category: 'care', terms: ['care', 'clean', 'maintain'] },
    { category: 'account', terms: ['account', 'wishlist', 'save for later'] },
    { category: 'orders', terms: ['processing', 'cancel', 'damaged', 'stock', 'available'] }
  ];

  const matched = categoryTerms.find(entry => entry.terms.some(term => lowered.includes(term)));
  if (!matched) return null;

  return faqs.find(faq => String(faq.category || '').toLowerCase() === matched.category) || null;
}

function buildDirectResponse(products: ProductRecord[], faqs: FaqRecord[], payload: ChatRequest, message: string) {
  const lowered = message.toLowerCase();
  const currentProduct = getCurrentProduct(products, payload.page?.productId);
  const mentionedProducts = findMentionedProducts(products, lowered);

  const faqMatch = pickFaqAnswer(faqs, lowered);
  if (faqMatch && !/(compare|recommend|best)/.test(lowered)) {
    return {
      answer: faqMatch.answer,
      products: [],
      prompts: ['Recommend a hanger', 'Compare two products', 'Ask about this item'],
      source: 'direct'
    };
  }

  if (/(stock|available|sold out|in stock)/.test(lowered)) {
    const stockProduct = mentionedProducts[0] || currentProduct;
    if (stockProduct) {
      const stockAnswer = stockProduct.stock <= 0
        ? `${stockProduct.name} is currently sold out.`
        : stockProduct.stock <= 3
          ? `${stockProduct.name} is in stock, with only ${stockProduct.stock} remaining.`
          : `${stockProduct.name} is in stock, with ${stockProduct.stock} available right now.`;

      return {
        answer: stockAnswer,
        products: [toPublicProduct(stockProduct)],
        prompts: ['Compare two products', 'Recommend a hanger', 'Shipping and returns'],
        source: 'direct'
      };
    }
  }

  if ((lowered.includes('compare') || lowered.includes('vs') || lowered.includes('versus')) && mentionedProducts.length >= 2) {
    const [first, second] = mentionedProducts.slice(0, 2);
    return {
      answer: `${first.name} feels more ${describeCategory(first.category)}, while ${second.name} leans ${describeCategory(second.category)}. If you want stronger shoulder structure, start with ${first.category === 'velvet' ? second.name : first.name}. If slip resistance or softness matters more, ${first.category === 'velvet' ? first.name : second.name} is the better fit.`,
      products: [toPublicProduct(first), toPublicProduct(second)],
      prompts: ['Which is better for suits?', 'Which is better for silk?', 'Show me another option'],
      source: 'direct'
    };
  }

  if (currentProduct && /(this|current|good for|worth it|best for)/.test(lowered)) {
    return {
      answer: `${currentProduct.name} is ${describeSuitability(currentProduct, lowered)} It carries a ${currentProduct.category} finish, which gives it a distinctly ${describeCategory(currentProduct.category)} presence.`,
      products: [toPublicProduct(currentProduct)],
      prompts: ['Compare this with velvet', 'Is this item in stock?', 'Shipping and returns'],
      source: 'direct'
    };
  }

  const categoryRecommendation = pickCategoryRecommendation(products, lowered);
  if (categoryRecommendation) {
    return categoryRecommendation;
  }

  return null;
}

function sanitizeResponse(raw: any, products: ProductRecord[]) {
  const answer = typeof raw?.answer === 'string'
    ? raw.answer.trim()
    : 'I can help with product guidance, comparisons, and store questions, but I need a moment to refine the reply.';

  const requestedIds = Array.isArray(raw?.product_ids)
    ? raw.product_ids.map((value: unknown) => String(value))
    : [];

  const selectedProducts = requestedIds
    .map(id => products.find(product =>
      product.id === id ||
      product.legacy_id === id ||
      product.slug === id
    ))
    .filter(Boolean)
    .slice(0, 3) as ProductRecord[];

  const followUpPrompts = Array.isArray(raw?.follow_up_prompts)
    ? raw.follow_up_prompts
        .map((value: unknown) => String(value).trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return {
    answer,
    products: selectedProducts.map(toPublicProduct),
    prompts: followUpPrompts
  };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await request.json()) as ChatRequest;
    const message = normalizeMessage(String(payload?.message || ''));

    if (!message) {
      return new Response(JSON.stringify({ message: 'Message is required.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');
    const geminiApiKey = getEnv('GEMINI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || ''
        }
      }
    });

    const [{ data: products, error: productsError }, { data: faqs, error: faqsError }] = await Promise.all([
      supabase
        .from('products')
        .select('id, legacy_id, slug, name, category, price, stock, description, image_url, featured, active')
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('faqs')
        .select('question, answer, category')
        .eq('active', true)
        .order('display_order', { ascending: true })
    ]);

    if (productsError) throw productsError;
    if (faqsError) throw faqsError;

    const safeProducts = Array.isArray(products) ? products : [];
    const safeFaqs = Array.isArray(faqs) ? faqs : [];
    const currentProduct = getCurrentProduct(safeProducts, payload.page?.productId);
    const tokens = tokenize(message);
    const contextProducts = selectRelevantProducts(safeProducts, payload, tokens);
    const contextFaqs = selectRelevantFaqs(safeFaqs, tokens);
    const directResponse = buildDirectResponse(safeProducts, safeFaqs, payload, message);

    if (directResponse) {
      return new Response(JSON.stringify(directResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const systemInstruction = [
      'You are Atelier, the warm-luxury shopping concierge for Suspendre, a luxury hanger ecommerce brand.',
      'Be concise, polished, and customer-support oriented.',
      'Only answer using the provided store products, FAQs, and page context.',
      'Never invent policies, shipping promises, prices, stock counts, or product attributes.',
      'If the user asks something outside the provided store context, gently say that you can help with Suspendre product guidance, comparisons, and store questions only.',
      'Favor recommending one to three products at most.',
      'Mention current stock carefully and truthfully when relevant.',
      'Return valid JSON only.'
    ].join(' ');

    const userPrompt = [
      currentProduct
        ? `The customer is currently viewing: ${currentProduct.name} (${currentProduct.legacy_id || currentProduct.id}).`
        : 'The customer is not on a product detail page.',
      buildContextBlock(contextProducts, contextFaqs, payload),
      '',
      `CUSTOMER_MESSAGE: ${message}`,
      '',
      'Respond with JSON matching the required schema.'
    ].join('\n');

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        generation_config: {
          response_mime_type: 'application/json',
          response_schema: jsonSchema,
          temperature: 0.45,
          max_output_tokens: 700
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({
          answer: 'Atelier is receiving unusually high demand right now on the free AI tier. Please try again in a moment, or ask a narrower product question while capacity resets.',
          products: currentProduct ? [{
            ...toPublicProduct(currentProduct)
          }] : [],
          prompts: [
            'Ask about this item',
            'Compare two products',
            'Shipping and returns'
          ],
          source: 'quota-fallback'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      throw new Error(`Gemini request failed: ${geminiResponse.status} ${errorText}`);
    }

    const geminiBody = await geminiResponse.json();
    const rawText = geminiBody?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini returned no text candidate.');
    }

    const parsed = JSON.parse(rawText);
    const result = sanitizeResponse(parsed, safeProducts);

    return new Response(JSON.stringify({
      ...result,
      source: 'gemini'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('atelier-chat error', error);

    return new Response(JSON.stringify({
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
