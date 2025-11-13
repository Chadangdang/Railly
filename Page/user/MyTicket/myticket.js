(function () {
  'use strict';

  var STATUS_LABELS = {
    paid: 'Paid',
    used: 'Used',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };

  function normalizeStatus(status) {
    return typeof status === 'string' ? status.trim().toLowerCase() : '';
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var filterButtons = document.querySelectorAll('.filter-button');
    var ticketList = document.querySelector('#ticket-list');

    if (!ticketList) {
      return;
    }

    var FILTER_PREDICATES = {
      active: function (ticket) {
        var status = normalizeStatus(ticket.status);
        return status === 'paid' || status === 'used';
      },
      cancelled: function (ticket) {
        return normalizeStatus(ticket.status) === 'cancelled';
      },
      expired: function (ticket) {
        return normalizeStatus(ticket.status) === 'expired';
      },
    };

    ticketList.setAttribute('aria-live', 'polite');

    var state = {
      tickets: [],
      isLoading: false,
      error: null,
    };

    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.classList.contains('is-active')) {
          return;
        }

        filterButtons.forEach(function (btn) {
          btn.classList.remove('is-active');
        });
        button.classList.add('is-active');

        var filter = button.getAttribute('data-filter') || 'active';
        ticketList.setAttribute('data-filter', filter);
        renderTickets();
      });
    });

    function formatStatusLabel(status) {
      var normalized = normalizeStatus(status);
      return STATUS_LABELS[normalized] || (normalized ? capitalize(normalized) : 'Unknown');
    }

    function formatTicketId(id) {
      if (id === undefined || id === null || id === '') {
        return '—';
      }

      var numeric = String(id).replace(/[^0-9]/g, '');
      if (numeric.length === 0) {
        return String(id);
      }

      return numeric.padStart(15, '0');
    }

    function formatDateForDisplay(dateString) {
      if (!dateString) {
        return 'Date: —';
      }

      var parsedDate = new Date(dateString + 'T00:00:00');
      if (!Number.isNaN(parsedDate.getTime())) {
        var formatted = new Intl.DateTimeFormat('en-GB').format(parsedDate);
        return 'Date: ' + formatted;
      }

      return 'Date: ' + dateString;
    }

    function formatTimeForDisplay(timeString) {
      if (!timeString) {
        return '--:--';
      }

      var parts = String(timeString).split(':');
      if (parts.length >= 2) {
        return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
      }

      return timeString;
    }

    function formatPrice(price) {
      if (price === undefined || price === null || price === '') {
        return '฿0.00';
      }

      var numeric = Number(String(price).replace(/[^0-9.-]+/g, ''));
      if (!Number.isFinite(numeric)) {
        return String(price);
      }

      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 2,
      }).format(numeric);
    }

    function formatIssuedAt(value) {
      if (!value) {
        return null;
      }

      var parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
    }

    function parseStationLabel(label) {
      if (!label) {
        return { name: '—', code: null };
      }

      var match = String(label).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (match) {
        return { name: match[1].trim(), code: match[2].trim() };
      }

      return { name: String(label).trim(), code: null };
    }

    function createMessageElement(text, role) {
      var paragraph = document.createElement('p');
      paragraph.className = 'ticket-list__message';
      if (role) {
        paragraph.setAttribute('role', role);
      }
      paragraph.textContent = text;
      return paragraph;
    }

    function createFooterItem(label, value) {
      var wrapper = document.createElement('div');
      wrapper.className = 'ticket-card__footer-item';

      var labelEl = document.createElement('span');
      labelEl.className = 'ticket-card__footer-label';
      labelEl.textContent = label + ':';

      var valueEl = document.createElement('strong');
      valueEl.textContent = value;

      wrapper.appendChild(labelEl);
      wrapper.appendChild(valueEl);

      return wrapper;
    }

    function buildStationSection(timeValue, stationLabel, type) {
      var section = document.createElement('div');
      var className = 'ticket-card__section';
      if (type) {
        className += ' ticket-card__section--' + type;
      }
      section.className = className;

      var timeEl = document.createElement('span');
      timeEl.className = 'ticket-card__time';
      timeEl.textContent = formatTimeForDisplay(timeValue);

      var stationInfo = parseStationLabel(stationLabel);
      var stationEl = document.createElement('span');
      stationEl.className = 'ticket-card__station';
      stationEl.textContent = stationInfo.name;

      section.appendChild(timeEl);
      section.appendChild(stationEl);

      if (stationInfo.code) {
        var codeEl = document.createElement('span');
        codeEl.className = 'ticket-card__station-code';
        codeEl.textContent = stationInfo.code;
        section.appendChild(codeEl);
      }

      return section;
    }

    function buildTicketCard(ticket) {
      var article = document.createElement('article');
      article.className = 'ticket-card';
      article.setAttribute('role', 'listitem');

      var status = normalizeStatus(ticket.status);
      if (status) {
        article.classList.add('ticket-card--' + status);
      }

      var header = document.createElement('header');
      header.className = 'ticket-card__header';

      var statusBadge = document.createElement('span');
      statusBadge.className = 'ticket-card__status';
      statusBadge.textContent = formatStatusLabel(ticket.status);

      var meta = document.createElement('div');
      meta.className = 'ticket-card__meta';

      var metaLabel = document.createElement('span');
      metaLabel.textContent = 'Ticket ID';

      var metaValue = document.createElement('strong');
      metaValue.textContent = formatTicketId(ticket.ticket_id);

      meta.appendChild(metaLabel);
      meta.appendChild(metaValue);

      header.appendChild(statusBadge);
      header.appendChild(meta);

      var body = document.createElement('div');
      body.className = 'ticket-card__body';

      body.appendChild(buildStationSection(ticket.departure, ticket.origin, 'origin'));

      var route = document.createElement('div');
      route.className = 'ticket-card__route';

      var dateEl = document.createElement('span');
      dateEl.className = 'ticket-card__date';
      dateEl.textContent = formatDateForDisplay(ticket.datee);

      var divider = document.createElement('span');
      divider.className = 'ticket-card__divider';
      divider.setAttribute('aria-hidden', 'true');

      route.appendChild(dateEl);
      route.appendChild(divider);

      body.appendChild(route);
      body.appendChild(buildStationSection(ticket.arrival, ticket.destination, 'destination'));

      var qr = document.createElement('div');
      qr.className = 'ticket-card__qr';
      qr.setAttribute('role', 'img');
      qr.setAttribute('aria-label', 'QR code placeholder');

      var qrHiddenText = document.createElement('span');
      qrHiddenText.className = 'visually-hidden';
      qrHiddenText.textContent = 'QR code placeholder';
      qr.appendChild(qrHiddenText);

      var actions = document.createElement('div');
      actions.className = 'ticket-card__actions';
      actions.appendChild(qr);

      if (status === 'paid') {
        var cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ticket-card__cancel-button';
        cancelButton.textContent = 'Cancel';
        cancelButton.setAttribute('aria-label', 'Cancel this ticket');
        cancelButton.title = 'Cancel this ticket';
        actions.appendChild(cancelButton);
      }

      body.appendChild(actions);

      var footer = document.createElement('footer');
      footer.className = 'ticket-card__footer';

      var quantity = ticket.quantity;
      if (quantity === undefined || quantity === null || quantity === '') {
        quantity = 1;
      }

      footer.appendChild(createFooterItem('Quantity', String(quantity)));
      footer.appendChild(createFooterItem('Price', formatPrice(ticket.price)));

      var issuedAt = formatIssuedAt(ticket.created_at);
      if (issuedAt) {
        footer.appendChild(createFooterItem('Issued', issuedAt));
      }

      article.appendChild(header);
      article.appendChild(body);
      article.appendChild(footer);

      return article;
    }

    function renderTickets() {
      while (ticketList.firstChild) {
        ticketList.removeChild(ticketList.firstChild);
      }

      if (state.isLoading) {
        ticketList.appendChild(createMessageElement('Loading your tickets…', 'status'));
        return;
      }

      if (state.error) {
        ticketList.appendChild(createMessageElement(state.error, 'alert'));
        return;
      }

      var filterKey = (ticketList.getAttribute('data-filter') || 'active').toLowerCase();
      var predicate = FILTER_PREDICATES[filterKey] || function () {
        return true;
      };

      var filteredTickets = state.tickets.filter(predicate);

      if (filteredTickets.length === 0) {
        var message = 'No tickets found for this filter yet.';
        if (filterKey === 'active') {
          message = 'You have no tickets that are ready to use at the moment.';
        } else if (filterKey === 'cancelled') {
          message = 'You have not cancelled any tickets yet.';
        } else if (filterKey === 'expired') {
          message = 'You do not have any expired tickets.';
        }
        ticketList.appendChild(createMessageElement(message));
        return;
      }

      var fragment = document.createDocumentFragment();
      filteredTickets.forEach(function (ticket) {
        fragment.appendChild(buildTicketCard(ticket));
      });

      ticketList.appendChild(fragment);
    }

    function fetchTickets() {
      var session = window.userSession;
      var context = session ? session.getUserContext() : null;

      if (!context || !context.username || !context.id) {
        state.tickets = [];
        state.error = 'Please sign in to view your tickets.';
        state.isLoading = false;
        renderTickets();
        return;
      }

      state.isLoading = true;
      state.error = null;
      renderTickets();

      var params = new URLSearchParams({
        username: context.username,
        id: context.id,
      });

      fetch('../../../Backend/getUserTickets.php?' + params.toString(), {
        credentials: 'include',
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Failed to load tickets.');
          }
          return response.json();
        })
        .then(function (data) {
          if (!data || data.status !== 'success' || !Array.isArray(data.tickets)) {
            var message = data && data.message ? data.message : 'No tickets could be loaded.';
            throw new Error(message);
          }

          state.tickets = data.tickets;
          state.error = null;
        })
        .catch(function (error) {
          state.tickets = [];
          state.error = error.message || 'Unable to retrieve your tickets right now.';
        })
        .finally(function () {
          state.isLoading = false;
          renderTickets();
        });
    }

    fetchTickets();
  });
})();
