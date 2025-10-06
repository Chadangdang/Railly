document.addEventListener('DOMContentLoaded', function () {
    var session = window.userSession;
    if (!session) {
      return;
    }
  
    session.applyUserContextToLinks('.main-nav a');
  });