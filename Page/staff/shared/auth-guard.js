(function (window, document) {
  'use strict';

  var API_SESSION_PATH = '/Backend/staffSession.php';
  var LOGIN_PATH = '/Page/staff/auth/login.html';
  var CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
  var hasRedirected = false;
  var lastCheckPromise = null;
  var checkTimer = null;

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

  function redirectToLogin() {
    if (hasRedirected) {
      return;
    }

    hasRedirected = true;
    try {
      if (checkTimer) {
        window.clearInterval(checkTimer);
        checkTimer = null;
      }
    } catch (error) {
      // Ignore timer clearing errors.
    }

    var loginUrl = resolveAppPath(LOGIN_PATH);
    try {
      var current = window.location.href;
      var separator = loginUrl.indexOf('?') === -1 ? '?' : '&';
      loginUrl += separator + 'redirect=' + encodeURIComponent(current);
    } catch (error) {
      // Fallback to plain redirect if building the URL fails.
    }

    window.location.replace(loginUrl);
  }

  function handleSessionResponse(response) {
    if (response.status === 401) {
      var error = new Error('unauthorized');
      error.code = 401;
      throw error;
    }

    if (!response.ok) {
      throw new Error('Session check failed.');
    }

    return response.json();
  }

  function ensureAuthenticated() {
    if (hasRedirected) {
      return Promise.resolve();
    }

    if (lastCheckPromise) {
      return lastCheckPromise;
    }

    lastCheckPromise = fetch(resolveAppPath(API_SESSION_PATH), {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(handleSessionResponse)
      .then(function (payload) {
        if (!payload || payload.status !== 'success' || !payload.staff) {
          throw new Error('Invalid session payload.');
        }
      })
      .catch(function (error) {
        if (error && error.code === 401) {
          redirectToLogin();
          return;
        }

        // For other errors (network issues, server errors), retry after a short delay.
        window.setTimeout(function () {
          lastCheckPromise = null;
          ensureAuthenticated();
        }, 4000);
      })
      .finally(function () {
        window.setTimeout(function () {
          lastCheckPromise = null;
        }, 1000);
      });

    return lastCheckPromise;
  }

  function scheduleChecks() {
    if (checkTimer) {
      return;
    }

    checkTimer = window.setInterval(function () {
      ensureAuthenticated();
    }, CHECK_INTERVAL);
  }

  function boot() {
    ensureAuthenticated();
    scheduleChecks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
