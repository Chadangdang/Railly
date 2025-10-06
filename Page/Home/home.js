document.addEventListener('DOMContentLoaded', () => {
    const context = window.userSession ? window.userSession.getUserContext() : null;
  
    if (window.userSession) {
      window.userSession.applyUserContextToLinks('.main-nav a, .brand, .user-profile-link');
    }
  
    const loginLink = document.querySelector('.login-link');
    const signupBtn = document.querySelector('.signup-btn');
    const userProfileLink = document.querySelector('.user-profile-link');
  
    if (context && context.username && context.id) {
      if (loginLink) {
        loginLink.classList.add('is-hidden');
      }
  
      if (signupBtn) {
        signupBtn.classList.add('is-hidden');
      }
  
      if (userProfileLink) {
        userProfileLink.classList.remove('is-hidden');
        if (window.userSession) {
          window.userSession.applyUserContextToLinks('.user-profile-link');
        }
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
  
    const bookTicketButton = document.getElementById('book-ticket-btn');
    if (bookTicketButton) {
      bookTicketButton.addEventListener('click', () => {
        const bookingUrl = new URL('../Booking/Booking.html', window.location.href);
        if (context && context.username && context.id) {
          bookingUrl.searchParams.set('username', context.username);
          bookingUrl.searchParams.set('id', context.id);
        }
        window.location.href = bookingUrl.href;
      });
    }
  });