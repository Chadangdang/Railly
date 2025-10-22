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
    var icon = document.createElement('img');
    icon.src = '../../../assets/img/ticket.png';
    icon.alt = 'Ticket stub';
    iconWrapper.appendChild(icon);
    card.appendChild(iconWrapper);

    var info = document.createElement('div');
    info.className = 'ticket-info';

    var dateElement = document.createElement('div');
    dateElement.className = 'ticket-date';
    dateElement.textContent = formatDateForDisplay(ticket.datee);
    info.appendChild(dateElement);

    var timesWrapper = document.createElement('div');
    timesWrapper.className = 'ticket-times';
    timesWrapper.appendChild(buildTimeBlock(ticket.departure, ticket.origin));
    timesWrapper.appendChild(buildTravelDurationBlock(ticket.travelMinutes));
    timesWrapper.appendChild(buildTimeBlock(ticket.arrival, ticket.dest));
    info.appendChild(timesWrapper);

    card.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'ticket-actions';

    var availabilityText = formatAvailability(ticket);
    if (availabilityText) {
      var availabilityElement = document.createElement('div');
      availabilityElement.className = 'ticket-availability';
      availabilityElement.textContent = availabilityText;
      actions.appendChild(availabilityElement);
    }

    var priceElement = document.createElement('div');
    priceElement.className = 'ticket-price';
    priceElement.textContent = formatPrice(ticket.price);
    actions.appendChild(priceElement);

    var availableCount = normaliseNumber(ticket.available_ticket);
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = availableCount > 0 ? 'ADD TO CART' : 'SOLD OUT';
    button.disabled = availableCount <= 0;
    button.addEventListener('click', function () {
      redirectToConfirmation(ticket);
    });
    actions.appendChild(button);

    card.appendChild(actions);

    return card;
  }

  function buildTimeBlock(time, stationName) {
    var wrapper = document.createElement('div');
    wrapper.className = 'time-block';

    var timeElement = document.createElement('div');
    timeElement.className = 'time';
    timeElement.textContent = time || '--:--';
    wrapper.appendChild(timeElement);

    var stationElement = document.createElement('div');
    stationElement.className = 'station';
    stationElement.textContent = stationName || '';
    wrapper.appendChild(stationElement);

    return wrapper;
  }

  function buildTravelDurationBlock(travelMinutes) {
    var wrapper = document.createElement('div');
    wrapper.className = 'travel-duration';

    var label = document.createElement('span');
    label.textContent = 'Travel time: ' + formatTravelDuration(travelMinutes);
    wrapper.appendChild(label);

    return wrapper;
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
