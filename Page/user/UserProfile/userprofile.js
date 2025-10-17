(function () {
    'use strict';

    function removeLoginState() {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      localStorage.removeItem('loginExpiry');
    }

    async function fetchUserProfile(userId) {
      const statusElement = document.getElementById('profile-status');
      const nameElement = document.getElementById('user-name-value');
      const emailElement = document.getElementById('user-email-value');

      try {
        const response = await fetch(`../../../Backend/getUserProfile.php?id=${encodeURIComponent(userId)}`);

        if (!response.ok) {
          throw new Error('Failed to load user profile.');
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error(data.message || 'Unable to retrieve user details.');
        }

        nameElement.textContent = `User Name: ${data.user.username}`;
        emailElement.textContent = `Email: ${data.user.email}`;

        if (statusElement) {
          statusElement.hidden = true;
          statusElement.classList.remove('error');
          statusElement.textContent = '';
        }
      } catch (error) {
        console.error('User profile error:', error);
        nameElement.textContent = 'User Name: Unavailable';
        emailElement.textContent = 'Email: Unavailable';

        if (statusElement) {
          statusElement.hidden = false;
          statusElement.classList.add('error');
          statusElement.textContent = 'Unable to load your profile information right now. Please try again later.';
        }
      }
    }

    function initProfilePage() {
      const session = window.userSession ? window.userSession : null;
      const context = session ? session.getUserContext() : null;
      const loginLink = document.querySelector('.profile-header .login-link');
      const signupBtn = document.querySelector('.profile-header .signup-btn');
      const userProfileLink = document.querySelector('.profile-header .user-profile-link');
      const logoutBtn = document.getElementById('logout-btn');

      if (!context || !context.id) {
        removeLoginState();
        if (session) {
          session.clearUserContext();
        }
        window.location.href = '../Login/Login.html';
        return;
      }

      if (session) {
        session.applyUserContextToLinks('.profile-header .main-nav a, .profile-header .brand, .profile-header .user-profile-link');
      }

      if (loginLink) {
        loginLink.classList.add('is-hidden');
      }

      if (signupBtn) {
        signupBtn.classList.add('is-hidden');
      }

      if (userProfileLink) {
        userProfileLink.classList.remove('is-hidden');
      }

      fetchUserProfile(context.id);

      if (logoutBtn) {
        logoutBtn.addEventListener('click', function (event) {
          event.preventDefault();
          removeLoginState();
          if (session) {
            session.clearUserContext();
          }
          window.location.href = '../Home/home.html';
        });
      }
    }

    if (window.__layoutReady) {
      initProfilePage();
    } else {
      document.addEventListener('layout:ready', initProfilePage, { once: true });
    }
  })();
