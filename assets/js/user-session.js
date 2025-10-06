(function (window) {
    'use strict';
  
    var STORAGE_KEYS = {
      username: 'railly.username',
      id: 'railly.userId'
    };
  
    function persistUserContext(context) {
      if (!context || typeof context !== 'object') {
        return;
      }
  
      if (typeof context.username === 'string' && context.username.trim() !== '') {
        sessionStorage.setItem(STORAGE_KEYS.username, context.username.trim());
      }
  
      if (context.id !== undefined && context.id !== null && String(context.id).trim() !== '') {
        sessionStorage.setItem(STORAGE_KEYS.id, String(context.id).trim());
      }
    }
  
    function readQueryContext() {
      var params = new URLSearchParams(window.location.search);
      var username = params.get('username');
      var id = params.get('id');
  
      if (username && id) {
        var context = { username: username, id: id };
        persistUserContext(context);
        return context;
      }
  
      return null;
    }
  
    function getStoredContext() {
      var username = sessionStorage.getItem(STORAGE_KEYS.username);
      var id = sessionStorage.getItem(STORAGE_KEYS.id);
  
      if (username && id) {
        return { username: username, id: id };
      }
  
      return { username: username || null, id: id || null };
    }
  
    function getUserContext() {
      return readQueryContext() || getStoredContext();
    }
  
    function clearUserContext() {
      sessionStorage.removeItem(STORAGE_KEYS.username);
      sessionStorage.removeItem(STORAGE_KEYS.id);
    }
  
    function bindLogoutHandlers(selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        element.addEventListener('click', function () {
          clearUserContext();
        });
      });
    }
  
    function applyUserContextToLinks(selector) {
      var context = getUserContext();
      if (!context.username || !context.id) {
        return;
      }
  
      var links = document.querySelectorAll(selector);
      links.forEach(function (link) {
        var url = new URL(link.getAttribute('href'), window.location.origin);
        url.searchParams.set('username', context.username);
        url.searchParams.set('id', context.id);
        link.setAttribute('href', url.pathname + url.search + url.hash);
      });
    }
  
    window.userSession = {
      applyUserContextToLinks: applyUserContextToLinks,
      bindLogoutHandlers: bindLogoutHandlers,
      clearUserContext: clearUserContext,
      getUserContext: getUserContext,
      persistUserContext: persistUserContext
    };
  
    document.addEventListener('DOMContentLoaded', function () {
      bindLogoutHandlers('#logout-btn');
    });
  })(window);