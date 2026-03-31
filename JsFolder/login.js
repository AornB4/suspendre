// =========================================
//  SUSPENDRE — Login Page
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.ready();
  // Redirect if already logged in
  if (Auth.isLoggedIn()) {
    window.location.href = Auth.isAdmin() ? 'admin.html' : 'shop.html';
    return;
  }

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const togglePw = document.getElementById('togglePw');
  const alertBox = document.getElementById('authAlert');

  function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';
  }

  function hideAlert() {
    alertBox.style.display = 'none';
  }

  // Toggle password visibility
  if (togglePw) {
    togglePw.addEventListener('click', () => {
      const isText = passwordInput.type === 'text';
      passwordInput.type = isText ? 'password' : 'text';
      togglePw.textContent = isText ? 'Show' : 'Hide';
    });
  }

  // Login button
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      hideAlert();
      const email = emailInput.value;
      const password = passwordInput.value;

      loginBtn.textContent = 'Signing in…';
      loginBtn.disabled = true;

      setTimeout(async () => {
        const result = await Auth.login(email, password);

        if (result.success) {
          showAlert(`Welcome back, ${result.user.name}.`, 'success');
          showToast('Login successful!', 'success');

          setTimeout(() => {
            if (result.user.role === 'admin') {
              window.location.href = 'admin.html';
            } else {
              window.location.href = 'shop.html';
            }
          }, 800);
        } else {
          showAlert(result.message, 'error');
          loginBtn.textContent = 'Sign In';
          loginBtn.disabled = false;
        }
      }, 400);
    });
  }

  // Enter key
  [emailInput, passwordInput].forEach(input => {
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn && loginBtn.click();
      });
    }
  });
});

// Demo fill function (called from HTML)
function fillDemo(type) {
  void type;
  showToast('Demo accounts are disabled after the Supabase auth migration.', 'default');
  return;

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  if (type === 'admin') {
    emailInput.value = 'admin@suspendre.com';
    passwordInput.value = 'Admin@123';
  } else {
    // Create a demo user if not exists
    const demoExists = false;
    if (!demoExists) {
      showToast('Demo accounts are disabled after the Supabase auth migration.', 'default');
      return;
    }
    emailInput.value = 'guest@suspendre.com';
    passwordInput.value = 'Guest@123';
  }
  showToast('Credentials filled — click Sign In.', 'success');
}
