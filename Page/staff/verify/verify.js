(function () {
  'use strict';

  var STATUS_LABELS = {
    PAID: {
      label: 'Valid (paid)',
      tone: 'success',
      banner: 'Ticket is valid and ready to board.',
    },
    USED: {
      label: 'Used',
      tone: 'error',
      banner: 'Ticket has already been marked as used.',
    },
    CANCELLED: {
      label: 'Cancelled',
      tone: 'warning',
      banner: 'Ticket was cancelled and is not valid for travel.',
    },
    EXPIRED: {
      label: 'Expired',
      tone: 'neutral',
      banner: 'Ticket has expired and cannot be used.',
    },
  };

  var LOGIN_PATH = '../auth/login.html';
  var HISTORY_PATH = '../history/history.html';
  var HOME_PATH = '../home/home.html';

  function setStatusBanner(element, message, tone) {
    if (!element) {
      return;
    }

    element.textContent = message || '';

    element.classList.remove('is-success', 'is-error', 'is-warning', 'is-neutral');
    if (!tone) {
      return;
    }

    if (tone === 'success') {
      element.classList.add('is-success');
    } else if (tone === 'error') {
      element.classList.add('is-error');
    } else if (tone === 'warning') {
      element.classList.add('is-warning');
    } else if (tone === 'neutral') {
      element.classList.add('is-neutral');
    }
  }

  function setBadgeTone(element, tone) {
    if (!element) {
      return;
    }

    element.classList.remove('is-success', 'is-error', 'is-warning', 'is-neutral');

    if (tone === 'success') {
      element.classList.add('is-success');
    } else if (tone === 'error') {
      element.classList.add('is-error');
    } else if (tone === 'warning') {
      element.classList.add('is-warning');
    } else if (tone === 'neutral') {
      element.classList.add('is-neutral');
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

  function trimNote(value) {
    return value ? String(value).trim() : '';
  }

  function buildStatusDetail(ticket, status) {
    if (!ticket) {
      return '';
    }

    if (status === 'PAID') {
      var parts = [];
      if (ticket.date) {
        parts.push('Travel date ' + formatDateForDisplay(ticket.date));
      }
      if (ticket.departure_time) {
        parts.push('Departure ' + formatTimeForDisplay(ticket.departure_time));
      }
      return parts.length > 0 ? parts.join(' • ') : 'Ticket is ready for boarding.';
    }

    if (status === 'USED') {
      if (ticket.used_at) {
        return 'Marked as used on ' + formatTimeForDisplay(ticket.used_at) + '.';
      }
      return 'Ticket has been marked as used.';
    }

    if (status === 'CANCELLED') {
      var reason = ticket.cancel_reason ? String(ticket.cancel_reason).toUpperCase() : '';
      if (reason === 'STAFF_CANCELLED') {
        var staffInfo = ticket.cancelled_by_staff || {};
        var label = staffInfo.staff_username ? 'Cancelled by staff: ' + staffInfo.staff_username : 'Cancelled by staff.';
        if (ticket.cancelled_at) {
          label += ' (' + formatTimeForDisplay(ticket.cancelled_at) + ')';
        }
        return label;
      }

      if (reason === 'USER_CANCELLED') {
        return 'Cancelled by passenger.';
      }

      return 'Ticket has been cancelled.';
    }

    if (status === 'EXPIRED') {
      if (ticket.date) {
        return 'Expired for travel on ' + formatDateForDisplay(ticket.date) + '.';
      }
      if (ticket.cancelled_at) {
        return 'Expired on ' + formatTimeForDisplay(ticket.cancelled_at) + '.';
      }
      return 'Ticket has expired.';
    }

    return '';
  }

  function extractLatestUsage(ticket) {
    if (!ticket || !ticket.usage_logs) {
      return null;
    }

    if (ticket.usage_logs.latest) {
      return ticket.usage_logs.latest;
    }

    return null;
  }

  function formatUsageMeta(entry) {
    if (!entry) {
      return '';
    }

    var parts = [];
    if (entry.staff_username) {
      parts.push('By ' + entry.staff_username);
    }
    if (entry.used_at) {
      parts.push(formatTimeForDisplay(entry.used_at));
    }
    return parts.join(' • ');
  }

  function redirectToLogin() {
    window.location.href = LOGIN_PATH;
  }

  function redirectToHistory() {
    window.location.href = HISTORY_PATH;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statusBanner = document.getElementById('status-banner');
    var statusDetail = document.getElementById('status-detail');
    var detailsSection = document.getElementById('ticket-details');
    var ticketStatus = document.getElementById('ticket-status');
    var ticketStatusDetail = document.getElementById('ticket-status-detail');
    var ticketUsageNote = document.getElementById('ticket-usage-note');
    var ticketUsageNoteContent = document.getElementById('ticket-usage-note-content');
    var ticketUsageNoteMeta = document.getElementById('ticket-usage-note-meta');
    var markUsedButton = document.getElementById('mark-used-button');
    var cancelButton = document.getElementById('cancel-ticket-button');
    var noteInput = document.getElementById('usage-note');
    var noteCounter = document.getElementById('note-counter');
    var formError = document.getElementById('form-error');
    var form = document.getElementById('ticket-action-form');
    var overlay = document.getElementById('action-overlay');
    var backButton = document.getElementById('verification-back-button');

    if (backButton) {
      backButton.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.href = HOME_PATH;
      });
    }

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
      setStatusBanner(
        statusBanner,
        'Missing ticket information. Please scan a valid QR code.',
        'error'
      );
      if (markUsedButton) {
        markUsedButton.hidden = true;
      }
      if (cancelButton) {
        cancelButton.hidden = true;
      }
      if (form) {
        form.hidden = true;
      }
      return;
    }

    var state = {
      ticketId: ticketId,
      userId: userId,
      ticket: null,
      isUpdating: false,
      isFetching: false,
    };

    function updateNoteCounter() {
      if (!noteCounter || !noteInput) {
        return;
      }
      var length = noteInput.value ? noteInput.value.length : 0;
      noteCounter.textContent = length + ' / 100';
    }

    function clearFormError() {
      if (formError) {
        formError.hidden = true;
        formError.textContent = '';
      }
    }

    function showFormError(message) {
      if (formError) {
        formError.hidden = false;
        formError.textContent = message;
      }
    }

    if (noteInput) {
      noteInput.addEventListener('input', function () {
        updateNoteCounter();
        clearFormError();
      });
    }

    function setFetchingState(isFetching) {
      state.isFetching = isFetching;
    }

    function renderUsageNote(entry) {
      if (!ticketUsageNote) {
        return;
      }

      if (!entry) {
        ticketUsageNote.hidden = true;
        return;
      }

      var noteText = trimNote(entry.note);
      if (!noteText) {
        noteText = 'No note recorded.';
      }

      if (ticketUsageNoteContent) {
        ticketUsageNoteContent.textContent = noteText;
      }

      if (ticketUsageNoteMeta) {
        var meta = formatUsageMeta(entry);
        if (meta) {
          ticketUsageNoteMeta.textContent = meta;
          ticketUsageNoteMeta.hidden = false;
        } else {
          ticketUsageNoteMeta.textContent = '';
          ticketUsageNoteMeta.hidden = true;
        }
      }

      ticketUsageNote.hidden = false;
    }

    function updateActions(status) {
      var canInteract = status === 'PAID';

      if (markUsedButton) {
        markUsedButton.hidden = !canInteract;
        markUsedButton.disabled = !canInteract || state.isUpdating;
      }

      if (cancelButton) {
        cancelButton.hidden = !canInteract;
        cancelButton.disabled = !canInteract || state.isUpdating;
      }

      if (form) {
        form.hidden = !canInteract;
      }

      if (!canInteract && noteInput) {
        noteInput.value = '';
        updateNoteCounter();
      }
    }

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

      var bannerMessage = ticket.message || statusMeta.banner;
      setStatusBanner(statusBanner, bannerMessage, statusMeta.tone);

      var detailText = buildStatusDetail(ticket, normalizedStatus);
      if (statusDetail) {
        if (detailText) {
          statusDetail.textContent = detailText;
          statusDetail.hidden = false;
        } else {
          statusDetail.hidden = true;
          statusDetail.textContent = '';
        }
      }

      if (ticketStatusDetail) {
        if (detailText) {
          ticketStatusDetail.textContent = detailText;
          ticketStatusDetail.hidden = false;
        } else {
          ticketStatusDetail.hidden = true;
          ticketStatusDetail.textContent = '';
        }
      }

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

      renderUsageNote(extractLatestUsage(ticket));
      updateActions(normalizedStatus);
    }

    function handleError(message, tone) {
      state.ticket = null;
      if (detailsSection) {
        detailsSection.hidden = true;
      }
      setStatusBanner(statusBanner, message, tone || 'error');
      if (statusDetail) {
        statusDetail.hidden = true;
        statusDetail.textContent = '';
      }
      if (ticketStatusDetail) {
        ticketStatusDetail.hidden = true;
        ticketStatusDetail.textContent = '';
      }
      if (ticketUsageNote) {
        ticketUsageNote.hidden = true;
      }
      updateActions('');
    }

    function fetchTicket() {
      if (state.isFetching) {
        return;
      }

      var url = '../../../Backend/verifyTicket.php';
      var query = new URLSearchParams({
        ticket_id: state.ticketId,
        user_id: state.userId,
      });

      setFetchingState(true);
      setStatusBanner(statusBanner, 'Verifying ticket…', null);

      fetch(url + '?' + query.toString(), { credentials: 'include' })
        .then(function (response) {
          if (response.status === 401) {
            redirectToLogin();
            return Promise.reject(new Error('unauthorized'));
          }

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
          if (error && error.message === 'unauthorized') {
            return;
          }
          handleError(error.message || 'Ticket could not be verified.', 'error');
        })
        .finally(function () {
          setFetchingState(false);
        });
    }

    function submitAction(action) {
      if (state.isUpdating || !state.ticket) {
        return;
      }

      var noteValue = noteInput ? trimNote(noteInput.value) : '';

      if (action === 'cancel' && !noteValue) {
        showFormError('Please add a short note before cancelling this ticket.');
        if (noteInput) {
          noteInput.focus();
        }
        return;
      }

      state.isUpdating = true;
      updateActions(normalizeStatus(state.ticket.status));
      clearFormError();
      setStatusBanner(statusBanner, 'Updating ticket status…', null);

      var formData = new FormData();
      formData.append('ticket_id', state.ticketId);
      formData.append('user_id', state.userId);
      formData.append('action', action);
      if (noteValue) {
        formData.append('note', noteValue);
      }

      fetch('../../../Backend/verifyTicket.php', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(function (response) {
          if (response.status === 401) {
            redirectToLogin();
            return Promise.reject(new Error('unauthorized'));
          }

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
          renderTicket(payload.ticket);
          setStatusBanner(statusBanner, payload.message || 'Ticket updated successfully.', 'success');

          if (noteInput) {
            noteInput.value = '';
            updateNoteCounter();
          }

          if (action === 'use' && overlay) {
            overlay.hidden = false;
            setTimeout(function () {
              redirectToHistory();
            }, 1200);
          } else {
            setTimeout(function () {
              redirectToHistory();
            }, 900);
          }
        })
        .catch(function (error) {
          if (error && error.message === 'unauthorized') {
            return;
          }
          setStatusBanner(statusBanner, error.message || 'Failed to update the ticket.', 'error');
          if (action === 'cancel') {
            showFormError(error.message || 'Unable to cancel the ticket.');
          }
        })
        .finally(function () {
          state.isUpdating = false;
          if (state.ticket) {
            updateActions(normalizeStatus(state.ticket.status));
          } else {
            updateActions('');
          }
        });
    }

    if (markUsedButton) {
      markUsedButton.addEventListener('click', function () {
        submitAction('use');
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', function () {
        submitAction('cancel');
      });
    }

    updateNoteCounter();
    fetchTicket();
  });
})();
