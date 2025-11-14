(function () {
  'use strict';

  var STATUS_LABELS = {
    PAID: { label: 'Paid', tone: 'success', banner: 'Ticket is valid and ready to board.' },
    USED: { label: 'Used', tone: 'warning', banner: 'Ticket has already been marked as used.' },
    CANCELLED: { label: 'Cancelled', tone: 'error', banner: 'Ticket was cancelled and is not valid for travel.' },
    EXPIRED: { label: 'Expired', tone: 'error', banner: 'Ticket has expired and cannot be used.' },
  };

  function setStatusBanner(element, message, tone) {
    if (!element) {
      return;
    }

    element.textContent = message || '';

    element.classList.remove('is-success', 'is-error', 'is-warning');
    if (!tone) {
      return;
    }

    if (tone === 'success') {
      element.classList.add('is-success');
    } else if (tone === 'error') {
      element.classList.add('is-error');
    } else if (tone === 'warning') {
      element.classList.add('is-warning');
    }
  }

  function setBadgeTone(element, tone) {
    if (!element) {
      return;
    }

    element.classList.remove('is-success', 'is-error', 'is-warning');

    if (tone === 'success') {
      element.classList.add('is-success');
    } else if (tone === 'error') {
      element.classList.add('is-error');
    } else if (tone === 'warning') {
      element.classList.add('is-warning');
    }
  }

  function formatDateForDisplay(value) {
    if (!value) {
      return '—';
    }

    try {
      var date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'long',
        }).format(date);
      }
    } catch (error) {
      return value;
    }

    return value;
  }

  function formatTimeForDisplay(value) {
    if (!value) {
      return '—';
    }

    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
      return value.substring(0, 5);
    }

    try {
      var date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
      }
    } catch (error) {
      return value;
    }

    return value;
  }

  function normalizeStatus(status) {
    return status ? String(status).trim().toUpperCase() : '';
  }

  function setTextContent(element, value) {
    if (element) {
      element.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statusBanner = document.getElementById('status-banner');
    var detailsSection = document.getElementById('ticket-details');
    var ticketStatus = document.getElementById('ticket-status');
    var markUsedButton = document.getElementById('mark-used-button');

    var detailFields = {
      ticketId: document.getElementById('detail-ticket-id'),
      userId: document.getElementById('detail-user-id'),
      username: document.getElementById('detail-username'),
      date: document.getElementById('detail-date'),
      departure: document.getElementById('detail-departure'),
      arrival: document.getElementById('detail-arrival'),
      origin: document.getElementById('detail-origin'),
      destination: document.getElementById('detail-destination'),
      quantity: document.getElementById('detail-quantity'),
      price: document.getElementById('detail-price'),
      issuedAt: document.getElementById('detail-issued-at'),
      usedAt: document.getElementById('detail-used-at'),
      cancelledAt: document.getElementById('detail-cancelled-at'),
    };

    var params = new URLSearchParams(window.location.search);
    var ticketId = params.get('ticket_id');
    var userId = params.get('user_id');

    if (!ticketId || !userId) {
      setStatusBanner(statusBanner, 'Missing ticket information. Please scan a valid QR code.', 'error');
      if (markUsedButton) {
        markUsedButton.hidden = true;
      }
      return;
    }

    var state = {
      ticketId: ticketId,
      userId: userId,
      ticket: null,
      isUpdating: false,
    };

    function renderTicket(ticket) {
      if (!ticket) {
        if (detailsSection) {
          detailsSection.hidden = true;
        }
        return;
      }

      if (detailsSection) {
        detailsSection.hidden = false;
      }

      var normalizedStatus = normalizeStatus(ticket.status);
      var statusMeta = STATUS_LABELS[normalizedStatus] || {
        label: normalizedStatus || 'Unknown',
        tone: 'warning',
        banner: 'Ticket status could not be determined. Please confirm with the passenger.',
      };

      if (ticketStatus) {
        ticketStatus.textContent = statusMeta.label;
        setBadgeTone(ticketStatus, statusMeta.tone);
      }

      setStatusBanner(statusBanner, ticket.message || statusMeta.banner, statusMeta.tone);

      setTextContent(detailFields.ticketId, ticket.ticket_id);
      setTextContent(detailFields.userId, ticket.user_id);
      setTextContent(detailFields.username, ticket.username || '—');
      setTextContent(detailFields.date, formatDateForDisplay(ticket.date));

      setTextContent(detailFields.departure, formatTimeForDisplay(ticket.departure_time));
      setTextContent(detailFields.arrival, formatTimeForDisplay(ticket.arrival_time));
      setTextContent(detailFields.origin, ticket.origin || '—');
      setTextContent(detailFields.destination, ticket.destination || '—');
      setTextContent(detailFields.quantity, ticket.quantity || 1);
      setTextContent(detailFields.price, ticket.price ? '฿' + ticket.price : '฿0.00');

      setTextContent(detailFields.issuedAt, formatTimeForDisplay(ticket.issued_at));
      setTextContent(detailFields.usedAt, formatTimeForDisplay(ticket.used_at));
      setTextContent(detailFields.cancelledAt, formatTimeForDisplay(ticket.cancelled_at));

      if (markUsedButton) {
        var canUse = normalizedStatus === 'PAID';
        markUsedButton.hidden = !canUse;
        markUsedButton.disabled = !canUse || state.isUpdating;
      }
    }

    function handleError(message) {
      state.ticket = null;
      if (detailsSection) {
        detailsSection.hidden = true;
      }
      if (markUsedButton) {
        markUsedButton.hidden = true;
        markUsedButton.disabled = true;
      }
      setStatusBanner(statusBanner, message, 'error');
    }

    function fetchTicket() {
      var url = '../../Backend/verifyTicket.php?';
      var query = new URLSearchParams({
        ticket_id: state.ticketId,
        user_id: state.userId,
      });

      setStatusBanner(statusBanner, 'Verifying ticket…', null);

      fetch(url + query.toString(), { credentials: 'include' })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Unable to verify ticket at this time.');
          }
          return response.json();
        })
        .then(function (payload) {
          if (!payload || payload.status !== 'success' || !payload.ticket) {
            var message = (payload && payload.message) || 'Ticket could not be verified.';
            throw new Error(message);
          }

          state.ticket = payload.ticket;
          renderTicket(payload.ticket);
        })
        .catch(function (error) {
          handleError(error.message || 'Ticket could not be verified.');
        });
    }

    function markTicketUsed() {
      if (state.isUpdating) {
        return;
      }

      state.isUpdating = true;
      if (markUsedButton) {
        markUsedButton.disabled = true;
      }
      setStatusBanner(statusBanner, 'Updating ticket status…', null);

      var formData = new FormData();
      formData.append('ticket_id', state.ticketId);
      formData.append('user_id', state.userId);

      fetch('../../Backend/verifyTicket.php', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Unable to update the ticket.');
          }
          return response.json();
        })
        .then(function (payload) {
          if (!payload || payload.status !== 'success' || !payload.ticket) {
            var message = (payload && payload.message) || 'Failed to update the ticket.';
            throw new Error(message);
          }

          state.ticket = payload.ticket;
          state.isUpdating = false;
          renderTicket(payload.ticket);
        })
        .catch(function (error) {
          state.isUpdating = false;
          if (markUsedButton) {
            markUsedButton.disabled = false;
          }
          setStatusBanner(statusBanner, error.message || 'Failed to update the ticket.', 'error');
        });
    }

    if (markUsedButton) {
      markUsedButton.addEventListener('click', function () {
        markTicketUsed();
      });
    }

    fetchTicket();
  });
})();
