// =========================================
//  SUSPENDRE — Signup Page
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (Auth.isLoggedIn()) {
    window.location.href = 'shop.html';
    return;
  }

  const nameInput     = document.getElementById('signupName');
  const emailInput    = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  const confirmInput  = document.getElementById('signupConfirm');
  const signupBtn     = document.getElementById('signupBtn');
  const togglePw      = document.getElementById('togglePw');
  const alertBox      = document.getElementById('authAlert');
  const confirmHint   = document.getElementById('confirmHint');

  // Requirement elements
  const reqs = {
    length:  document.getElementById('req-length'),
    upper:   document.getElementById('req-upper'),
    lower:   document.getElementById('req-lower'),
    number:  document.getElementById('req-number'),
    special: document.getElementById('req-special'),
  };

  function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';
  }
  function hideAlert() { alertBox.style.display = 'none'; }

  // Toggle password visibility
  if (togglePw) {
    togglePw.addEventListener('click', () => {
      const isText = passwordInput.type === 'text';
      passwordInput.type = isText ? 'password' : 'text';
      togglePw.textContent = isText ? 'Show' : 'Hide';
    });
  }

  // Real-time password validation
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      const checks = {
        length:  val.length >= 8,
        upper:   /[A-Z]/.test(val),
        lower:   /[a-z]/.test(val),
        number:  /[0-9]/.test(val),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(val),
      };

      Object.keys(checks).forEach(key => {
        const el = reqs[key];
        if (!el) return;
        const icon = el.querySelector('.req-icon');
        if (checks[key]) {
          el.classList.add('valid');
          el.classList.remove('invalid');
          if (icon) icon.textContent = '●';
        } else {
          el.classList.remove('valid');
          if (val.length > 0) el.classList.add('invalid');
          if (icon) icon.textContent = '○';
        }
      });

      // Also re-check confirm field
      checkConfirm();
    });
  }

  function checkConfirm() {
    if (!confirmInput || !confirmInput.value) {
      if (confirmHint) confirmHint.style.display = 'none';
      return true;
    }
    const match = passwordInput.value === confirmInput.value;
    if (confirmHint) {
      confirmHint.style.display = 'block';
      confirmHint.textContent = match ? '✓ Passwords match' : '✗ Passwords do not match';
      confirmHint.className = `field-hint ${match ? 'success' : 'error'}`;
    }
    return match;
  }

  if (confirmInput) {
    confirmInput.addEventListener('input', checkConfirm);
  }

  // Signup button
  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      hideAlert();

      const name     = nameInput ? nameInput.value : '';
      const email    = emailInput ? emailInput.value : '';
      const password = passwordInput ? passwordInput.value : '';
      const confirm  = confirmInput ? confirmInput.value : '';

      if (!checkConfirm()) {
        showAlert('Passwords do not match.', 'error');
        return;
      }
      if (password !== confirm) {
        showAlert('Passwords do not match.', 'error');
        return;
      }

      signupBtn.textContent = 'Creating account…';
      signupBtn.disabled = true;

      setTimeout(() => {
        const result = Auth.signup(name, email, password);

        if (result.success) {
          showAlert(`Welcome to SUSPENDRE, ${result.user.name}!`, 'success');
          showToast('Account created successfully!', 'success');
          setTimeout(() => { window.location.href = 'shop.html'; }, 900);
        } else {
          showAlert(result.message, 'error');
          signupBtn.textContent = 'Create Account';
          signupBtn.disabled = false;
        }
      }, 400);
    });
  }

  // Enter key
  [nameInput, emailInput, passwordInput, confirmInput].forEach(input => {
    if (input) {
      input.addEventListener('keypress', e => {
        if (e.key === 'Enter') signupBtn && signupBtn.click();
      });
    }
  });
});
