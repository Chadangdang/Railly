(function () {
  'use strict';

  var STORAGE_KEY = 'railly-cart';
  var SELECTED_KEY = 'railly-cart-selected';

  var session = null;
  var context = { username: null, id: null };

  var elements = {
    list: null,
    empty: null,
    summaryTravel: null,
    summaryQuantity: null,
    summaryTotal: null,
    purchaseBtn: null
  };

  var cartItems = [];
  var selectedItemId = null;

  function initCartPage() {
    session = window.userSession ? window.userSession : null;
    context = session ? session.getUserContext() : { username: null, id: null };

    if (!context.username || !context.id) {
      alert('Please log in to view your cart.');
      window.location.href = '../Login/Login.html';
      return;
    }

    if (session) {
      session.applyUserContextToLinks(
        '.site-header .main-nav a, .site-header .brand, .site-header .user-profile-link'
      );
    }

    cacheElements();
    loadCartFromStorage();
    renderCart();
    attachPurchaseHandler();
  }

  function cacheElements() {
    elements.list = document.getElementById('cart-list');
    elements.empty = document.getElementById('cart-empty');
    elements.summaryTravel = document.getElementById('summary-travel');
    elements.summaryQuantity = document.getElementById('summary-quantity');
    elements.summaryTotal = document.getElementById('summary-total');
    elements.purchaseBtn = document.getElementById('purchase-btn');
  }

  function loadCartFromStorage() {
    var storedMap = safelyParse(localStorage.getItem(STORAGE_KEY));
    var userIdKey = String(context.id);
    var userItems = storedMap[userIdKey];

    cartItems = Array.isArray(userItems)
      ? userItems.filter(function (item) {
          return item && Number(item.quantity) > 0;
        })
      : [];

    selectedItemId = loadSelectedItemId();

    if (!selectedItemId && cartItems.length > 0) {
      selectedItemId = cartItems[0].id;
    }
  }

  function saveCartToStorage() {
    var storedMap = safelyParse(localStorage.getItem(STORAGE_KEY));
    storedMap[String(context.id)] = cartItems;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedMap));
  }

  function safelyParse(raw) {
    if (!raw) {
      return {};
    }

    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Unable to parse stored cart data:', error);
      return {};
    }
  }

  function loadSelectedItemId() {
    var raw = localStorage.getItem(SELECTED_KEY);

    if (!raw) {
      return null;
    }

    var parts = raw.split('::');
    if (parts.length !== 2) {
      return null;
    }

    if (parts[0] !== String(context.id)) {
      return null;
    }

    return parts[1] || null;
  }

  function saveSelectedItemId(id) {
    if (!id) {
      localStorage.removeItem(SELECTED_KEY);
      return;
    }

    var value = String(context.id) + '::' + id;
    localStorage.setItem(SELECTED_KEY, value);
  }

  function renderCart() {
    if (!elements.list) {
      return;
    }

    elements.list.innerHTML = '';

    if (cartItems.length === 0) {
      if (elements.empty) {
        elements.empty.hidden = false;
      }

      updateSummary(null);
      updatePurchaseState();
      return;
    }

    if (elements.empty) {
      elements.empty.hidden = true;
    }

    var fragment = document.createDocumentFragment();

    cartItems.forEach(function (item) {
      var element = buildCartItemElement(item);
      fragment.appendChild(element);
    });

    elements.list.appendChild(fragment);

    updateSelectionStyles();
    updateSummary(findSelectedItem());
    updatePurchaseState();
  }

  function buildCartItemElement(item) {
    var listItem = document.createElement('li');
    listItem.className = 'cart-item';
    listItem.dataset.itemId = item.id;

    var selector = document.createElement('label');
    selector.className = 'cart-item__selector';

    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'selectedOrder';
    radio.value = item.id;
    radio.checked = item.id === selectedItemId;
    radio.addEventListener('change', function () {
      setSelectedItem(item.id);
    });

    var srText = document.createElement('span');
    srText.className = 'visually-hidden';
    srText.textContent =
      'Select ticket departing ' +
      formatTimeForDisplay(item.departure) +
      ' from ' +
      (item.originName || item.origin || 'Origin');

    selector.appendChild(radio);
    selector.appendChild(srText);
    listItem.appendChild(selector);

    var card = document.createElement('article');
    card.className = 'cart-ticket';

    var header = document.createElement('div');
    header.className = 'cart-ticket__header';

    var dateElement = document.createElement('span');
    dateElement.className = 'cart-ticket__date';
    dateElement.textContent = formatDateForCard(item.datee);
    header.appendChild(dateElement);

    var priceElement = document.createElement('span');
    priceElement.className = 'cart-ticket__price';
    priceElement.textContent = formatPrice(item.price) + ' Baht';
    header.appendChild(priceElement);

    card.appendChild(header);

    var body = document.createElement('div');
    body.className = 'cart-ticket__body';

    var iconWrapper = document.createElement('div');
    iconWrapper.className = 'cart-ticket__icon';
    var icon = document.createElement('img');
    icon.src = '../../../assets/img/ticket.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    iconWrapper.appendChild(icon);
    body.appendChild(iconWrapper);

    var schedule = document.createElement('div');
    schedule.className = 'cart-ticket__schedule';

    schedule.appendChild(buildTimeColumn(item.departure, item.origin, item.originCode));

    var duration = document.createElement('div');
    duration.className = 'cart-ticket__duration';
    duration.textContent = 'Travel time: ' + formatTravelDuration(item.travelMinutes);
    schedule.appendChild(duration);

    schedule.appendChild(
      buildTimeColumn(item.arrival, item.destination, item.destinationCode)
    );

    body.appendChild(schedule);

    var quantityControls = buildQuantityControls(item);
    body.appendChild(quantityControls);

    card.appendChild(body);
    listItem.appendChild(card);

    return listItem;
  }

  function buildTimeColumn(timeValue, stationName, stationCode) {
    var wrapper = document.createElement('div');
    wrapper.className = 'cart-ticket__time';

    var timeElement = document.createElement('span');
    timeElement.className = 'cart-ticket__clock';
    timeElement.textContent = formatTimeForDisplay(timeValue);
    wrapper.appendChild(timeElement);

    var stationElement = document.createElement('span');
    stationElement.className = 'cart-ticket__station';
    stationElement.textContent = formatStationLabel(stationName, stationCode);
    wrapper.appendChild(stationElement);

    return wrapper;
  }

  function buildQuantityControls(item) {
    var wrapper = document.createElement('div');
    wrapper.className = 'cart-ticket__quantity';

    var decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.className = 'quantity-btn';
    decreaseBtn.textContent = '−';
    decreaseBtn.setAttribute('aria-label', 'Decrease ticket quantity');
    decreaseBtn.addEventListener('click', function () {
      changeItemQuantity(item.id, -1);
    });

    var valueElement = document.createElement('span');
    valueElement.className = 'quantity-value';
    valueElement.textContent = String(item.quantity);

    var increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.className = 'quantity-btn';
    increaseBtn.textContent = '+';
    increaseBtn.setAttribute('aria-label', 'Increase ticket quantity');
    increaseBtn.addEventListener('click', function () {
      changeItemQuantity(item.id, 1);
    });

    wrapper.appendChild(decreaseBtn);
    wrapper.appendChild(valueElement);
    wrapper.appendChild(increaseBtn);

    return wrapper;
  }

  function changeItemQuantity(itemId, delta) {
    var index = cartItems.findIndex(function (entry) {
      return entry && entry.id === itemId;
    });

    if (index === -1) {
      return;
    }

    var item = cartItems[index];
    var currentQuantity = Number(item.quantity) || 0;
    var newQuantity = currentQuantity + delta;

    if (newQuantity <= 0) {
      cartItems.splice(index, 1);
      saveCartToStorage();
      if (selectedItemId === itemId) {
        selectedItemId = cartItems.length > 0 ? cartItems[0].id : null;
        saveSelectedItemId(selectedItemId);
      }
      renderCart();
      alert('Ticket removed from cart.');
      return;
    }

    item.quantity = newQuantity;
    saveCartToStorage();
    renderCart();
  }

  function setSelectedItem(itemId) {
    selectedItemId = itemId;
    saveSelectedItemId(itemId);
    updateSelectionStyles();
    updateSummary(findSelectedItem());
    updatePurchaseState();
  }

  function updateSelectionStyles() {
    var items = elements.list ? elements.list.children : [];

    Array.prototype.forEach.call(items, function (node) {
      if (!node || !node.classList) {
        return;
      }

      if (node.dataset.itemId === selectedItemId) {
        node.classList.add('is-selected');
        var radio = node.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.checked = true;
        }
      } else {
        node.classList.remove('is-selected');
      }
    });
  }

  function updateSummary(selectedItem) {
    if (!elements.summaryTravel || !elements.summaryQuantity || !elements.summaryTotal) {
      return;
    }

    if (!selectedItem) {
      elements.summaryTravel.textContent = 'Select a ticket to view the travel details.';
      elements.summaryQuantity.textContent = 'x0';
      elements.summaryTotal.textContent = '0 THB';
      return;
    }

    elements.summaryTravel.textContent = buildTravelSummary(selectedItem);
    elements.summaryQuantity.textContent = 'x' + selectedItem.quantity;

    var total = Number(selectedItem.price) * Number(selectedItem.quantity);
    elements.summaryTotal.textContent = formatPrice(total) + ' THB';
  }

  function updatePurchaseState() {
    if (!elements.purchaseBtn) {
      return;
    }

    var selectedItem = findSelectedItem();
    elements.purchaseBtn.disabled = !selectedItem;
  }

  function attachPurchaseHandler() {
    if (!elements.purchaseBtn) {
      return;
    }

    elements.purchaseBtn.addEventListener('click', function () {
      var selectedItem = findSelectedItem();

      if (!selectedItem) {
        alert('Please select an order to continue the payment process.');
        return;
      }

      proceedToConfirmation(selectedItem);
    });
  }

  function findSelectedItem() {
    if (!selectedItemId) {
      return null;
    }

    for (var i = 0; i < cartItems.length; i++) {
      var item = cartItems[i];
      if (item && item.id === selectedItemId) {
        return item;
      }
    }

    return null;
  }

  function buildTravelSummary(item) {
    var departureDate = formatFullDate(item.datee);
    var departureTime = formatTimeForDisplay(item.departure);
    var arrivalTime = formatTimeForDisplay(item.arrival);
    var originLabel = item.originName || item.origin || 'Origin Station';
    var destinationLabel = item.destinationName || item.destination || 'Destination Station';

    return (
      'Departure: ' +
      departureDate +
      ', ' +
      departureTime +
      ' ' +
      originLabel +
      '  Arrived: ' +
      departureDate +
      ', ' +
      arrivalTime +
      ' ' +
      destinationLabel
    );
  }

  function proceedToConfirmation(item) {
    var params = new URLSearchParams({
      routeId: item.routeId,
      origin: item.origin,
      destination: item.destination,
      departure: item.departure,
      arrival: item.arrival,
      price: item.price,
      datee: item.datee,
      quantity: item.quantity
    });

    if (context && context.username && context.id) {
      params.set('username', context.username);
      params.set('id', context.id);
    }

    window.location.href =
      '../BookingConfirmation/Bookingconfirmation.html?' + params.toString();
  }

  function formatDateForCard(dateString) {
    if (!dateString) {
      return '';
    }

    var date = parseDateValue(dateString);
    if (!date) {
      return dateString;
    }

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
      .format(date)
      .toUpperCase();
  }

  function formatFullDate(dateString) {
    var date = parseDateValue(dateString);
    if (!date) {
      return dateString || '';
    }

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function parseDateValue(value) {
    if (!value) {
      return null;
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      date = new Date(value + 'T00:00:00');
    }

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function formatTimeForDisplay(timeValue) {
    if (!timeValue) {
      return '--:--';
    }

    return String(timeValue).slice(0, 5);
  }

  function formatStationLabel(name, code) {
    var stationName = (name || '').trim();
    var stationCode = (code || '').trim();

    if (stationName && stationCode) {
      return stationName + ' (' + stationCode + ')';
    }

    return stationName || stationCode || '—';
  }

  function formatTravelDuration(minutes) {
    var numericMinutes = Number(minutes);

    if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
      return 'N/A';
    }

    var hours = Math.floor(numericMinutes / 60);
    var remaining = numericMinutes % 60;
    var parts = [];

    if (hours > 0) {
      parts.push(hours + ' ' + (hours === 1 ? 'hour' : 'hours'));
    }

    if (remaining > 0) {
      parts.push(remaining + ' ' + (remaining === 1 ? 'minute' : 'minutes'));
    }

    if (parts.length === 0) {
      return 'Less than a minute';
    }

    return parts.join(' ');
  }

  function formatPrice(value) {
    var numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return '0';
    }

    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (window.__layoutReady) {
    initCartPage();
  } else {
    document.addEventListener('layout:ready', initCartPage, { once: true });
  }
})();
