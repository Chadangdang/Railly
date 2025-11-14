(function () {
  'use strict';

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function setMessage(messageElement, text, type) {
    if (!messageElement) {
      return;
    }

    messageElement.textContent = text || '';
    messageElement.classList.remove('is-error', 'is-success');

    if (type === 'error') {
      messageElement.classList.add('is-error');
    } else if (type === 'success') {
      messageElement.classList.add('is-success');
    }
  }

  function togglePasswordVisibility(button, input) {
    if (!button || !input) {
      return;
    }

    var isHidden = input.getAttribute('type') === 'password';
    input.setAttribute('type', isHidden ? 'text' : 'password');
    button.textContent = isHidden ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(isHidden));
    button.setAttribute('aria-label', (isHidden ? 'Hide' : 'Show') + ' password');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('staff-login-form');
    if (!form) {
      return;
    }

    var usernameInput = document.getElementById('staff-username');
    var passwordInput = document.getElementById('staff-password');
    var messageElement = document.getElementById('staff-login-message');
    var submitButton = form.querySelector('.staff-login-submit');
    var toggleButton = $('[data-role="toggle-password"]', form);

    if (toggleButton && passwordInput) {
      toggleButton.addEventListener('click', function () {
        togglePasswordVisibility(toggleButton, passwordInput);
        passwordInput.focus();
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var username = usernameInput ? usernameInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        setMessage(messageElement, 'Please enter both your username and password.', 'error');
        return;
      }

      setMessage(messageElement, 'Signing you in…');

      if (submitButton) {
        submitButton.disabled = true;
      }

      fetch('../../../Backend/staffLogin.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      })
        .then(function (response) {
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Invalid credentials.');
            }

            throw new Error('Unable to complete login. Please try again.');
          }

          return response.json();
        })
        .then(function (payload) {
          if (!payload || payload.status !== 'success') {
            var errorMessage = payload && payload.message ? payload.message : 'Invalid credentials.';
            throw new Error(errorMessage);
          }

          setMessage(messageElement, 'Login successful. Redirecting…', 'success');

          window.setTimeout(function () {
            window.location.href = '../verify/verify.html';
          }, 600);
        })
        .catch(function (error) {
          var message = error && error.message ? error.message : 'An unexpected error occurred.';
          setMessage(messageElement, message, 'error');
        })
        .finally(function () {
          if (submitButton) {
            submitButton.disabled = false;
          }
        });
    });
  });
})();
