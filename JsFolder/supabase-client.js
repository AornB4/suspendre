// Shared Supabase browser client for the static storefront.
(function () {
  const globalKey = 'SUSPENDRE_SUPABASE';
  const config = window.SUSPENDRE_SUPABASE_CONFIG || {};

  function hasValue(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function isConfigured(currentConfig) {
    return hasValue(currentConfig.url) && hasValue(currentConfig.anonKey);
  }

  const state = {
    configured: false,
    client: null,
    config,
    error: null
  };

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    state.error = 'Supabase CDN client failed to load.';
  } else if (!isConfigured(config)) {
    state.error = 'Supabase config is missing. Fill JsFolder/supabase-config.js first.';
  } else {
    try {
      state.client = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      state.configured = true;
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    }
  }

  window[globalKey] = {
    isConfigured() {
      return state.configured && !!state.client;
    },
    getClient() {
      return state.client;
    },
    getConfig() {
      return { ...state.config };
    },
    getError() {
      return state.error;
    },
    async smokeTest() {
      if (!this.isConfigured()) {
        return {
          ok: false,
          message: state.error || 'Supabase is not configured.'
        };
      }

      try {
        const { error, data } = await state.client
          .from('products')
          .select('id, name, stock', { count: 'exact' })
          .limit(1);

        if (error) {
          return {
            ok: false,
            message: error.message,
            error
          };
        }

        return {
          ok: true,
          message: 'Supabase read succeeded.',
          sample: data || []
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          error
        };
      }
    }
  };
})();
