function updateAuthUI() {
  checkSessionExpiry(); // Check for session expiration

  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const authIcon = document.getElementById('auth-icon');
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');

  if (isLoggedIn) {
      authIcon?.classList.remove('hidden');
      loginBtn?.classList.add('hidden');
      signupBtn?.classList.add('hidden');
  } else {
      authIcon?.classList.add('hidden');
      loginBtn?.classList.remove('hidden');
      signupBtn?.classList.remove('hidden');
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  // Send login request to the server
  const response = await fetch('../Backend/Login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (data.success) {
      // Store login state and user information
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', data.username);
      localStorage.setItem('loginExpiry', Date.now() + 60 * 60 * 1000); // 1-hour session expiry

      // Update the UI and redirect to homepage
      alert(data.message);
      updateAuthUI();
      window.location.href = "../Home/Home.html";
  } else {
      // Display error message
      alert(data.message);
  }
}
