(function () {
    'use strict';
  
    var READY_EVENT = 'layout:ready';
  
    function applyActiveNav(headerElement, activeKey) {
      if (!activeKey) {
        return;
      }
  
      var normalizedKey = activeKey.trim().toLowerCase();
      if (!normalizedKey) {
        return;
      }
  
      headerElement.querySelectorAll('[data-page]').forEach(function (link) {
        var pageKey = link.getAttribute('data-page');
        if (pageKey && pageKey.trim().toLowerCase() === normalizedKey) {
          link.classList.add('active');
        }
      });
    }
  
    function updateAuthState(headerElement) {
      var session = window.userSession;
      if (session) {
        session.applyUserContextToLinks('.main-nav a, .brand, .user-profile-link');
      }
  
      var context = session ? session.getUserContext() : null;
      var loginLink = headerElement.querySelector('.login-link');
      var signupBtn = headerElement.querySelector('.signup-btn');
      var profileLink = headerElement.querySelector('.user-profile-link');
  
      if (context && context.username && context.id) {
        if (loginLink) {
          loginLink.classList.add('is-hidden');
        }
  
        if (signupBtn) {
          signupBtn.classList.add('is-hidden');
          signupBtn.classList.remove('user-pill');
        }
  
        if (profileLink) {
          profileLink.classList.remove('is-hidden');
          if (session) {
            session.applyUserContextToLinks('.user-profile-link');
          }
        }
      } else {
        if (loginLink) {
          loginLink.classList.remove('is-hidden');
          loginLink.removeAttribute('id');
          loginLink.classList.remove('logout-link');
          loginLink.setAttribute('href', '../Login/Login.html');
        }
  
        if (signupBtn) {
          signupBtn.classList.remove('is-hidden', 'user-pill');
          signupBtn.setAttribute('href', '../Signup/Signup.html');
        }
  
        if (profileLink) {
          profileLink.classList.add('is-hidden');
        }
      }
    }
  
    function applyExtraClasses(element, placeholder) {
      var extraClasses = placeholder.getAttribute('data-include-class');
      if (!extraClasses) {
        return;
      }
  
      extraClasses.split(/\s+/).forEach(function (cls) {
        if (cls) {
          element.classList.add(cls);
        }
      });
    }
  
    function handleComponentInsertion(placeholder, fragmentRoot) {
      applyExtraClasses(fragmentRoot, placeholder);
  
      if (fragmentRoot.matches('.site-header, .auth-header')) {
        var activePage = placeholder.getAttribute('data-nav-active');
        applyActiveNav(fragmentRoot, activePage);
        updateAuthState(fragmentRoot);
      }
    }
  
    function loadComponent(placeholder) {
      var source = placeholder.getAttribute('data-include');
      if (!source) {
        placeholder.remove();
        return Promise.resolve();
      }
  
      return fetch(source)
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Failed to load component: ' + source);
          }
          return response.text();
        })
        .then(function (markup) {
          var template = document.createElement('template');
          template.innerHTML = markup.trim();
          var fragment = template.content;
          var rootElement = fragment.firstElementChild;
  
          if (!rootElement) {
            placeholder.remove();
            return;
          }
  
          handleComponentInsertion(placeholder, rootElement);
          placeholder.replaceWith(fragment);
        })
        .catch(function (error) {
          console.error(error);
          placeholder.remove();
        });
    }
  
    document.addEventListener('DOMContentLoaded', function () {
      var placeholders = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
  
      if (placeholders.length === 0) {
        window.__layoutReady = true;
        document.dispatchEvent(new CustomEvent(READY_EVENT));
        return;
      }
  
      var loaders = placeholders.map(loadComponent);
  
      Promise.allSettled(loaders).then(function () {
        window.__layoutReady = true;
        document.dispatchEvent(new CustomEvent(READY_EVENT));
        document.querySelectorAll('.site-header, .auth-header')
        .forEach(function (el) { updateAuthState(el); });
      });
    });
  })();