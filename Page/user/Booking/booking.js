(function () {
  'use strict';

  var session = null;
  var context = { username: null, id: null };

  function initBookingPage() {
    session = window.userSession ? window.userSession : null;
    context = session ? session.getUserContext() : { username: null, id: null };

    if (!context.username || !context.id) {
      alert('Please log in to search and book tickets.');
      window.location.href = '../Login/Login.html';
      return;
    }

    if (session) {
      session.applyUserContextToLinks(
        '.site-header .main-nav a, .site-header .brand, .site-header .user-profile-link'
      );
    }

    initialiseDateField();
    attachFormHandler();
    loadStations();
    loadTodayTickets();
  }

  function attachFormHandler() {
    var form = document.getElementById('booking-search-form');

    if (!form) {
      return;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      handleSearch();
    });
  }

  function initialiseDateField() {
    var dateInput = document.getElementById('datee');

    if (!dateInput) {
      return;
    }

    var today = new Date();
    setTimeToStartOfDay(today);

    var maxDate = new Date(today);
    var currentDay = today.getDate();
    maxDate.setMonth(maxDate.getMonth() + 1);

    if (maxDate.getDate() !== currentDay) {
      maxDate.setDate(0);
    }

    var minDateValue = toDateInputValue(today);
    dateInput.setAttribute('min', minDateValue);
    dateInput.setAttribute('max', toDateInputValue(maxDate));
    dateInput.value = minDateValue;
  }

  function setTimeToStartOfDay(date) {
    date.setHours(0, 0, 0, 0);
  }

  function toDateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function loadStations() {
    fetch('../../../Backend/getStations.php')
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No station data returned');
        }

        populateStationSelect('origin', data, 'Origin Station');
        populateStationSelect('dest', data, 'Destination Station');
      })
      .catch(function (error) {
        console.error('Unable to load stations:', error);
      });
  }

  function populateStationSelect(selectId, stations, placeholderText) {
    var select = document.getElementById(selectId);

    if (!select) {
      return;
    }

    var placeholderOption = select.querySelector('option[value=""]');

    select.innerHTML = '';

    if (placeholderOption) {
      placeholderOption.selected = true;
      select.appendChild(placeholderOption);
    } else {
      var createdPlaceholder = document.createElement('option');
      createdPlaceholder.value = '';
      createdPlaceholder.textContent = placeholderText;
      createdPlaceholder.disabled = true;
      createdPlaceholder.selected = true;
      select.appendChild(createdPlaceholder);
    }

    stations
      .slice()
      .sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .forEach(function (station) {
        var option = document.createElement('option');
        option.value = station.name || station.code || station.id || '';
        option.textContent = buildStationLabel(station);
        select.appendChild(option);
      });
  }

  function buildStationLabel(station) {
    var name = String(station.name || '').trim();
    var code = String(station.code || '').trim();

    if (name && code) {
      return name + ' (' + code + ')';
    }

    return name || code || 'Unknown Station';
  }

  function loadTodayTickets() {
    var today = new Date();
    setTimeToStartOfDay(today);
    var todayValue = toDateInputValue(today);

    fetchTickets(
      {
        mode: 'today',
        datee: todayValue
      },
      {
        heading: 'Today Ticket',
        subheading: buildTodaySubheading(today)
      }
    );
  }

  function buildTodaySubheading(date) {
    var formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return 'Showing departures for ' + formatter.format(date) + ' sorted by travel time.';
  }

  function handleSearch() {
    var originSelect = document.getElementById('origin');
    var destSelect = document.getElementById('dest');
    var dateInput = document.getElementById('datee');

    if (!originSelect || !destSelect || !dateInput) {
      return;
    }

    var origin = originSelect.value;
    var destination = destSelect.value;
    var dateValue = dateInput.value;

    if (!origin || !destination || !dateValue) {
      alert('Please fill in Origin, Destination, and Date to search for tickets.');
      return;
    }

    fetchTickets(
      {
        mode: 'search',
        origin: origin,
        dest: destination,
        datee: dateValue
      },
      {
        heading: 'Search Results',
        subheading: buildSearchSubheading(originSelect, destSelect, dateValue)
      }
    );
  }

  function buildSearchSubheading(originSelect, destSelect, dateValue) {
    var originLabel = getSelectedOptionText(originSelect);
    var destLabel = getSelectedOptionText(destSelect);
    var formattedDate = formatDateForDisplay(dateValue);

    return 'Showing departures from ' + originLabel + ' to ' + destLabel + ' on ' + formattedDate + '.';
  }

  function getSelectedOptionText(select) {
    if (!select) {
      return '';
    }

    var selectedOption = select.options[select.selectedIndex];
    return selectedOption ? selectedOption.textContent : '';
  }

  function fetchTickets(queryParams, headingMeta) {
    var query = new URLSearchParams(queryParams);

    fetch('../../../Backend/getTickets.php?' + query.toString())
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (Array.isArray(data)) {
          renderTickets(data, headingMeta);
          return;
        }

        if (data && data.status === 'error') {
          renderMessage(data.message || 'No tickets found for the given criteria.', headingMeta);
          return;
        }

        renderMessage('No tickets found for the given criteria.', headingMeta);
      })
      .catch(function () {
        renderMessage('Unable to fetch tickets right now. Please try again later.');
      });
  }

  function renderTickets(tickets, headingMeta) {
    var container = document.getElementById('ticket-results');

    if (!container) {
      return;
    }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      renderMessage('No tickets found for the given criteria.', headingMeta);
      return;
    }

    container.innerHTML = '';

    var sortedTickets = tickets
      .map(function (ticket) {
        var travelMinutes = calculateTravelMinutes(ticket.departure, ticket.arrival);
        return Object.assign({}, ticket, { travelMinutes: travelMinutes });
      })
      .sort(function (a, b) {
        return a.travelMinutes - b.travelMinutes;
      });

    sortedTickets.forEach(function (ticket) {
      container.appendChild(buildTicketCard(ticket));
    });

    applyHeadingMeta(headingMeta);
  }

  function renderMessage(message, headingMeta) {
    var container = document.getElementById('ticket-results');

    if (!container) {
      return;
    }

    container.innerHTML = '<p>' + message + '</p>';
    applyHeadingMeta(headingMeta);
  }

  function applyHeadingMeta(headingMeta) {
    var heading = document.getElementById('tickets-heading');
    var subheading = document.getElementById('tickets-subheading');

    if (!heading || !subheading) {
      return;
    }

    if (headingMeta && headingMeta.heading) {
      heading.textContent = headingMeta.heading;
    }

    if (headingMeta && headingMeta.subheading) {
      subheading.textContent = headingMeta.subheading;
    }
  }

  function buildTicketCard(ticket) {
    var card = document.createElement('div');
    card.className = 'ticket-card';
    card.setAttribute('role', 'listitem');

    var iconWrapper = document.createElement('div');
    iconWrapper.className = 'ticket-icon';
    iconWrapper.setAttribute('aria-hidden', 'true');
    var icon = document.createElement('img');
    icon.src = '../../../assets/img/ticket.png';
    icon.alt = 'Ticket stub';
    iconWrapper.appendChild(icon);
    card.appendChild(iconWrapper);

    var dateElement = document.createElement('div');
    dateElement.className = 'ticket-date';
    dateElement.textContent = formatDateForDisplay(ticket.datee);
    card.appendChild(dateElement);

    var originBlock = buildTimeBlock(
      ticket.departure,
      ticket.origin,
      ticket.origin_code,
      'Origin station'
    );
    originBlock.classList.add('time-block--origin');
    card.appendChild(originBlock);

    card.appendChild(buildTravelDurationBlock(ticket.travelMinutes));

    var destinationBlock = buildTimeBlock(
      ticket.arrival,
      ticket.dest,
      ticket.dest_code,
      'Destination station'
    );
    destinationBlock.classList.add('time-block--destination');
    card.appendChild(destinationBlock);

    var priceElement = document.createElement('div');
    priceElement.className = 'ticket-price';
    priceElement.textContent = formatPrice(ticket.price);
    card.appendChild(priceElement);

    var actions = document.createElement('div');
    actions.className = 'ticket-actions';

    var availableCount = normaliseNumber(ticket.available_ticket);
    var availabilityText = formatAvailability(ticket);
    if (availabilityText) {
      var availabilityElement = document.createElement('div');
      availabilityElement.className = 'ticket-availability';
      availabilityElement.textContent = availabilityText;
      actions.appendChild(availabilityElement);
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = availableCount > 0 ? 'ADD TO CART' : 'SOLD OUT';
    button.disabled = availableCount <= 0;
    button.addEventListener('click', function () {
      addTicketToCart(ticket, card);
    });
    actions.appendChild(button);

    card.appendChild(actions);

    return card;
  }

  function buildTimeBlock(time, stationName, stationCode, ariaLabel) {
    var wrapper = document.createElement('div');
    wrapper.className = 'time-block';

    var timeElement = document.createElement('div');
    timeElement.className = 'time';
    timeElement.textContent = time || '--:--';
    wrapper.appendChild(timeElement);

    var stationElement = document.createElement('div');
    stationElement.className = 'station';
    var displayCode = formatStationCode(stationCode, stationName);
    stationElement.textContent = displayCode;

    if (stationName && stationName !== displayCode) {
      stationElement.title = stationName + (stationCode ? ' (' + stationCode + ')' : '');
    }

    if (ariaLabel) {
      stationElement.setAttribute('aria-label', ariaLabel + ': ' + (stationName || displayCode || '')); 
    }

    wrapper.appendChild(stationElement);

    return wrapper;
  }

  function buildTravelDurationBlock(travelMinutes) {
    var wrapper = document.createElement('div');
    wrapper.className = 'schedule-connector';

    var line = document.createElement('span');
    line.className = 'schedule-connector__line';
    line.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(line);

    var label = document.createElement('span');
    label.className = 'schedule-connector__label';
    label.textContent = 'Travel time: ' + formatTravelDuration(travelMinutes);
    wrapper.appendChild(label);

    return wrapper;
  }

  function formatStationCode(code, fallback) {
    var trimmedCode = String(code || '').trim();

    if (trimmedCode) {
      return trimmedCode.toUpperCase();
    }

    var fallbackText = String(fallback || '').trim();

    if (!fallbackText) {
      return '';
    }

    var codeFromName = fallbackText.match(/\(([A-Za-z0-9]{2,})\)\s*$/);

    if (codeFromName && codeFromName[1]) {
      return codeFromName[1].toUpperCase();
    }

    var condensed = fallbackText.replace(/[^A-Za-z0-9]/g, '');

    if (!condensed) {
      return fallbackText;
    }

    return condensed.substring(0, Math.min(4, condensed.length)).toUpperCase();
  }

  function formatAvailability(ticket) {
    var availableCount = normaliseNumber(ticket.available_ticket);
    var totalCount = normaliseNumber(ticket.total_ticket || ticket.capacity);

    if (availableCount < 0 && totalCount < 0) {
      return '';
    }

    if (availableCount >= 0 && totalCount > 0) {
      return 'Available: ' + availableCount + '/' + totalCount;
    }

    if (availableCount >= 0) {
      return 'Available: ' + availableCount;
    }

    if (totalCount > 0) {
      return 'Capacity: ' + totalCount;
    }

    return '';
  }

  function normaliseNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : -1;
  }

  function calculateTravelMinutes(departure, arrival) {
    var departureMinutes = parseTimeToMinutes(departure);
    var arrivalMinutes = parseTimeToMinutes(arrival);

    if (departureMinutes < 0 || arrivalMinutes < 0) {
      return Number.MAX_SAFE_INTEGER;
    }

    var difference = arrivalMinutes - departureMinutes;

    if (difference <= 0) {
      difference += 24 * 60;
    }

    return difference;
  }

  function parseTimeToMinutes(timeValue) {
    if (!timeValue) {
      return -1;
    }

    var parts = String(timeValue).split(':');

    if (parts.length < 2) {
      return -1;
    }

    var hours = Number(parts[0]);
    var minutes = Number(parts[1]);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return -1;
    }

    return hours * 60 + minutes;
  }

  function formatTravelDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes === Number.MAX_SAFE_INTEGER) {
      return 'N/A';
    }

    var hours = Math.floor(minutes / 60);
    var remainingMinutes = minutes % 60;
    var parts = [];

    if (hours > 0) {
      parts.push(hours + ' ' + (hours === 1 ? 'hour' : 'hours'));
    }

    if (remainingMinutes > 0) {
      parts.push(remainingMinutes + ' ' + (remainingMinutes === 1 ? 'minute' : 'minutes'));
    }

    if (parts.length === 0) {
      return 'Less than a minute';
    }

    return parts.join(' ');
  }

  function formatDateForDisplay(dateString) {
    if (!dateString) {
      return '';
    }

    var date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      date = new Date(dateString + 'T00:00:00');
    }

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    var formatter = new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return formatter.format(date).toUpperCase();
  }

  function formatPrice(price) {
    var value = Number(price);

    if (!Number.isFinite(value)) {
      return String(price || '');
    }

    return value.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' THB';
  }

  function addTicketToCart(ticket, cardElement) {
    var latestContext = session ? session.getUserContext() : context;

    if (!latestContext || !latestContext.username || !latestContext.id) {
      alert('Please log in to add tickets to your cart.');
      window.location.href = '../Login/Login.html';
      return;
    }

    var cartMap = loadCartStorage();
    var userIdKey = String(latestContext.id);
    var userCart = Array.isArray(cartMap[userIdKey]) ? cartMap[userIdKey] : [];

    var itemId = buildCartItemId(ticket);
    var existingItem = userCart.find(function (entry) {
      return entry && entry.id === itemId;
    });

    var timestamp = Date.now();

    if (existingItem) {
      var quantity = Number(existingItem.quantity) || 0;
      existingItem.quantity = quantity + 1;
      existingItem.addedAt = timestamp;
    } else {
      userCart.push({
        id: itemId,
        routeId: ticket.route_id || ticket.routeId || '',
        origin: ticket.origin || '',
        originName: ticket.origin || '',
        originCode: ticket.origin_code || ticket.originCode || '',
        destination: ticket.dest || ticket.destination || '',
        destinationName: ticket.dest || ticket.destination || '',
        destinationCode: ticket.dest_code || ticket.destinationCode || '',
        departure: ticket.departure || '',
        arrival: ticket.arrival || '',
        datee: ticket.datee || '',
        price: Number(ticket.price) || 0,
        travelMinutes: ticket.travelMinutes,
        quantity: 1,
        addedAt: timestamp
      });
    }

    userCart.sort(function (a, b) {
      var aTime = a && Number(a.addedAt);
      var bTime = b && Number(b.addedAt);

      if (!Number.isFinite(aTime)) {
        aTime = 0;
      }

      if (!Number.isFinite(bTime)) {
        bTime = 0;
      }

      return bTime - aTime;
    });

    cartMap[userIdKey] = userCart;
    saveCartStorage(cartMap);
    localStorage.setItem('railly-cart-selected', userIdKey + '::' + itemId);

    triggerCartFeedback(cardElement);
  }

  function triggerCartFeedback(cardElement) {
    animateTicketToCart(cardElement);
    highlightCartLink();
    showInlineConfirmation(cardElement);
    announceCartUpdate('Ticket added to your cart.');
  }

  function animateTicketToCart(cardElement) {
    var navCartLink = document.querySelector('.site-header .main-nav a[data-page="cart"]');

    if (!navCartLink) {
      return;
    }

    var sourceElement = null;

    if (cardElement && cardElement.querySelector) {
      sourceElement = cardElement.querySelector('.ticket-icon img') || cardElement;
    }

    var sourceRect = sourceElement
      ? sourceElement.getBoundingClientRect()
      : navCartLink.getBoundingClientRect();
    var targetRect = navCartLink.getBoundingClientRect();

    var flyer = document.createElement('img');
    flyer.src = '../../../assets/img/ticket.png';
    flyer.alt = '';
    flyer.className = 'ticket-flyer';
    flyer.style.left = sourceRect.left + sourceRect.width / 2 + 'px';
    flyer.style.top = sourceRect.top + sourceRect.height / 2 + 'px';
    flyer.style.transform = 'translate(0, 0) scale(1)';
    flyer.style.opacity = '1';

    document.body.appendChild(flyer);

    requestAnimationFrame(function () {
      var deltaX =
        targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      var deltaY =
        targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

      flyer.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(0.2)';
      flyer.style.opacity = '0.2';
    });

    var cleanupTimeout = window.setTimeout(function () {
      flyer.remove();
    }, 1000);

    flyer.addEventListener(
      'transitionend',
      function () {
        window.clearTimeout(cleanupTimeout);
        flyer.remove();
      },
      { once: true }
    );
  }

  function highlightCartLink() {
    var navCartLink = document.querySelector('.site-header .main-nav a[data-page="cart"]');

    if (!navCartLink) {
      return;
    }

    var existingTimeoutId = Number(navCartLink.dataset.pulseTimeoutId || 0);

    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    if (navCartLink.classList.contains('cart-link-pulse')) {
      // Force reflow so the animation can be retriggered reliably on rapid clicks.
      navCartLink.classList.remove('cart-link-pulse');
      void navCartLink.offsetWidth;
    }

    navCartLink.classList.add('cart-link-pulse');

    var timeoutId = window.setTimeout(function () {
      navCartLink.classList.remove('cart-link-pulse');
      delete navCartLink.dataset.pulseTimeoutId;
    }, 1200);

    navCartLink.dataset.pulseTimeoutId = String(timeoutId);
  }

  function showInlineConfirmation(cardElement) {
    if (!cardElement) {
      return;
    }

    var actions = cardElement.querySelector('.ticket-actions');

    if (!actions) {
      return;
    }

    var existingMessage = actions.querySelector('.ticket-added-message');

    if (existingMessage) {
      existingMessage.remove();
    }

    var message = document.createElement('div');
    message.className = 'ticket-added-message';
    message.textContent = 'Added to cart!';
    actions.appendChild(message);

    requestAnimationFrame(function () {
      message.classList.add('is-visible');
    });

    window.setTimeout(function () {
      message.classList.remove('is-visible');
    }, 2000);

    message.addEventListener(
      'transitionend',
      function (event) {
        if (event.propertyName === 'opacity' && !message.classList.contains('is-visible')) {
          message.remove();
        }
      }
    );
  }

  var cartLiveRegion = null;

  function announceCartUpdate(message) {
    if (!message) {
      return;
    }

    if (!cartLiveRegion) {
      cartLiveRegion = document.createElement('div');
      cartLiveRegion.id = 'cart-feedback-live-region';
      cartLiveRegion.className = 'visually-hidden';
      cartLiveRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(cartLiveRegion);
    }

    cartLiveRegion.textContent = '';

    window.setTimeout(function () {
      cartLiveRegion.textContent = message;
    }, 50);
  }

  function buildCartItemId(ticket) {
    var routeId = ticket.route_id || ticket.routeId || '';
    var dateValue = ticket.datee || '';
    var departure = ticket.departure || '';

    if (routeId) {
      return routeId + '::' + dateValue + '::' + departure;
    }

    return [
      ticket.origin || '',
      ticket.dest || ticket.destination || '',
      dateValue,
      departure,
      ticket.arrival || ''
    ].join('::');
  }

  function loadCartStorage() {
    var raw = localStorage.getItem('railly-cart');

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

  function saveCartStorage(map) {
    localStorage.setItem('railly-cart', JSON.stringify(map || {}));
  }

  function redirectToConfirmation(ticket) {
    var latestContext = session ? session.getUserContext() : context;

    var params = new URLSearchParams({
      routeId: ticket.route_id,
      origin: ticket.origin,
      destination: ticket.dest,
      departure: ticket.departure,
      arrival: ticket.arrival,
      price: ticket.price,
      datee: ticket.datee
    });

    if (latestContext && latestContext.username && latestContext.id) {
      params.set('username', latestContext.username);
      params.set('id', latestContext.id);
    }

    window.location.href = '../BookingConfirmation/Bookingconfirmation.html?' + params.toString();
  }

  if (window.__layoutReady) {
    initBookingPage();
  } else {
    document.addEventListener('layout:ready', initBookingPage, { once: true });
  }
})();
