const passwordField = document.getElementById('password');
const togglePasswordButton = document.getElementById('toggle-password');
const togglePasswordIcon = document.getElementById('toggle-password-icon');
const signupForm = document.getElementById('signup-form');
const termsCheckbox = document.getElementById('terms');
const termsError = document.getElementById('terms-error');

if (togglePasswordButton && passwordField && togglePasswordIcon) {
  togglePasswordButton.addEventListener('click', () => {
    const isHidden = passwordField.type === 'password';
    passwordField.type = isHidden ? 'text' : 'password';
    togglePasswordIcon.src = isHidden
      ? '../../../assets/img/eye.png'
      : '../../../assets/img/eyeoff.png';
  });
}

if (termsCheckbox && termsError) {
  termsCheckbox.addEventListener('change', () => {
    if (termsCheckbox.checked) {
      termsError.textContent = '';
      termsError.classList.remove('show');
    }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', handleSignup);
}

async function handleSignup(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!termsCheckbox || !termsCheckbox.checked) {
    if (termsError) {
      termsError.textContent = 'Please agree to the terms & conditions before signing up.';
      termsError.classList.add('show');
    }
    if (termsCheckbox) {
      termsCheckbox.focus();
    }
    return;
  }

  if (termsError) {
    termsError.textContent = '';
    termsError.classList.remove('show');
  }

  try {
    const response = await fetch('../../../Backend/Signup.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (data.success) {
      alert('Signup successful!');
      window.location.href = '../Home/home.html';
    } else {
      alert(data.message || 'Signup failed. Please try again.');
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('An error occurred while signing up.');
  }
}
