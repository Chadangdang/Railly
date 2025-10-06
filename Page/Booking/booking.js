document.addEventListener('DOMContentLoaded', function () {
    var session = window.userSession;
    var context = session ? session.getUserContext() : { username: null, id: null };
  
    if (!context.username || !context.id) {
      alert('Please log in to search and book tickets.');
      window.location.href = '../Login/Login.html';
      return;
    }
  
    if (session) {
      session.applyUserContextToLinks('.main-nav a');
    }
  
    initialiseDateField();
  
    var searchButton = document.getElementById('search-btn');
    if (searchButton) {
      searchButton.addEventListener('click', handleSearch);
    }
  
    function initialiseDateField() {
      var dateInput = document.getElementById('datee');
      if (!dateInput) {
        return;
      }
  
      var today = new Date();
      var minDate = toDateInputValue(today);
      var maxDate = new Date(today);
      maxDate.setDate(today.getDate() + 7);
  
      dateInput.setAttribute('min', minDate);
      dateInput.setAttribute('max', toDateInputValue(maxDate));
    }
  
    function toDateInputValue(date) {
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }
  
    function handleSearch() {
      var origin = document.getElementById('origin').value;
      var destination = document.getElementById('dest').value;
      var dateValue = document.getElementById('datee').value;
  
      if (!origin || !destination || !dateValue) {
        alert('Please fill all the fields!');
        return;
      }
  
      var queryParams = new URLSearchParams({
        origin: origin,
        dest: destination,
        datee: dateValue
      });
  
      fetch('../../Backend/getTickets.php?' + queryParams.toString())
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (Array.isArray(data)) {
            renderTickets(data);
            return;
          }
  
          if (data && data.status === 'error') {
            renderMessage(data.message || 'No tickets found for the given criteria.');
            return;
          }
  
          renderMessage('No tickets found for the given criteria.');
        })
        .catch(function () {
          renderMessage('Unable to fetch tickets right now. Please try again later.');
        });
    }
  
    function renderTickets(tickets) {
      if (!Array.isArray(tickets) || tickets.length === 0) {
        renderMessage('No tickets found for the given criteria.');
        return;
      }
  
      var container = document.getElementById('ticket-results');
      if (!container) {
        return;
      }
  
      container.innerHTML = '';
  
      tickets.forEach(function (ticket) {
        var card = document.createElement('div');
        card.className = 'ticket-card';
  
        var details = document.createElement('div');
        details.className = 'ticket-details';
  
        details.appendChild(buildStationColumn(ticket.origin, ticket.departure, 'origin', 'departure'));
  
        var arrowWrapper = document.createElement('div');
        arrowWrapper.innerHTML = '<span class="station">→</span>';
        details.appendChild(arrowWrapper);
  
        details.appendChild(buildStationColumn(ticket.dest, ticket.arrival, 'dest', 'arrival'));
        card.appendChild(details);
  
        card.appendChild(buildInfoSpan('date', formatDate(ticket.datee)));
        card.appendChild(buildInfoSpan('price', formatPrice(ticket.price)));
  
        var availableCount = parseInt(ticket.available_ticket, 10);
        if (!Number.isFinite(availableCount)) {
          availableCount = 0;
        }
        card.appendChild(buildInfoSpan('available-tickets', 'Available: ' + availableCount));
  
        var buttonWrapper = document.createElement('div');
        var button = document.createElement('button');
        button.className = 'select-btn';
        button.textContent = availableCount > 0 ? 'SELECT' : 'SOLD OUT';
        button.disabled = availableCount <= 0;
        button.addEventListener('click', function () {
          redirectToConfirmation(ticket);
        });
  
        buttonWrapper.appendChild(button);
        card.appendChild(buttonWrapper);
  
        container.appendChild(card);
      });
    }
  
    function renderMessage(message) {
      var container = document.getElementById('ticket-results');
      if (!container) {
        return;
      }
  
      container.innerHTML = '<p>' + message + '</p>';
    }
  
    function buildStationColumn(stationName, time, stationClass, timeClass) {
      var wrapper = document.createElement('div');
  
      var station = document.createElement('span');
      station.className = stationClass;
      station.textContent = stationName;
  
      var timeElement = document.createElement('span');
      timeElement.className = timeClass;
      timeElement.textContent = time;
  
      wrapper.appendChild(station);
      wrapper.appendChild(timeElement);
  
      return wrapper;
    }
  
    function buildInfoSpan(className, text) {
      var wrapper = document.createElement('div');
      var span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      wrapper.appendChild(span);
      return wrapper;
    }
  
    function formatDate(dateString) {
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
  
      return date.toLocaleDateString();
    }
  
    function formatPrice(price) {
      var value = Number(price);
      if (!Number.isFinite(value)) {
        return String(price);
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
  });
