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
  var expirationIntervalId = null;

  var EXPIRATION_CHECK_INTERVAL = 30 * 1000;

  function normaliseLimit(value) {
    if (value === undefined || value === null) {
      return null;
    }

    var number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    number = Math.floor(number);

    if (number < 0) {
      return null;
    }

    return number;
  }

  function collectItemLimitCandidates(item) {
    if (!item) {
      return [];
    }

    return [
      normaliseLimit(item.maxQuantity),
      normaliseLimit(item.availableTicket),
      normaliseLimit(item.available_ticket),
      normaliseLimit(item.totalTicket),
      normaliseLimit(item.total_ticket),
      normaliseLimit(item.capacity)
    ].filter(function (candidate) {
      return candidate !== null;
    });
  }

  function getItemMaxQuantity(item) {
    var candidates = collectItemLimitCandidates(item);

    if (candidates.length === 0) {
      return null;
    }

    var limit = candidates[0];

    for (var i = 1; i < candidates.length; i++) {
      if (candidates[i] < limit) {
        limit = candidates[i];
      }
    }

    return limit;
  }

  function clampItemQuantityToLimit(item) {
    if (!item) {
      return item;
    }

    var limit = getItemMaxQuantity(item);

    if (limit === null) {
      return item;
    }

    var quantity = Number(item.quantity);

    if (!Number.isFinite(quantity)) {
      item.quantity = 0;
      return item;
    }

    if (quantity > limit) {
      item.quantity = limit;
    }

    return item;
  }

  function initCartPage() {
    session = window.userSession ? window.userSession : null;
    context = session ? session.getUserContext() : { username: null, id: null };

    if (!context.username || !context.id) {
      alert('Please log in to view your cart.');
      window.location.href = '../Login/login.html';
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
    startExpirationMonitor();
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
    var userItems = Array.isArray(storedMap[userIdKey])
      ? storedMap[userIdKey]
      : null;
    var storageAdjusted = false;
    var cleanedItems = [];
    var now = new Date();

    if (Array.isArray(userItems)) {
      userItems.forEach(function (rawItem) {
        if (!rawItem) {
          return;
        }

        if (isItemDepartureInPast(rawItem, now)) {
          storageAdjusted = true;
          return;
        }

        var originalQuantity = Number(rawItem.quantity);
        clampItemQuantityToLimit(rawItem);
        var adjustedQuantity = Number(rawItem.quantity);

        if (
          Number.isFinite(originalQuantity) &&
          Number.isFinite(adjustedQuantity) &&
          originalQuantity !== adjustedQuantity
        ) {
          storageAdjusted = true;
        }

        if (adjustedQuantity > 0) {
          cleanedItems.push(rawItem);
        } else if (originalQuantity > 0) {
          storageAdjusted = true;
        }
      });

      cleanedItems.sort(compareByAddedAtDesc);
      cartItems = cleanedItems;
    } else {
      cartItems = [];
    }

    selectedItemId = loadSelectedItemId();
    ensureSelectedItemIsValid();

    if (storageAdjusted) {
      saveCartToStorage();
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

  function startExpirationMonitor() {
    if (expirationIntervalId) {
      window.clearInterval(expirationIntervalId);
    }

    if (removeExpiredItemsFromCart()) {
      renderCart();
    }

    expirationIntervalId = window.setInterval(function () {
      if (removeExpiredItemsFromCart()) {
        renderCart();
      }
    }, EXPIRATION_CHECK_INTERVAL);
  }

  function removeExpiredItemsFromCart() {
    if (cartItems.length === 0) {
      return false;
    }

    var now = new Date();
    var changed = false;

    for (var index = cartItems.length - 1; index >= 0; index--) {
      var item = cartItems[index];

      if (isItemDepartureInPast(item, now)) {
        cartItems.splice(index, 1);
        changed = true;
      }
    }

    if (changed) {
      saveCartToStorage();
      ensureSelectedItemIsValid();
    }

    return changed;
  }

  function ensureSelectedItemIsValid() {
    if (!cartItems || cartItems.length === 0) {
      if (selectedItemId) {
        selectedItemId = null;
        saveSelectedItemId(null);
      }
      return;
    }

    var fallbackItem = cartItems.find(function (entry) {
      return entry && entry.id;
    });

    if (!fallbackItem) {
      if (selectedItemId) {
        selectedItemId = null;
        saveSelectedItemId(null);
      }
      return;
    }

    if (!selectedItemId) {
      selectedItemId = fallbackItem.id;
      saveSelectedItemId(selectedItemId);
      return;
    }

    var exists = cartItems.some(function (entry) {
      return entry && entry.id === selectedItemId;
    });

    if (!exists) {
      selectedItemId = fallbackItem.id;
      saveSelectedItemId(selectedItemId);
    }
  }

  function isItemDepartureInPast(item, referenceTime) {
    if (!item) {
      return false;
    }

    var departureDate = buildDepartureDateTime(item.datee, item.departure);

    if (!departureDate) {
      return false;
    }

    var comparison =
      referenceTime instanceof Date && !Number.isNaN(referenceTime.getTime())
        ? referenceTime
        : new Date();

    return departureDate.getTime() <= comparison.getTime();
  }

  function buildDepartureDateTime(dateValue, timeValue) {
    if (!dateValue) {
      return null;
    }

    var timeComponent = normaliseTimeComponent(timeValue);

    if (!timeComponent) {
      return null;
    }

    var isoString = String(dateValue).trim() + 'T' + timeComponent;
    var candidate = new Date(isoString);

    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }

    var dateOnly = parseDateValue(dateValue);

    if (!dateOnly) {
      return null;
    }

    var parts = timeComponent.split(':');
    var hours = Number(parts[0]);
    var minutes = Number(parts[1]);
    var seconds = Number(parts[2]);
    var adjustedDate = new Date(dateOnly.getTime());
    adjustedDate.setHours(hours, minutes, seconds, 0);

    return adjustedDate;
  }

  function normaliseTimeComponent(timeValue) {
    if (!timeValue) {
      return null;
    }

    var raw = String(timeValue).trim();

    if (!raw) {
      return null;
    }

    var meridiemMatch = raw.match(/(am|pm)$/i);
    var meridiem = null;

    if (meridiemMatch) {
      meridiem = meridiemMatch[1].toLowerCase();
      raw = raw.slice(0, -meridiemMatch[0].length).trim();
    }

    raw = raw.replace(/\s+/g, '');

    if (/z$/i.test(raw)) {
      raw = raw.slice(0, -1);
    }

    if (raw.indexOf(':') === -1 && raw.indexOf('.') !== -1) {
      raw = raw.replace(/\./g, ':');
    }

    if (raw.indexOf(':') === -1) {
      if (/^\d{3,4}$/.test(raw)) {
        raw = raw.padStart(4, '0');
        raw = raw.slice(0, 2) + ':' + raw.slice(2);
      } else {
        return null;
      }
    }

    var parts = raw.split(':');

    if (parts.length < 2) {
      return null;
    }

    var hours = parts[0];
    var minutes = parts[1];
    var seconds = parts.length > 2 ? parts[2] : '00';

    var hoursNumber = Number(hours);
    var minutesNumber = Number(minutes);
    var secondsNumber = Number(seconds);

    if (
      !Number.isFinite(hoursNumber) ||
      !Number.isFinite(minutesNumber) ||
      !Number.isFinite(secondsNumber)
    ) {
      return null;
    }

    if (meridiem) {
      if (hoursNumber === 12) {
        hoursNumber = 0;
      }

      if (meridiem === 'pm') {
        hoursNumber += 12;
      }
    }

    if (
      hoursNumber < 0 ||
      hoursNumber > 23 ||
      minutesNumber < 0 ||
      minutesNumber > 59 ||
      secondsNumber < 0 ||
      secondsNumber > 59
    ) {
      return null;
    }

    var hoursString = String(hoursNumber).padStart(2, '0');
    var minutesString = String(minutesNumber).padStart(2, '0');
    var secondsString = String(secondsNumber).padStart(2, '0');

    return hoursString + ':' + minutesString + ':' + secondsString;
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

    var limit = getItemMaxQuantity(item);
    var quantity = Number(item.quantity) || 0;
    var atMax = limit !== null && quantity >= limit;

    if (limit !== null) {
      valueElement.dataset.max = String(limit);
      valueElement.title = 'Maximum ' + limit + ' tickets available';
    } else {
      delete valueElement.dataset.max;
      valueElement.removeAttribute('title');
    }

    if (atMax) {
      increaseBtn.disabled = true;
      increaseBtn.classList.add('quantity-btn--max');
      increaseBtn.setAttribute('aria-label', 'Maximum quantity reached');
      increaseBtn.title = 'Maximum quantity reached';
    } else {
      increaseBtn.disabled = false;
      increaseBtn.classList.remove('quantity-btn--max');
      increaseBtn.setAttribute('aria-label', 'Increase ticket quantity');
      increaseBtn.title = 'Increase ticket quantity';
    }

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

    if (delta > 0) {
      var limit = getItemMaxQuantity(item);
      if (limit !== null && newQuantity > limit) {
        alert('You have reached the maximum capacity for this ticket.');
        return;
      }
    }

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

      redirectToPayment(selectedItem);
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

  function redirectToPayment(item) {
    var params = new URLSearchParams({
      routeId: item.routeId,
      origin: item.origin,
      destination: item.destination,
      departure: item.departure,
      arrival: item.arrival,
      price: item.price,
      datee: item.datee,
      quantity: item.quantity,
      cartItemId: item.id
    });

    if (item.originName) {
      params.set('originName', item.originName);
    }

    if (item.destinationName) {
      params.set('destinationName', item.destinationName);
    }

    if (item.travelMinutes) {
      params.set('travelMinutes', item.travelMinutes);
    }

    if (context && context.username && context.id) {
      params.set('username', context.username);
      params.set('id', context.id);
    }

    window.location.href =
      '../Payment/payment.html?' + params.toString();
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
