// =========================================
//  SUSPENDRE — Auth Manager
// =========================================

const Auth = {
  EXTRAS_KEY: 'suspendre_profile_extras',
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
      wishlist: Array.isArray(user.wishlist) ? [...user.wishlist] : []
    };
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

  readExtrasMap() {
    try {
      return JSON.parse(localStorage.getItem(this.EXTRAS_KEY)) || {};
    } catch (error) {
      console.warn('Failed to read auth extras from localStorage.', error);
      return {};
    }
  },

  writeExtrasMap(map) {
    localStorage.setItem(this.EXTRAS_KEY, JSON.stringify(map));
  },

  getUserExtras(userId) {
    const map = this.readExtrasMap();
    return map[userId] || {};
  },

  saveUserExtras(userId, updates) {
    const map = this.readExtrasMap();
    map[userId] = {
      ...(map[userId] || {}),
      ...updates
    };
    this.writeExtrasMap(map);
    return map[userId];
  },

  normalizeUser(authUser, profile) {
    if (!authUser) return null;

    const extras = this.getUserExtras(authUser.id);
    const fullName = profile && profile.full_name
      ? profile.full_name
      : authUser.user_metadata && authUser.user_metadata.full_name
        ? authUser.user_metadata.full_name
        : (authUser.email || 'Guest').split('@')[0];

    return {
      id: authUser.id,
      name: fullName,
      email: authUser.email || '',
      role: profile && profile.role ? profile.role : 'customer',
      address: profile && profile.address ? profile.address : '',
      avatar: profile && profile.avatar_url ? profile.avatar_url : '',
      wishlist: Array.isArray(extras.wishlist) ? extras.wishlist : [],
      createdAt: profile && profile.created_at ? profile.created_at : authUser.created_at
    };
  },

  async fetchProfile(userId) {
    const client = this.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, avatar_url, address, role, created_at, updated_at')
      .eq('id', userId)
      .limit(1);

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
    this.setCurrentUser(normalizedUser);
    return this.getCurrentUser();
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
    const extrasUpdates = {};

    if (typeof updates.name === 'string') profileUpdates.full_name = updates.name.trim();
    if (typeof updates.address === 'string') profileUpdates.address = updates.address;
    if (typeof updates.avatar === 'string') profileUpdates.avatar_url = updates.avatar;
    if (Array.isArray(updates.wishlist)) extrasUpdates.wishlist = [...updates.wishlist];

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

    if (Object.keys(extrasUpdates).length > 0) {
      this.saveUserExtras(userId, extrasUpdates);
    }

    const freshUser = await this.refreshCurrentUser();
    return {
      success: true,
      user: freshUser
    };
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
