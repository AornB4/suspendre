// =========================================
//  SUSPENDRE — Auth Manager
// =========================================

const ADMIN_ACCOUNT = {
  id: 'admin-001',
  name: 'Admin',
  email: 'admin@suspendre.com',
  password: 'Admin@123',
  role: 'admin'
};

const Auth = {
  USERS_KEY: 'suspendre_users',
  SESSION_KEY: 'suspendre_session',

  initAdminAccount() {
    const users = this.getUsers();
    const adminExists = users.find(u => u.email === ADMIN_ACCOUNT.email);
    if (!adminExists) {
      users.push(ADMIN_ACCOUNT);
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    }
  },

  getUsers() {
    return JSON.parse(localStorage.getItem(this.USERS_KEY)) || [];
  },

  getCurrentUser() {
    const session = localStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
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

  signup(name, email, password) {
    this.initAdminAccount();
    const users = this.getUsers();

    if (!name.trim()) return { success: false, message: 'Please enter your full name.' };
    if (!email.trim()) return { success: false, message: 'Please enter your email address.' };
    if (!/\S+@\S+\.\S+/.test(email)) return { success: false, message: 'Please enter a valid email address.' };

    const pwValidation = this.validatePassword(password);
    if (!pwValidation.valid) return { success: false, message: 'Password does not meet requirements.' };

    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, message: 'An account with this email already exists.' };

    const newUser = {
      id: 'u' + Date.now(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

    // Auto-login after signup
    const sessionUser = { ...newUser };
    delete sessionUser.password;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));

    return { success: true, user: sessionUser };
  },

  login(email, password) {
    this.initAdminAccount();
    const users = this.getUsers();

    if (!email.trim()) return { success: false, message: 'Please enter your email address.' };
    if (!password) return { success: false, message: 'Please enter your password.' };

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) return { success: false, message: 'No account found with this email.' };
    if (user.password !== password) return { success: false, message: 'Incorrect password. Please try again.' };

    const sessionUser = { ...user };
    delete sessionUser.password;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));

    return { success: true, user: sessionUser };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
  },

  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return { success: false, message: 'User not found.' };

    users[index] = { ...users[index], ...updates };
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      const sessionUser = { ...users[index] };
      delete sessionUser.password;
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
    }

    return { success: true, user: users[index] };
  },

  requireLogin(redirectBack = true) {
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
  }
};

// Init admin on load
Auth.initAdminAccount();
