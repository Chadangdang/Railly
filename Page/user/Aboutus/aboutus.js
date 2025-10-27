(function () {
  'use strict';

  function initAboutPage() {
    if (!window.userSession) {
      return;
    }

    window.userSession.applyUserContextToLinks(
      '.site-header .main-nav a, .site-header .brand, .site-header .user-profile-link'
    );
  }

  if (window.__layoutReady) {
    initAboutPage();
  } else {
    document.addEventListener('layout:ready', initAboutPage, { once: true });
  }
})();
