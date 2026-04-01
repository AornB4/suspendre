// =========================================
//  SUSPENDRE — Auth Manager
// =========================================

const Auth = {
  currentUser: null,
  initPromise: null,
  initialized: false,
  authSubscription: null,

  getClient() {
    const db = window.SUSPENDRE_SUPABASE;
    if (!db || !db.isConfigured()) return null;
    return db.getClient();
  },

  cloneUser(user) {
    if (!user) return null;
    return {
      ...user,
      wishlist: Array.isArray(user.wishlist) ? [...user.wishlist] : [],
      addressBook: Array.isArray(user.addressBook)
        ? user.addressBook.map(entry => ({ ...entry }))
        : []
    };
  },

  normalizeAddressBook(rawAddressBook, fullName = '', fallbackAddress = '') {
    let entries = [];

    if (Array.isArray(rawAddressBook)) {
      entries = rawAddressBook;
    } else if (typeof rawAddressBook === 'string' && rawAddressBook.trim()) {
      try {
        const parsed = JSON.parse(rawAddressBook);
        if (Array.isArray(parsed)) entries = parsed;
      } catch (_error) {
        entries = [];
      }
    }

    const normalized = entries
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const address = String(entry.address || '').trim();
        if (!address) return null;

        return {
          id: String(entry.id || `addr-${index + 1}`),
          label: String(entry.label || 'Address').trim() || 'Address',
          recipient: String(entry.recipient || fullName || '').trim(),
          phone: String(entry.phone || '').trim(),
          address,
          isPrimary: Boolean(entry.isPrimary ?? entry.is_primary)
        };
      })
      .filter(Boolean);

    if (!normalized.length && String(fallbackAddress || '').trim()) {
      normalized.push({
        id: 'primary-address',
        label: 'Primary',
        recipient: String(fullName || '').trim(),
        phone: '',
        address: String(fallbackAddress).trim(),
        isPrimary: true
      });
    }

    if (normalized.length > 0 && !normalized.some(entry => entry.isPrimary)) {
      normalized[0].isPrimary = true;
    }

    return normalized.map((entry, index) => ({
      ...entry,
      isPrimary: index === normalized.findIndex(candidate => candidate.isPrimary)
    }));
  },

  getPrimaryAddressEntry(addressBook) {
    if (!Array.isArray(addressBook) || addressBook.length === 0) return null;
    return addressBook.find(entry => entry.isPrimary) || addressBook[0] || null;
  },

  hasMissingColumnError(error, columnName) {
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return message.includes(String(columnName || '').toLowerCase()) && message.includes('column');
  },

  validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('length');
    if (!/[A-Z]/.test(password)) errors.push('upper');
    if (!/[a-z]/.test(password)) errors.push('lower');
    if (!/[0-9]/.test(password)) errors.push('number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) errors.push('special');
    return { valid: errors.length === 0, errors };
  },

  normalizeUser(authUser, profile) {
    if (!authUser) return null;

    const fullName = profile && profile.full_name
      ? profile.full_name
      : authUser.user_metadata && authUser.user_metadata.full_name
        ? authUser.user_metadata.full_name
        : (authUser.email || 'Guest').split('@')[0];

    const addressBook = this.normalizeAddressBook(
      profile && profile.address_book,
      fullName,
      profile && profile.address ? profile.address : ''
    );
    const primaryAddress = this.getPrimaryAddressEntry(addressBook);

    return {
      id: authUser.id,
      name: fullName,
      email: authUser.email || '',
      role: profile && profile.role ? profile.role : 'customer',
      address: primaryAddress ? primaryAddress.address : '',
      avatar: profile && profile.avatar_url ? profile.avatar_url : '',
      wishlist: [],
      addressBook,
      createdAt: profile && profile.created_at ? profile.created_at : authUser.created_at
    };
  },

  async fetchProfile(userId) {
    const client = this.getClient();
    if (!client) return null;

    let { data, error } = await client
      .from('profiles')
      .select('id, full_name, avatar_url, address, address_book, role, created_at, updated_at')
      .eq('id', userId)
      .limit(1);

    if (error && this.hasMissingColumnError(error, 'address_book')) {
      const fallback = await client
        .from('profiles')
        .select('id, full_name, avatar_url, address, role, created_at, updated_at')
        .eq('id', userId)
        .limit(1);

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Failed to fetch profile.', error);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  },

  async hydrateFromSession(session) {
    const authUser = session && session.user ? session.user : null;
    if (!authUser) {
      this.setCurrentUser(null);
      return null;
    }

    const profile = await this.fetchProfile(authUser.id);
    const normalizedUser = this.normalizeUser(authUser, profile);
    normalizedUser.wishlist = await this.fetchWishlistIds(authUser.id);
    this.setCurrentUser(normalizedUser);
    return this.getCurrentUser();
  },

  async fetchWishlistIds(userId) {
    const client = this.getClient();
    if (!client || !userId) return [];

    await ProductData.ready();

    const { data, error } = await client
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch wishlist items.', error);
      return [];
    }

    return (data || [])
      .map(item => {
        const product = ProductData.getById(item.product_id);
        return product ? product.id : null;
      })
      .filter(Boolean);
  },

  async getWishlistIds() {
    const currentUser = this.currentUser;
    if (!currentUser) return [];

    const ids = await this.fetchWishlistIds(currentUser.id);
    this.currentUser = {
      ...currentUser,
      wishlist: [...ids]
    };
    return [...ids];
  },

  async addWishlistItem(productId) {
    const client = this.getClient();
    const currentUser = this.currentUser;

    if (!client || !currentUser) {
      return { success: false, message: 'Please login to save favorites.' };
    }

    const product = ProductData.getById(productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    const { error } = await client
      .from('wishlist_items')
      .upsert({
        user_id: currentUser.id,
        product_id: product.dbId
      }, { onConflict: 'user_id,product_id' });

    if (error) {
      return { success: false, message: error.message, error };
    }

    const wishlist = await this.getWishlistIds();
    this.setCurrentUser({
      ...currentUser,
      wishlist
    });

    return { success: true, wishlist };
  },

  async removeWishlistItem(productId) {
    const client = this.getClient();
    const currentUser = this.currentUser;

    if (!client || !currentUser) {
      return { success: false, message: 'Please login to save favorites.' };
    }

    const product = ProductData.getById(productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    const { error } = await client
      .from('wishlist_items')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('product_id', product.dbId);

    if (error) {
      return { success: false, message: error.message, error };
    }

    const wishlist = await this.getWishlistIds();
    this.setCurrentUser({
      ...currentUser,
      wishlist
    });

    return { success: true, wishlist };
  },

  async toggleWishlistItem(productId) {
    const currentUser = this.currentUser;
    if (!currentUser) {
      return { success: false, message: 'Please login to save favorites.' };
    }

    const wishlist = currentUser.wishlist || [];
    if (wishlist.includes(productId)) {
      return this.removeWishlistItem(productId);
    }
    return this.addWishlistItem(productId);
  },

  setCurrentUser(user) {
    this.currentUser = user ? this.cloneUser(user) : null;
    window.dispatchEvent(new CustomEvent('suspendre:auth-ready', {
      detail: { user: this.cloneUser(this.currentUser) }
    }));
  },

  async refreshCurrentUser() {
    const client = this.getClient();
    if (!client) {
      this.setCurrentUser(null);
      return null;
    }

    const { data, error } = await client.auth.getUser();
    if (error) {
      console.error('Failed to load current auth user.', error);
      this.setCurrentUser(null);
      return null;
    }

    if (!data.user) {
      this.setCurrentUser(null);
      return null;
    }

    return this.hydrateFromSession({ user: data.user });
  },

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = this.getClient();
      if (!client) {
        console.error('Supabase client is not configured. Auth is unavailable.');
        this.setCurrentUser(null);
        this.initialized = true;
        return null;
      }

      if (!this.authSubscription) {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          // Supabase warns against awaiting additional auth calls inside this callback.
          window.setTimeout(() => {
            void this.hydrateFromSession(session);
          }, 0);
        });
        this.authSubscription = data.subscription;
      }

      const user = await this.refreshCurrentUser();
      this.initialized = true;
      return user;
    })();

    return this.initPromise;
  },

  ready() {
    return this.init();
  },

  getCurrentUser() {
    return this.cloneUser(this.currentUser);
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isAdmin() {
    return !!this.currentUser && this.currentUser.role === 'admin';
  },

  formatAuthError(error, fallbackMessage) {
    if (!error) return fallbackMessage;

    const message = String(error.message || fallbackMessage || 'Authentication failed.');
    if (message.toLowerCase().includes('invalid login credentials')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (message.toLowerCase().includes('user already registered')) {
      return 'An account with this email already exists.';
    }
    return message;
  },

  async signup(name, email, password) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase is not configured.' };
    }

    if (!name.trim()) return { success: false, message: 'Please enter your full name.' };
    if (!email.trim()) return { success: false, message: 'Please enter your email address.' };
    if (!/\S+@\S+\.\S+/.test(email)) return { success: false, message: 'Please enter a valid email address.' };

    const pwValidation = this.validatePassword(password);
    if (!pwValidation.valid) return { success: false, message: 'Password does not meet requirements.' };

    const { data, error } = await client.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          full_name: name.trim()
        }
      }
    });

    if (error) {
      return {
        success: false,
        message: this.formatAuthError(error, 'Failed to create your account.')
      };
    }

    await this.refreshCurrentUser();

    const user = this.getCurrentUser();
    return {
      success: true,
      user: user || this.normalizeUser(data.user, null)
    };
  },

  async login(email, password) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase is not configured.' };
    }

    if (!email.trim()) return { success: false, message: 'Please enter your email address.' };
    if (!password) return { success: false, message: 'Please enter your password.' };

    const { data, error } = await client.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      return {
        success: false,
        message: this.formatAuthError(error, 'Failed to sign in.')
      };
    }

    await this.refreshCurrentUser();

    return {
      success: true,
      user: this.getCurrentUser() || this.normalizeUser(data.user, null)
    };
  },

  async loginWithGoogle(options = {}) {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase is not configured.' };
    }

    const redirectTo = options.redirectTo || `${window.location.origin}${window.location.pathname}`;

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    });

    if (error) {
      return {
        success: false,
        message: this.formatAuthError(error, 'Could not start Google sign-in.')
      };
    }

    return { success: true };
  },

  async logout() {
    const client = this.getClient();
    if (!client) {
      window.location.href = 'index.html';
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      console.error('Failed to sign out.', error);
    }

    this.setCurrentUser(null);
    window.location.href = 'index.html';
  },

  async updateUser(userId, updates) {
    const currentUser = this.currentUser;
    const client = this.getClient();

    if (!currentUser || !client || currentUser.id !== userId) {
      return { success: false, message: 'User not found.' };
    }

    const profileUpdates = {};

    if (typeof updates.name === 'string') profileUpdates.full_name = updates.name.trim();
    if (typeof updates.avatar === 'string') profileUpdates.avatar_url = updates.avatar;

    if (Array.isArray(updates.addressBook)) {
      const normalizedAddressBook = this.normalizeAddressBook(
        updates.addressBook,
        typeof updates.name === 'string' ? updates.name.trim() : currentUser.name,
        typeof updates.address === 'string' ? updates.address : currentUser.address
      );
      const primaryAddress = this.getPrimaryAddressEntry(normalizedAddressBook);

      profileUpdates.address_book = normalizedAddressBook.map(entry => ({
        id: entry.id,
        label: entry.label,
        recipient: entry.recipient,
        phone: entry.phone,
        address: entry.address,
        is_primary: entry.isPrimary
      }));
      profileUpdates.address = primaryAddress ? primaryAddress.address : '';
    } else if (typeof updates.address === 'string') {
      profileUpdates.address = updates.address;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await client
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (error) {
        return {
          success: false,
          message: this.formatAuthError(error, 'Failed to update profile.')
        };
      }
    }

    const freshUser = await this.refreshCurrentUser();
    return {
      success: true,
      user: freshUser
    };
  },

  async updatePassword(password) {
    const client = this.getClient();
    if (!client || !this.currentUser) {
      return { success: false, message: 'Please sign in again to update your password.' };
    }

    const pwValidation = this.validatePassword(password || '');
    if (!pwValidation.valid) {
      return { success: false, message: 'Password does not meet requirements.' };
    }

    const { error } = await client.auth.updateUser({
      password
    });

    if (error) {
      return {
        success: false,
        message: this.formatAuthError(error, 'Failed to update password.')
      };
    }

    return { success: true };
  },

  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.isAdmin()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  async getUserCount() {
    const client = this.getClient();
    if (!client) return 0;

    const { count, error } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Failed to count profiles.', error);
      return 0;
    }

    return count || 0;
  }
};

Auth.init();
