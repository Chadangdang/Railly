const loginForm = document.getElementById('login-form');
const passwordField = document.getElementById('pass');
const togglePasswordButton = document.querySelector('.toggle-password');
const togglePasswordIcon = document.getElementById('toggle-password-icon');

function togglePassword() {
  const isHidden = passwordField.type === 'password';
  passwordField.type = isHidden ? 'text' : 'password';
  togglePasswordIcon.src = isHidden
    ? '../../../assets/img/eye.png'
    : '../../../assets/img/eyeoff.png';
}

async function handleLogin(event) {
  event.preventDefault();

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('pass').value.trim();

  console.log('Identifier:', identifier);
  console.log('Password:', password);

  try {
    const response = await fetch('../../../Backend/Login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    console.log('Server response status:', response.status);

    const responseData = await response.json();
    console.log('Login data:', responseData);

    if (responseData.success) {
      const userId = responseData.user.id;
      const loggedInUsername = responseData.user.username;

      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', loggedInUsername);
      localStorage.setItem('userId', userId);
      localStorage.setItem('loginExpiry', Date.now() + 60 * 60 * 1000);

      alert(responseData.message);

      window.location.href = `../Home/home.html?username=${encodeURIComponent(loggedInUsername)}&id=${encodeURIComponent(userId)}`;
    } else {
      alert(responseData.message);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('An error occurred while logging in.');
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (togglePasswordButton) {
  togglePasswordButton.addEventListener('click', togglePassword);
}