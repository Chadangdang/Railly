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
      ? userItems
          .filter(function (item) {
            return item && Number(item.quantity) > 0;
          })
          .sort(compareByAddedAtDesc)
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

  function compareByAddedAtDesc(a, b) {
    var aTime = a && Number(a.addedAt);
    var bTime = b && Number(b.addedAt);

    if (!Number.isFinite(aTime)) {
      aTime = 0;
    }

    if (!Number.isFinite(bTime)) {
      bTime = 0;
    }

    return bTime - aTime;
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
    var accessibleLabel =
      'Select ticket departing ' +
      formatTimeForDisplay(item.departure) +
      ' from ' +
      (item.originName || item.origin || 'Origin');
    listItem.setAttribute('aria-label', accessibleLabel);
    listItem.tabIndex = 0;
    listItem.setAttribute('role', 'button');
    listItem.setAttribute(
      'aria-pressed',
      item.id === selectedItemId ? 'true' : 'false'
    );

    if (item.id === selectedItemId) {
      listItem.classList.add('is-selected');
    }

    listItem.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.closest && target.closest('.quantity-btn')) {
        return;
      }
      setSelectedItem(item.id);
    });

    listItem.addEventListener('keydown', function (event) {
      if (event.target && event.target.closest && event.target.closest('.quantity-btn')) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        setSelectedItem(item.id);
      }
    });

    var card = document.createElement('article');
    card.className = 'cart-ticket';

    var identity = document.createElement('div');
    identity.className = 'cart-ticket__identity';

    var iconWrapper = document.createElement('div');
    iconWrapper.className = 'cart-ticket__icon';
    var icon = document.createElement('img');
    icon.src = '../../../assets/img/ticket.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    iconWrapper.appendChild(icon);
    identity.appendChild(iconWrapper);

    var dateElement = document.createElement('span');
    dateElement.className = 'cart-ticket__date';
    dateElement.textContent = formatDateForCard(item.datee);
    identity.appendChild(dateElement);

    card.appendChild(identity);

    card.appendChild(
      buildTimeColumn(item.departure, item.origin, item.originCode, 'origin')
    );
    card.appendChild(buildConnector(item.travelMinutes));
    card.appendChild(
      buildTimeColumn(
        item.arrival,
        item.destination,
        item.destinationCode,
        'destination'
      )
    );

    var actions = document.createElement('div');
    actions.className = 'cart-ticket__actions';

    var quantityControls = buildQuantityControls(item);
    actions.appendChild(quantityControls);

    var totalElement = document.createElement('span');
    totalElement.className = 'cart-ticket__total';
    var totalAmount = Number(item.price) * Number(item.quantity);
    if (!Number.isFinite(totalAmount)) {
      totalAmount = 0;
    }
    totalElement.textContent = formatPrice(totalAmount) + ' BTH';
    actions.appendChild(totalElement);

    card.appendChild(actions);
    listItem.appendChild(card);

    return listItem;
  }

  function buildTimeColumn(timeValue, stationName, stationCode, modifier) {
    var wrapper = document.createElement('div');
    var classes = ['cart-ticket__time-block'];
    if (modifier) {
      classes.push('cart-ticket__time-block--' + modifier);
    }
    wrapper.className = classes.join(' ');

    var timeElement = document.createElement('span');
    timeElement.className = 'cart-ticket__time';
    timeElement.textContent = formatTimeForDisplay(timeValue);
    wrapper.appendChild(timeElement);

    var stationElement = document.createElement('span');
    stationElement.className = 'cart-ticket__station';
    stationElement.textContent = formatStationLabel(stationName, stationCode);
    wrapper.appendChild(stationElement);

    return wrapper;
  }

  function buildConnector(travelMinutes) {
    var wrapper = document.createElement('div');
    wrapper.className = 'cart-ticket__connector';

    var line = document.createElement('span');
    line.className = 'cart-ticket__connector-line';
    line.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(line);

    var label = document.createElement('span');
    label.className = 'cart-ticket__connector-label';
    label.textContent = 'Travel time: ' + formatTravelDuration(travelMinutes);
    wrapper.appendChild(label);

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
    valueElement.setAttribute('aria-live', 'polite');

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

      var isSelected = node.dataset.itemId === selectedItemId;
      node.classList.toggle('is-selected', isSelected);
      node.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  function updateSummary(selectedItem) {
    if (
      !elements.summaryTravel ||
      !elements.summaryQuantity ||
      !elements.summaryTotal
    ) {
      return;
    }

    if (!selectedItem) {
      elements.summaryTravel.dataset.state = 'empty';
      elements.summaryTravel.textContent = 'Select a ticket to view the travel details.';
      elements.summaryQuantity.textContent = 'x0';
      elements.summaryTotal.textContent = '0 THB';
      return;
    }

    var summaryParts = buildTravelSummary(selectedItem);
    elements.summaryTravel.dataset.state = 'filled';
    elements.summaryTravel.innerHTML = '';

    if (summaryParts.route) {
      var routeLine = document.createElement('span');
      routeLine.className = 'summary-travel-details__route';
      routeLine.textContent = summaryParts.route;
      elements.summaryTravel.appendChild(routeLine);
    }

    if (summaryParts.date) {
      var dateLine = document.createElement('span');
      dateLine.className = 'summary-travel-details__date';
      dateLine.textContent = summaryParts.date;
      elements.summaryTravel.appendChild(dateLine);
    }

    if (summaryParts.timeRange) {
      var timeLine = document.createElement('span');
      timeLine.className = 'summary-travel-details__time';
      timeLine.textContent = summaryParts.timeRange;
      elements.summaryTravel.appendChild(timeLine);
    }

    elements.summaryQuantity.textContent = 'x' + selectedItem.quantity;

    var total = Number(selectedItem.price) * Number(selectedItem.quantity);
    if (!Number.isFinite(total)) {
      total = 0;
    }
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
    var destinationLabel =
      item.destinationName || item.destination || 'Destination Station';

    return {
      date: departureDate,
      route: originLabel + ' → ' + destinationLabel,
      timeRange: departureTime + ' - ' + arrivalTime
    };
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
