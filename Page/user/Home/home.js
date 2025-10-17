(function () {
  'use strict';

  function initHomePage() {
    var session = window.userSession;
    var bookTicketButton = document.getElementById('book-ticket-btn');

    if (session) {
      session.applyUserContextToLinks('.home-header .main-nav a, .home-header .brand, .home-header .user-profile-link');
    }

    if (bookTicketButton) {
      bookTicketButton.addEventListener('click', function () {
        var bookingUrl = new URL('../Booking/Booking.html', window.location.href);
        if (session) {
          var context = session.getUserContext();
          if (context && context.username && context.id) {
            bookingUrl.searchParams.set('username', context.username);
            bookingUrl.searchParams.set('id', context.id);
          }
        }
        window.location.href = bookingUrl.href;
      });
    }
  }

  if (window.__layoutReady) {
    initHomePage();
  } else {
    document.addEventListener('layout:ready', initHomePage, { once: true });
  }
})();
