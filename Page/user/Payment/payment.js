(function () {
  'use strict';

  var STORAGE_KEY = 'railly-cart';
  var SELECTED_KEY = 'railly-cart-selected';

  var session = null;
  var context = { username: null, id: null };
  var ticketData = null;
  var selectedMethod = null;

  var elements = {
    ticketName: null,
    ticketPrice: null,
    quantity: null,
    travelDate: null,
    route: null,
    total: null,
    form: null,
    continueBtn: null,
    methodTitle: null,
    methodDescription: null
  };

  var METHOD_COPY = {
    promptpay: {
      title: 'Pay via QR PromptPay',
      description:
        'Payment via PromptPay. You will be redirected to PromptPay to complete the transaction.'
    },
    card: {
      title: 'Credit / Debit card',
      description:
        'Pay securely with your credit or debit card. You will be redirected to our payment partner to complete the purchase.'
    },
    truemoney: {
      title: 'TrueMoney',
      description:
        'Pay with your TrueMoney Wallet. You will be redirected to TrueMoney to authorise the payment.'
    }
  };

  function initPaymentPage() {
    session = window.userSession ? window.userSession : null;
    context = session ? session.getUserContext() : { username: null, id: null };

    cacheElements();

    if (session) {
      session.applyUserContextToLinks(
        '.site-header .main-nav a, .site-header .brand, .site-header .user-profile-link'
      );
    }

    ticketData = parseTicketData();
    renderSummary(ticketData);
    attachEventHandlers();
    updateMethodDisplay(null);
    updateContinueState();
  }

  function cacheElements() {
    elements.ticketName = document.getElementById('summary-ticket-name');
    elements.ticketPrice = document.getElementById('summary-ticket-price');
    elements.quantity = document.getElementById('summary-quantity');
    elements.travelDate = document.getElementById('summary-travel-date');
    elements.route = document.getElementById('summary-route');
    elements.total = document.getElementById('summary-total');
    elements.form = document.getElementById('payment-method-form');
    elements.continueBtn = document.getElementById('continue-btn');
    elements.methodTitle = document.getElementById('selected-method-title');
    elements.methodDescription = document.getElementById('selected-method-description');
  }

  function parseTicketData() {
    var params = new URLSearchParams(window.location.search);
    var data = {
      routeId: params.get('routeId'),
      origin: params.get('origin'),
      originName: params.get('originName'),
      destination: params.get('destination'),
      destinationName: params.get('destinationName'),
      departure: params.get('departure'),
      arrival: params.get('arrival'),
      rawPrice: params.get('price'),
      rawQuantity: params.get('quantity'),
      datee: params.get('datee'),
      cartItemId: params.get('cartItemId'),
      travelMinutes: params.get('travelMinutes')
    };

    var username = context.username || params.get('username');
    var userId = context.id || params.get('id');

    if (session && session.persistUserContext && username && userId) {
      session.persistUserContext({ username: username, id: userId });
      context = session.getUserContext();
      username = context.username;
      userId = context.id;
    }

    data.username = username;
    data.userId = userId;

    var unitPrice = Number(data.rawPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      unitPrice = 0;
    }
    data.unitPrice = unitPrice;

    var quantity = Number(data.rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      quantity = 1;
    }
    data.quantity = quantity;
    data.total = unitPrice * quantity;

    data.originLabel = data.originName || data.origin || 'Origin Station';
    data.destinationLabel =
      data.destinationName || data.destination || 'Destination Station';

    data.travelDateLabel = formatFullDate(data.datee) || data.datee || '';
    data.routeSummary = buildRouteSummary(data);

    data.isValid = Boolean(
      data.routeId &&
      data.origin &&
      data.destination &&
      data.departure &&
      data.arrival &&
      Number.isFinite(unitPrice)
    );

    return data;
  }

  function buildRouteSummary(data) {
    var departureTime = formatTimeForDisplay(data.departure);
    var arrivalTime = formatTimeForDisplay(data.arrival);

    var originLabel = data.originLabel || '';
    var destinationLabel = data.destinationLabel || '';

    var departureLine = 'Departure: ';
    if (departureTime) {
      departureLine += departureTime + ' ';
    }
    departureLine += '---- ' + originLabel;

    var arrivalLine = 'Arrived: ';
    if (arrivalTime) {
      arrivalLine += arrivalTime + ' ';
    }
    arrivalLine += '---- ' + destinationLabel;

    return [departureLine, arrivalLine];
  }

  function attachEventHandlers() {
    if (!elements.form) {
      return;
    }

    elements.form.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || target.name !== 'paymentMethod') {
        return;
      }

      selectedMethod = target.value || null;
      updateMethodDisplay(selectedMethod);
      updateContinueState();
    });

    elements.form.addEventListener('submit', function (event) {
      event.preventDefault();
      handleFormSubmission();
    });
  }

  function updateMethodDisplay(methodKey) {
    var copy = methodKey ? METHOD_COPY[methodKey] : null;

    if (elements.methodTitle) {
      elements.methodTitle.textContent = copy
        ? copy.title
        : 'Select a payment method';
    }

    if (elements.methodDescription) {
      elements.methodDescription.textContent = copy
        ? copy.description
        : 'Choose one of the payment methods to view additional instructions.';
    }
  }

  function updateContinueState() {
    if (!elements.continueBtn) {
      return;
    }

    var isReady = Boolean(
      selectedMethod && ticketData && ticketData.isValid
    );

    elements.continueBtn.disabled = !isReady;
  }

  function renderSummary(data) {
    if (!elements.ticketName) {
      return;
    }

    if (!data || !data.isValid) {
      elements.ticketName.textContent = 'Unable to load ticket information.';
      if (elements.ticketPrice) {
        elements.ticketPrice.textContent = '';
      }
      if (elements.quantity) {
        elements.quantity.textContent = '';
      }
      if (elements.travelDate) {
        elements.travelDate.textContent = '';
      }
      if (elements.route) {
        elements.route.textContent = '';
      }
      if (elements.total) {
        elements.total.textContent = '';
      }
      showError(
        'We could not retrieve the ticket details required to process the payment.'
      );
      return;
    }

    elements.ticketName.textContent =
      data.originLabel + ' → ' + data.destinationLabel;

    if (elements.ticketPrice) {
      elements.ticketPrice.textContent = formatCurrency(data.unitPrice);
    }

    if (elements.quantity) {
      elements.quantity.textContent = 'x' + data.quantity;
    }

    if (elements.travelDate) {
      elements.travelDate.textContent = data.travelDateLabel;
    }

    if (elements.route) {
      if (Array.isArray(data.routeSummary)) {
        var sanitizedLines = data.routeSummary
          .filter(Boolean)
          .map(function (line) {
            return escapeHtml(line);
          });
        elements.route.innerHTML = sanitizedLines.join('<br />');
      } else {
        elements.route.textContent = data.routeSummary || '';
      }
    }

    if (elements.total) {
      elements.total.textContent = formatCurrency(data.total);
    }
  }

  function handleFormSubmission() {
    if (!selectedMethod) {
      alert('Please select a payment method to continue.');
      return;
    }

    if (!ticketData || !ticketData.isValid) {
      alert('Ticket details are missing. Please return to the cart and try again.');
      return;
    }

    if (!ticketData.username || !ticketData.userId) {
      alert('Please log in to continue with the payment.');
      return;
    }

    setLoadingState(true);

    var formData = new FormData();
    formData.append('route_id', ticketData.routeId);
    formData.append('username', ticketData.username);
    formData.append('id', ticketData.userId);
    formData.append('origin', ticketData.origin);
    formData.append('destination', ticketData.destination);
    formData.append('departure', ticketData.departure);
    formData.append('arrival', ticketData.arrival);
    formData.append('price', ticketData.total);
    formData.append('quantity', ticketData.quantity);

    if (Number.isFinite(ticketData.unitPrice)) {
      formData.append('unit_price', ticketData.unitPrice);
    }
    formData.append('payment_method', selectedMethod);

    fetch('../../../Backend/confirm.php', {
      method: 'POST',
      body: formData
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result && result.status === 'success') {
          handlePaymentSuccess(result);
        } else {
          var message =
            (result && result.message) ||
            'We were unable to complete the payment. Please try again.';
          alert(message);
        }
      })
      .catch(function (error) {
        console.error('Payment error:', error);
        alert('An unexpected error occurred while processing the payment.');
      })
      .finally(function () {
        setLoadingState(false);
      });
  }

  function handlePaymentSuccess(result) {
    alert(result && result.message ? result.message : 'Payment completed.');
    removePurchasedItem();

    var params = new URLSearchParams({
      username: ticketData.username,
      id: ticketData.userId
    });

    window.location.href =
      '../MyTicket/MyTicket.html?' + params.toString();
  }

  function removePurchasedItem() {
    if (!ticketData || !ticketData.cartItemId || !ticketData.userId) {
      return;
    }

    var rawMap = localStorage.getItem(STORAGE_KEY);
    if (!rawMap) {
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(rawMap);
    } catch (error) {
      console.warn('Unable to parse stored cart data:', error);
      return;
    }

    var userKey = String(ticketData.userId);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed[userKey])) {
      return;
    }

    parsed[userKey] = parsed[userKey].filter(function (item) {
      return !(item && item.id === ticketData.cartItemId);
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.warn('Unable to update cart storage:', error);
    }

    var selectedValue = localStorage.getItem(SELECTED_KEY);
    var expected = String(ticketData.userId) + '::' + ticketData.cartItemId;
    if (selectedValue === expected) {
      localStorage.removeItem(SELECTED_KEY);
    }
  }

  function setLoadingState(isLoading) {
    if (!elements.continueBtn) {
      return;
    }

    elements.continueBtn.disabled = true;

    if (isLoading) {
      elements.continueBtn.dataset.originalText = elements.continueBtn.textContent;
      elements.continueBtn.textContent = 'PROCESSING...';
    } else {
      var original = elements.continueBtn.dataset.originalText || 'CONTINUE';
      elements.continueBtn.textContent = original;
      updateContinueState();
    }
  }

  function showError(message) {
    if (elements.methodTitle) {
      elements.methodTitle.textContent = 'Unable to load payment details';
    }

    if (elements.methodDescription) {
      elements.methodDescription.textContent = message;
    }

    if (elements.continueBtn) {
      elements.continueBtn.disabled = true;
    }
  }

  function formatCurrency(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }

    return (
      numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' THB'
    );
  }

  function formatFullDate(value) {
    if (!value) {
      return '';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      date = new Date(value + 'T00:00:00');
    }

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function formatTimeForDisplay(timeValue) {
    if (!timeValue) {
      return '--:--';
    }

    var stringValue = String(timeValue).trim();

    if (stringValue.includes(':')) {
      return stringValue.slice(0, 5);
    }

    if (stringValue.length === 4) {
      return stringValue.slice(0, 2) + ':' + stringValue.slice(2);
    }

    return stringValue;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (window.__layoutReady) {
    initPaymentPage();
  } else {
    document.addEventListener('layout:ready', initPaymentPage, { once: true });
  }
})();
