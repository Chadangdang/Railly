(function () {
  'use strict';

  function initAboutPage() {
    var session = window.userSession;
    if (!session) {
      return;
    }

    var context = session.getUserContext();
    session.applyUserContextToLinks('.about-header .main-nav a, .about-header .brand, .about-header .user-profile-link');

    var loginLink = document.querySelector('.about-header .login-link');
    var signupBtn = document.querySelector('.about-header .signup-btn');
    var userProfileLink = document.querySelector('.about-header .user-profile-link');

    if (context && context.username && context.id) {
      if (loginLink) {
        loginLink.classList.add('is-hidden');
      }

      if (signupBtn) {
        signupBtn.classList.add('is-hidden');
      }

      if (userProfileLink) {
        userProfileLink.classList.remove('is-hidden');
        session.applyUserContextToLinks('.about-header .user-profile-link');
      }
    } else {
      if (loginLink) {
        loginLink.classList.remove('is-hidden');
        loginLink.removeAttribute('id');
        loginLink.classList.remove('logout-link');
        loginLink.href = '../Login/Login.html';
      }

      if (signupBtn) {
        signupBtn.classList.remove('is-hidden', 'user-pill');
        signupBtn.href = '../Signup/Signup.html';
      }

      if (userProfileLink) {
        userProfileLink.classList.add('is-hidden');
      }
    }
  }

  if (window.__layoutReady) {
    initAboutPage();
  } else {
    document.addEventListener('layout:ready', initAboutPage, { once: true });
  }
})();
