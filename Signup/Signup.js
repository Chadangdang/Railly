function togglePassword(id) {
    const passwordField = document.getElementById(id);
    const toggleIcon = document.getElementById('toggle-password');
    if (passwordField.type === 'password') {
      passwordField.type = 'text';
      toggleIcon.classList.add('visible'); // Add class to indicate state
    } else {
      passwordField.type = 'password';
      toggleIcon.classList.remove('visible'); // Remove class to revert state
    }
  }

  async function handleSignup(event) {
    event.preventDefault(); // Prevent form submission
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const terms = document.getElementById('terms').checked;

    if (!terms) {
      alert('You must agree to the terms and conditions.');
      return;
    }

    // Send data to backend via AJAX (using Fetch API)
    const response = await fetch('../Backend/Signup.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to home page after successful signup
      alert('Signup successful!');
      window.location.href = "../Home/Home.html"; // Redirect to homepage
    } else {
      alert('Signup failed. Please try again.');
    }
  }