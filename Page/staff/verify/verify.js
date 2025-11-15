(function () {
  'use strict';

  var BOARDING_LEAD_MINUTES = 180;
  var BOARDING_INTERVAL_MS = 30000;

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

  function parseDateComponent(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    var normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    var isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      var year = parseInt(isoMatch[1], 10);
      var month = parseInt(isoMatch[2], 10) - 1;
      var day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day);
    }

    var parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    return null;
  }

  function parseTimeComponent(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes(),
        seconds: value.getSeconds(),
      };
    }

    var normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    var match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      var hours = parseInt(match[1], 10);
      var minutes = parseInt(match[2], 10);
      var seconds = match[3] ? parseInt(match[3], 10) : 0;

      if (
        Number.isInteger(hours) &&
        Number.isInteger(minutes) &&
        Number.isInteger(seconds) &&
        hours >= 0 &&
        hours < 24 &&
        minutes >= 0 &&
        minutes < 60 &&
        seconds >= 0 &&
        seconds < 60
      ) {
        return { hours: hours, minutes: minutes, seconds: seconds };
      }
    }

    var parsedTime = new Date(normalized);
    if (!Number.isNaN(parsedTime.getTime())) {
      return {
        hours: parsedTime.getHours(),
        minutes: parsedTime.getMinutes(),
        seconds: parsedTime.getSeconds(),
      };
    }

    return null;
  }

  function combineDateAndTime(dateValue, timeValue) {
    var datePart = parseDateComponent(dateValue);
    var timePart = parseTimeComponent(timeValue);

    if (!datePart || !timePart) {
      return null;
    }

    return new Date(
      datePart.getFullYear(),
      datePart.getMonth(),
      datePart.getDate(),
      timePart.hours,
      timePart.minutes,
      timePart.seconds || 0,
      0
    );
  }

  function computeBoardingInfo(ticket, status) {
    if (!ticket || status !== 'PAID') {
      return { supported: false, isReady: true };
    }

    var departureDateTime = combineDateAndTime(ticket.date, ticket.departure_time);
    if (!departureDateTime) {
      return { supported: false, isReady: true };
    }

    var leadMilliseconds = BOARDING_LEAD_MINUTES * 60 * 1000;
    var boardingTime = new Date(departureDateTime.getTime() - leadMilliseconds);
    var diff = boardingTime.getTime() - Date.now();

    return {
      supported: true,
      isReady: diff <= 0,
      boardingTime: boardingTime,
      departureTime: departureDateTime,
      diff: diff,
    };
  }

  function buildCountdownParts(diffMs) {
    if (diffMs <= 0) {
      return [];
    }

    var totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    var days = Math.floor(totalSeconds / 86400);
    totalSeconds -= days * 86400;
    var hours = Math.floor(totalSeconds / 3600);
    totalSeconds -= hours * 3600;
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;

    var parts = [];
    if (days > 0) {
      parts.push(days + ' day' + (days === 1 ? '' : 's'));
    }
    if (hours > 0) {
      parts.push(hours + ' hour' + (hours === 1 ? '' : 's'));
    }
    if (minutes > 0) {
      parts.push(minutes + ' minute' + (minutes === 1 ? '' : 's'));
    }
    if (parts.length === 0 && seconds > 0) {
      parts.push('less than a minute');
    }

    return parts;
  }

  function formatBoardingCountdown(diffMs) {
    var parts = buildCountdownParts(diffMs);

    if (parts.length === 0) {
      return '';
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
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

  function buildStatusDetail(ticket, status, boardingInfo) {
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
      if (boardingInfo && boardingInfo.supported && boardingInfo.boardingTime) {
        var boardingText = formatTimeForDisplay(boardingInfo.boardingTime);
        if (boardingText) {
          parts.push(
            (boardingInfo.isReady ? 'Boarding opened at ' : 'Boarding opens at ') +
              boardingText +
              ' (3 hours before departure)'
          );
        }
      }

      return parts.length > 0
        ? parts.join(' • ')
        : boardingInfo && boardingInfo.supported && !boardingInfo.isReady
        ? 'Ticket is valid but not yet within the boarding window.'
        : 'Ticket is ready for boarding.';
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
    var boardingCountdown = document.getElementById('boarding-countdown');
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
      boardingInfo: null,
      boardingTimer: null,
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

    function hideBoardingCountdown() {
      if (boardingCountdown) {
        boardingCountdown.hidden = true;
        boardingCountdown.textContent = '';
      }
    }

    function clearBoardingCountdown() {
      if (state.boardingTimer) {
        window.clearInterval(state.boardingTimer);
        state.boardingTimer = null;
      }
    }

    function updateBoardingCountdownDisplay() {
      if (!boardingCountdown || !state.boardingInfo || !state.boardingInfo.supported) {
        hideBoardingCountdown();
        return;
      }

      var diff = state.boardingInfo.boardingTime.getTime() - Date.now();
      if (diff <= 0) {
        hideBoardingCountdown();
        clearBoardingCountdown();
        if (!state.boardingInfo.isReady) {
          state.boardingInfo.isReady = true;
          renderTicket(state.ticket);
        }
        return;
      }

      var message = formatBoardingCountdown(diff);
      if (message) {
        boardingCountdown.textContent =
          'Boarding opens in ' + message + ' (3 hours before departure).';
        boardingCountdown.hidden = false;
      } else {
        hideBoardingCountdown();
      }
    }

    function startBoardingCountdown() {
      clearBoardingCountdown();

      if (!state.boardingInfo || !state.boardingInfo.supported || state.boardingInfo.isReady) {
        hideBoardingCountdown();
        return;
      }

      updateBoardingCountdownDisplay();

      state.boardingTimer = window.setInterval(function () {
        updateBoardingCountdownDisplay();
      }, BOARDING_INTERVAL_MS);
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

    function updateActions(status, boardingInfo) {
      var normalizedStatus = normalizeStatus(status);
      var isPaid = normalizedStatus === 'PAID';
      var boardingReady = !isPaid || !boardingInfo || !boardingInfo.supported || boardingInfo.isReady;

      if (markUsedButton) {
        markUsedButton.hidden = !isPaid;
        var canMarkUsed = isPaid && boardingReady && !state.isUpdating;
        markUsedButton.disabled = !canMarkUsed;
        markUsedButton.setAttribute('aria-disabled', String(markUsedButton.disabled));

        if (isPaid && !boardingReady) {
          markUsedButton.title = 'Boarding has not opened yet for this ticket.';
        } else {
          markUsedButton.removeAttribute('title');
        }
      }

      if (cancelButton) {
        cancelButton.hidden = !isPaid;
        var canCancel = isPaid && !state.isUpdating;
        cancelButton.disabled = !canCancel;
        cancelButton.setAttribute('aria-disabled', String(cancelButton.disabled));
      }

      if (form) {
        form.hidden = !isPaid;
      }

      if (!isPaid && noteInput) {
        noteInput.value = '';
        updateNoteCounter();
      }
    }

    function renderTicket(ticket) {
      if (!ticket) {
        clearBoardingCountdown();
        hideBoardingCountdown();
        if (detailsSection) {
          detailsSection.hidden = true;
        }
        return;
      }

      if (detailsSection) {
        detailsSection.hidden = false;
      }

      clearBoardingCountdown();

      var normalizedStatus = normalizeStatus(ticket.status);
      var statusMeta = STATUS_LABELS[normalizedStatus] || {
        label: normalizedStatus || 'Unknown',
        tone: 'warning',
        banner: 'Ticket status could not be determined. Please confirm with the passenger.',
      };

      var bannerTone = statusMeta.tone;
      var badgeTone = statusMeta.tone;
      var bannerMessage = ticket.message || statusMeta.banner;

      var boardingInfo = computeBoardingInfo(ticket, normalizedStatus);
      state.boardingInfo = boardingInfo;

      if (normalizedStatus === 'PAID' && boardingInfo.supported) {
        if (boardingInfo.isReady) {
          bannerTone = 'success';
          badgeTone = 'success';
          bannerMessage = 'Ticket is valid and ready to board.';
          hideBoardingCountdown();
        } else {
          bannerTone = 'warning';
          badgeTone = 'warning';
          bannerMessage = 'Ticket is valid but NOT ready to board.';
        }
      } else {
        hideBoardingCountdown();
      }

      if (ticketStatus) {
        ticketStatus.textContent = statusMeta.label;
        setBadgeTone(ticketStatus, badgeTone);
      }

      setStatusBanner(statusBanner, bannerMessage, bannerTone);

      var detailText = buildStatusDetail(ticket, normalizedStatus, boardingInfo);
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

      var latestUsage = extractLatestUsage(ticket);
      renderUsageNote(latestUsage);

      updateActions(normalizedStatus, boardingInfo);

      if (normalizedStatus === 'PAID' && boardingInfo.supported && !boardingInfo.isReady) {
        startBoardingCountdown();
      } else {
        hideBoardingCountdown();
      }

      if (boardingInfo && boardingInfo.supported && boardingInfo.isReady) {
        state.boardingInfo.isReady = true;
      }
    }

    function handleError(message, tone) {
      state.ticket = null;
      state.boardingInfo = null;
      clearBoardingCountdown();
      hideBoardingCountdown();
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
      updateActions('', null);
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
      updateActions(normalizeStatus(state.ticket.status), state.boardingInfo);
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
            updateActions(normalizeStatus(state.ticket.status), state.boardingInfo);
          } else {
            updateActions('', null);
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
