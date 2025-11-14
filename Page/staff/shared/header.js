(function (window, document) {
  'use strict';

  var API_SESSION_PATH = '/Backend/staffSession.php';
  var API_LOGOUT_PATH = '/Backend/staffLogout.php';
  var LOGIN_PATH = '/Page/staff/auth/login.html';

  function resolveAppPath(path) {
    if (!path || path.charAt(0) !== '/') {
      return path;
    }

    var locationPath = window.location.pathname;
    var pageIndex = locationPath.indexOf('/Page/');
    var base = pageIndex !== -1 ? locationPath.substring(0, pageIndex) : '';
    if (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    return base + path;
  }

  function fetchStaffProfile() {
    return fetch(resolveAppPath(API_SESSION_PATH), {
      credentials: 'include',
    }).then(function (response) {
      if (response.status === 401) {
        var error = new Error('unauthorized');
        error.code = 401;
        throw error;
      }

      if (!response.ok) {
        throw new Error('Failed to load staff profile.');
      }

      return response.json();
    });
  }

  function performLogout() {
    return fetch(resolveAppPath(API_LOGOUT_PATH), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(function () {
      // Ignore fetch errors and continue with redirect.
    }).finally(function () {
      window.location.href = resolveAppPath(LOGIN_PATH);
    });
  }

  function applyPageTitle(headerElement) {
    var titleTarget = headerElement.querySelector('[data-role="staff-page-title"]');
    if (!titleTarget) {
      return;
    }

    var placeholder = headerElement.__includePlaceholder;
    if (placeholder && placeholder.getAttribute) {
      var desiredTitle = placeholder.getAttribute('data-staff-title');
      if (desiredTitle) {
        titleTarget.textContent = desiredTitle;
        return;
      }
    }

    if (document.title) {
      titleTarget.textContent = document.title.replace(/\s*[-|].*$/, '').trim() || document.title.trim();
    }
  }

  function initialiseHeader() {
    var headerElement = document.querySelector('.staff-app-bar');
    if (!headerElement) {
      return false;
    }

    applyPageTitle(headerElement);

    var nameElement = headerElement.querySelector('[data-role="staff-username"]');
    var logoutButton = headerElement.querySelector('[data-role="staff-logout"]');

    if (logoutButton) {
      logoutButton.addEventListener('click', function () {
        if (logoutButton.disabled) {
          return;
        }
        logoutButton.disabled = true;
        performLogout();
      });
    }

    fetchStaffProfile()
      .then(function (payload) {
        if (!payload || payload.status !== 'success' || !payload.staff) {
          throw new Error('Invalid response payload.');
        }

        if (nameElement) {
          var username = payload.staff.username || 'Staff';
          nameElement.textContent = username;
        }
      })
      .catch(function (error) {
        if (error && error.code === 401) {
          window.location.href = resolveAppPath(LOGIN_PATH);
          return;
        }

        console.error(error);
        if (nameElement) {
          nameElement.textContent = 'Staff';
        }
      });

    return true;
  }

  function whenReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function boot() {
    if (initialiseHeader()) {
      return;
    }

    var observer = new MutationObserver(function () {
      if (initialiseHeader()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  whenReady(function () {
    if (window.__layoutReady) {
      boot();
      return;
    }

    document.addEventListener(
      'layout:ready',
      function () {
        boot();
      },
      { once: true }
    );
  });
})(window, document);
