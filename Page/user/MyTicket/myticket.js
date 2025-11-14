(function () {
  'use strict';

  var STATUS_LABELS = {
    paid: 'Paid',
    used: 'Used',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };

  var CANCEL_CONFIRMATION_MESSAGE =
    'Are you sure?\n\nDo you really want to cancel this ticket?\nThis process cannot be undone.';
  var CANCEL_SUCCESS_FALLBACK_MESSAGE = 'Your ticket has been cancelled.';

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

    function parseDepartureDateTime(ticket) {
      if (!ticket) {
        return null;
      }

      var dateValue = ticket.datee ? String(ticket.datee).trim() : '';
      if (!dateValue) {
        return null;
      }

      var timeValue = ticket.departure ? String(ticket.departure).trim() : '';
      var isoString = dateValue;

      if (timeValue) {
        if (/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
          isoString += 'T' + timeValue;
        } else if (/^\d{2}:\d{2}$/.test(timeValue)) {
          isoString += 'T' + timeValue + ':00';
        } else {
          isoString += ' ' + timeValue;
        }
      }

      var parsed = new Date(isoString);
      if (Number.isNaN(parsed.getTime()) && timeValue) {
        parsed = new Date(dateValue + ' ' + timeValue);
      }

      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function parseDateTimeValue(value) {
      if (!value) {
        return null;
      }

      var normalized = String(value).trim();
      if (!normalized) {
        return null;
      }

      var isoCandidate = normalized;
      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
        isoCandidate = normalized.replace(' ', 'T');
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(isoCandidate)) {
          isoCandidate += ':00';
        }
      }

      var parsed = new Date(isoCandidate);
      if (Number.isNaN(parsed.getTime())) {
        parsed = new Date(normalized);
      }

      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function getTicketStatusInfo(ticket) {
      var baseStatus = normalizeStatus(ticket && ticket.status);
      var derivedStatus = baseStatus;
      var previousStatus = null;

      if (baseStatus.indexOf(':') > -1) {
        var parts = baseStatus.split(':');
        if (parts.length >= 2 && parts[0] === 'expired') {
          derivedStatus = 'expired';
          previousStatus = normalizeStatus(parts.slice(1).join(':')) || null;
          baseStatus = 'expired';
        }
      }

      var departureMoment = parseDepartureDateTime(ticket);
      if (
        departureMoment &&
        departureMoment.getTime() <= Date.now() &&
        (baseStatus === 'paid' || baseStatus === 'used')
      ) {
        previousStatus = baseStatus;
        derivedStatus = 'expired';
      }

      if (derivedStatus === 'expired') {
        var explicitPrevious =
          normalizeStatus(
            ticket &&
              (ticket.expired_from_status ||
                ticket.previous_status ||
                ticket.last_status ||
                ticket.original_status)
          ) || null;

        if (explicitPrevious) {
          previousStatus = explicitPrevious;
        } else if (!previousStatus) {
          var usedMoment = parseDateTimeValue(ticket && ticket.used_at);
          if (usedMoment) {
            previousStatus = 'used';
          } else {
            previousStatus = baseStatus === 'expired' ? 'paid' : baseStatus;
          }
        }
      }

      return {
        base: baseStatus,
        current: derivedStatus || '',
        previous: previousStatus,
      };
    }

    var FILTER_PREDICATES = {
      active: function (ticket) {
        var info = getTicketStatusInfo(ticket);
        var status = info.current;
        return status === 'paid' || status === 'used';
      },
      cancelled: function (ticket) {
        return getTicketStatusInfo(ticket).current === 'cancelled';
      },
      expired: function (ticket) {
        return getTicketStatusInfo(ticket).current === 'expired';
      },
    };

    ticketList.setAttribute('aria-live', 'polite');

    var state = {
      tickets: [],
      isLoading: false,
      error: null,
    };
    var pendingCancellations = new Set();

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

    ticketList.addEventListener('click', function (event) {
      var target = event.target;
      if (!target) {
        return;
      }

      var cancelButton = null;
      if (typeof target.closest === 'function') {
        cancelButton = target.closest('.ticket-card__cancel-button');
      } else if (
        target.classList &&
        target.classList.contains('ticket-card__cancel-button')
      ) {
        cancelButton = target;
      }

      if (!cancelButton) {
        return;
      }

      event.preventDefault();
      handleCancelButtonClick(cancelButton);
    });

    function findTicketById(ticketId) {
      var numericId = Number(ticketId);
      if (!Number.isFinite(numericId)) {
        return null;
      }

      for (var i = 0; i < state.tickets.length; i += 1) {
        var ticket = state.tickets[i];
        if (Number(ticket.ticket_id) === numericId) {
          return ticket;
        }
      }

      return null;
    }

    function applyTicketUpdates(ticketId, updates) {
      var numericId = Number(ticketId);
      if (!Number.isFinite(numericId)) {
        return false;
      }

      var payload = updates && typeof updates === 'object' ? updates : {};
      var statusValue =
        typeof payload.status === 'string' && payload.status.trim()
          ? payload.status
          : 'CANCELLED';
      var hasCancelledAt = Object.prototype.hasOwnProperty.call(
        payload,
        'cancelled_at'
      );
      var cancelledAtValue = hasCancelledAt ? payload.cancelled_at : undefined;
      var updated = false;

      state.tickets = state.tickets.map(function (ticket) {
        if (Number(ticket.ticket_id) === numericId) {
          var clone = Object.assign({}, ticket);
          clone.status = statusValue;
          if (hasCancelledAt) {
            clone.cancelled_at = cancelledAtValue;
          }
          updated = true;
          return clone;
        }
        return ticket;
      });

      return updated;
    }

    function handleCancelButtonClick(button) {
      var ticketId = button.getAttribute('data-ticket-id');
      if (!ticketId) {
        return;
      }

      var ticket = findTicketById(ticketId);
      if (!ticket) {
        window.alert('We could not find this ticket. Please refresh and try again.');
        return;
      }

      var status = getTicketStatusInfo(ticket).current;
      if (status !== 'paid') {
        window.alert('Only paid tickets can be cancelled.');
        return;
      }

      if (!window.confirm(CANCEL_CONFIRMATION_MESSAGE)) {
        return;
      }

      var key = String(ticketId);
      if (pendingCancellations.has(key)) {
        return;
      }

      pendingCancellations.add(key);
      renderTickets();

      cancelTicketRequest(ticketId)
        .then(function (response) {
          var updates = {};

          if (response && response.ticket) {
            if (typeof response.ticket.status === 'string') {
              updates.status = response.ticket.status;
            }

            if (
              Object.prototype.hasOwnProperty.call(
                response.ticket,
                'cancelled_at'
              )
            ) {
              updates.cancelled_at = response.ticket.cancelled_at;
            }
          }

          if (!Object.prototype.hasOwnProperty.call(updates, 'status')) {
            updates.status = 'CANCELLED';
          }

          applyTicketUpdates(ticketId, updates);
          pendingCancellations.delete(key);
          renderTickets();

          var message =
            (response && response.message) || CANCEL_SUCCESS_FALLBACK_MESSAGE;
          window.alert(message);
        })
        .catch(function (error) {
          pendingCancellations.delete(key);
          renderTickets();

          var fallback =
            error && error.message
              ? error.message
              : 'We were unable to cancel this ticket. Please try again later.';
          window.alert(fallback);
        });
    }

    function formatStatusLabel(status) {
      var normalized = normalizeStatus(status);
      return STATUS_LABELS[normalized] || (normalized ? capitalize(normalized) : 'Unknown');
    }

    function formatStatusBadge(statusInfo) {
      if (!statusInfo || !statusInfo.current) {
        return 'Unknown';
      }

      if (statusInfo.current === 'expired' && statusInfo.previous) {
        return 'EXPIRED:' + statusInfo.previous.toUpperCase();
      }

      return formatStatusLabel(statusInfo.current);
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

    function formatCancelledDateForDisplay(value) {
      var parsed = parseDateTimeValue(value);
      if (!parsed) {
        return null;
      }

      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
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

    function formatCancellationAt(value) {
      return formatIssuedAt(value);
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

    function getTicketSortTimestamp(ticket, filterKey) {
      var key = (filterKey || '').toLowerCase();

      var timestamp = null;
      if (key === 'cancelled') {
        timestamp =
          parseDateTimeValue(ticket && ticket.cancelled_at) ||
          parseDateTimeValue(ticket && ticket.created_at) ||
          parseDepartureDateTime(ticket);
      } else if (key === 'expired') {
        timestamp =
          parseDateTimeValue(ticket && ticket.used_at) ||
          parseDepartureDateTime(ticket) ||
          parseDateTimeValue(ticket && ticket.created_at);
      } else {
        timestamp =
          parseDateTimeValue(ticket && ticket.created_at) ||
          parseDepartureDateTime(ticket) ||
          parseDateTimeValue(ticket && ticket.cancelled_at);
      }

      return timestamp ? timestamp.getTime() : Number.NEGATIVE_INFINITY;
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

    function getPrimaryDateText(ticket, statusInfo) {
      var currentStatus = (statusInfo && statusInfo.current) || null;

      if (currentStatus === 'cancelled') {
        var cancelledDisplay =
          formatCancelledDateForDisplay(ticket && ticket.cancelled_at);
        if (cancelledDisplay) {
          return 'Cancelled at: ' + cancelledDisplay;
        }
      }

      return formatDateForDisplay(ticket && ticket.datee);
    }

    function buildTicketCard(ticket) {
      var article = document.createElement('article');
      article.className = 'ticket-card';
      article.setAttribute('role', 'listitem');
      article.dataset.ticketId = String(ticket.ticket_id);

      var statusInfo = getTicketStatusInfo(ticket);
      var status = statusInfo.current;

      if (status) {
        article.classList.add('ticket-card--' + status);
      }
      article.setAttribute('data-ticket-status', status);
      if (statusInfo.previous) {
        article.setAttribute('data-ticket-previous-status', statusInfo.previous);
      }

      var header = document.createElement('header');
      header.className = 'ticket-card__header';

      var statusBadge = document.createElement('span');
      statusBadge.className = 'ticket-card__status';
      statusBadge.textContent = formatStatusBadge(statusInfo);
      var statusAriaLabel = formatStatusLabel(status);
      if (status === 'expired' && statusInfo.previous) {
        statusAriaLabel =
          'Expired, previously ' + formatStatusLabel(statusInfo.previous);
      }
      statusBadge.setAttribute('aria-label', statusAriaLabel);

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
      dateEl.textContent = getPrimaryDateText(ticket, statusInfo);

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
        cancelButton.setAttribute('data-ticket-id', String(ticket.ticket_id));
        cancelButton.setAttribute('data-ticket-status', status);

        if (pendingCancellations.has(String(ticket.ticket_id))) {
          cancelButton.disabled = true;
          cancelButton.classList.add('is-busy');
          cancelButton.textContent = 'Cancelling…';
          cancelButton.setAttribute('aria-busy', 'true');
        } else {
          cancelButton.setAttribute('aria-busy', 'false');
        }

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

      var bookedAt = formatIssuedAt(ticket.created_at);
      var cancelledAt = formatCancellationAt(ticket.cancelled_at);

      if (status === 'cancelled') {
        if (cancelledAt) {
          footer.appendChild(createFooterItem('Cancelled at', cancelledAt));
        } else if (bookedAt) {
          footer.appendChild(createFooterItem('Booked at', bookedAt));
        }
      } else if (bookedAt) {
        footer.appendChild(createFooterItem('Booked at', bookedAt));
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

      filteredTickets.sort(function (a, b) {
        var diff =
          getTicketSortTimestamp(b, filterKey) -
          getTicketSortTimestamp(a, filterKey);

        if (diff !== 0) {
          return diff;
        }

        var idA = Number(a && a.ticket_id);
        var idB = Number(b && b.ticket_id);

        if (Number.isFinite(idA) && Number.isFinite(idB)) {
          return idB - idA;
        }

        return 0;
      });

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

    function cancelTicketRequest(ticketId) {
      var session = window.userSession;
      var context = session ? session.getUserContext() : null;

      if (!context || !context.username || !context.id) {
        return Promise.reject(
          new Error('Please sign in to cancel your tickets.')
        );
      }

      var formData = new FormData();
      formData.append('ticket_id', ticketId);
      formData.append('username', context.username);
      formData.append('id', context.id);

      return fetch('../../../Backend/cancelTicket.php', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Failed to cancel the ticket.');
          }
          return response.json();
        })
        .then(function (data) {
          if (!data || data.status !== 'success') {
            var message = data && data.message ? data.message : null;
            throw new Error(
              message || 'Unable to cancel the ticket at this time.'
            );
          }

          return data;
        });
    }

    fetchTickets();
  });
})();
