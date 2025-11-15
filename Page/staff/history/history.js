(function (window, document) {
  'use strict';

  var API_PATH = '../../../Backend/staffHistory.php';
  var LOGIN_PATH = '/Page/staff/auth/login.html';
  var HOME_PATH = '../home/home.html';

  var RESULT_META = {
    ACCEPTED: {
      label: 'Ticket verified',
      cardLabel: 'Verified',
      tone: 'success',
    },
    REJECTED: {
      label: 'Ticket cancelled',
      cardLabel: 'Cancelled',
      tone: 'danger',
    },
  };

  var MONTH_LABELS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function formatDateForDisplay(value) {
    if (!value) {
      return '—';
    }

    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        var parts = value.split('-');
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(
            new Date(year, month, day)
          );
        }
      }

      var parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(parsed);
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
      var parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(parsed);
      }
    } catch (error) {
      return value;
    }

    return value;
  }

  function formatDateTimeForDisplay(value) {
    if (!value) {
      return '—';
    }

    try {
      var parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(parsed);
      }
    } catch (error) {
      return value;
    }

    return value;
  }

  function formatCurrency(value) {
    if (value === undefined || value === null || value === '') {
      return '—';
    }

    var numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return String(value);
    }

    return '฿' + numeric.toFixed(2);
  }

  function trimNote(value) {
    return value ? String(value).trim() : '';
  }

  function getMonthLabel(monthNumber) {
    var index = Number(monthNumber) - 1;
    if (index >= 0 && index < MONTH_LABELS.length) {
      return MONTH_LABELS[index];
    }
    return '—';
  }

  function buildPeriodLabel(month, year) {
    var monthLabel = getMonthLabel(month);
    if (!year) {
      return monthLabel;
    }
    return monthLabel + ' ' + year;
  }

  function resolvePath(path) {
    if (!path || path.charAt(0) !== '/') {
      return path;
    }

    var base = window.location.pathname;
    var index = base.indexOf('/Page/');
    if (index !== -1) {
      base = base.substring(0, index);
    }

    if (base.endsWith('/')) {
      base = base.slice(0, -1);
    }

    return base + path;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var backButton = document.getElementById('history-back-button');
    var monthSelect = document.getElementById('history-month-select');
    var yearSelect = document.getElementById('history-year-select');
    var listElement = document.getElementById('history-list');
    var loadingElement = document.getElementById('history-loading');
    var errorElement = document.getElementById('history-error');
    var emptyElement = document.getElementById('history-empty');
    var summaryElement = document.getElementById('history-filter-summary');
    var sectionElement = document.querySelector('.history-section');
    var dialogElement = document.getElementById('history-dialog');
    var dialogClose = document.getElementById('history-dialog-close');
    var dialogAction = document.getElementById('history-dialog-action');
    var dialogTitle = document.getElementById('history-dialog-title');
    var dialogTimestamp = document.getElementById('history-dialog-timestamp');
    var detailTicketId = document.getElementById('history-detail-ticket-id');
    var detailPassenger = document.getElementById('history-detail-passenger');
    var detailStatus = document.getElementById('history-detail-status');
    var detailOrigin = document.getElementById('history-detail-origin');
    var detailDestination = document.getElementById('history-detail-destination');
    var detailDate = document.getElementById('history-detail-date');
    var detailDeparture = document.getElementById('history-detail-departure');
    var detailArrival = document.getElementById('history-detail-arrival');
    var detailAction = document.getElementById('history-detail-action');
    var detailProcessedAt = document.getElementById('history-detail-processed-at');
    var detailQuantity = document.getElementById('history-detail-quantity');
    var detailPrice = document.getElementById('history-detail-price');
    var detailIssuedAt = document.getElementById('history-detail-issued-at');
    var detailTicketUsage = document.getElementById('history-detail-ticket-usage');
    var detailNote = document.getElementById('history-detail-note');

    var state = {
      isSyncingFilters: false,
      selectedMonth: null,
      selectedYear: null,
      availableYears: [],
      periods: [],
      items: [],
      isDialogOpen: false,
    };

    function closeDialog() {
      if (!dialogElement || !state.isDialogOpen) {
        return;
      }

      dialogElement.setAttribute('hidden', 'hidden');
      dialogElement.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-modal-open');
      state.isDialogOpen = false;
      document.removeEventListener('keydown', handleDialogKeyDown);
    }

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') {
        closeDialog();
      }
    }

    function setDialogBadgeTone(tone) {
      if (!dialogAction) {
        return;
      }

      dialogAction.classList.remove('is-success', 'is-danger');
      if (tone === 'success') {
        dialogAction.classList.add('is-success');
      } else if (tone === 'danger') {
        dialogAction.classList.add('is-danger');
      }
    }

    function renderDialog(entry) {
      if (!dialogElement || !entry) {
        return;
      }

      var resultKey = entry.result ? String(entry.result).toUpperCase() : '';
      var resultMeta = RESULT_META[resultKey] || {
        label: 'Ticket action',
        cardLabel: 'Action',
        tone: 'info',
      };

      if (dialogAction) {
        dialogAction.textContent = resultMeta.cardLabel;
        setDialogBadgeTone(resultMeta.tone);
      }

      if (dialogTitle) {
        dialogTitle.textContent = 'Ticket #' + (entry.ticket_id || entry.ticket?.ticket_id || '—');
      }

      if (dialogTimestamp) {
        dialogTimestamp.textContent = 'Processed on ' + formatDateTimeForDisplay(entry.used_at || entry.used_at_iso);
      }

      var ticket = entry.ticket || {};
      if (detailTicketId) {
        detailTicketId.textContent = ticket.ticket_id || entry.ticket_id || '—';
      }

      if (detailPassenger) {
        detailPassenger.textContent = ticket.username || '—';
      }

      if (detailStatus) {
        detailStatus.textContent = ticket.status || '—';
      }

      if (detailOrigin) {
        detailOrigin.textContent = ticket.origin || '—';
      }

      if (detailDestination) {
        detailDestination.textContent = ticket.destination || '—';
      }

      if (detailDate) {
        detailDate.textContent = formatDateForDisplay(ticket.travel_date);
      }

      if (detailDeparture) {
        detailDeparture.textContent = formatTimeForDisplay(ticket.departure_time);
      }

      if (detailArrival) {
        detailArrival.textContent = formatTimeForDisplay(ticket.arrival_time);
      }

      if (detailAction) {
        detailAction.textContent = resultMeta.label;
      }

      if (detailProcessedAt) {
        detailProcessedAt.textContent = formatDateTimeForDisplay(entry.used_at || entry.used_at_iso);
      }

      if (detailQuantity) {
        var quantity = ticket.quantity || 1;
        detailQuantity.textContent = quantity;
      }

      if (detailPrice) {
        detailPrice.textContent = formatCurrency(ticket.price);
      }

      if (detailIssuedAt) {
        detailIssuedAt.textContent = formatDateTimeForDisplay(ticket.issued_at);
      }

      if (detailTicketUsage) {
        var usageText = ticket.used_at || ticket.cancelled_at;
        detailTicketUsage.textContent = usageText ? formatDateTimeForDisplay(usageText) : '—';
      }

      if (detailNote) {
        var noteText = trimNote(entry.note) || 'No staff note recorded for this action.';
        detailNote.textContent = noteText;
      }

      dialogElement.removeAttribute('hidden');
      dialogElement.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-modal-open');
      state.isDialogOpen = true;
      document.addEventListener('keydown', handleDialogKeyDown);

      if (dialogClose) {
        dialogClose.focus();
      }
    }

    function handleCardClick(event) {
      var target = event.currentTarget;
      if (!target) {
        return;
      }

      var index = target.getAttribute('data-index');
      if (index === null) {
        return;
      }

      var entry = state.items[Number(index)];
      if (!entry) {
        return;
      }

      renderDialog(entry);
    }

    function clearList() {
      if (listElement) {
        listElement.innerHTML = '';
      }
    }

    function renderHistory(items) {
      if (!listElement) {
        return;
      }

      clearList();

      if (!Array.isArray(items) || items.length === 0) {
        return;
      }

      items.forEach(function (entry, index) {
        var resultKey = entry.result ? String(entry.result).toUpperCase() : '';
        var resultMeta = RESULT_META[resultKey] || {
          cardLabel: 'Action',
          tone: 'neutral',
        };

        var li = document.createElement('li');
        li.className = 'history-card';
        if (resultMeta.tone === 'success') {
          li.classList.add('history-card--success');
        } else if (resultMeta.tone === 'danger') {
          li.classList.add('history-card--danger');
        }

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'history-card__button';
        button.setAttribute('data-index', String(index));
        button.addEventListener('click', handleCardClick);

        var status = document.createElement('span');
        status.className = 'history-card__status';

        var bullet = document.createElement('span');
        bullet.className = 'history-card__status-bullet';
        status.appendChild(bullet);
        status.appendChild(document.createTextNode(resultMeta.cardLabel));

        var body = document.createElement('div');
        body.className = 'history-card__body';

        var ticketLabel = document.createElement('span');
        ticketLabel.className = 'history-card__ticket';
        ticketLabel.textContent = 'Ticket #' + (entry.ticket_id || '—');

        var meta = document.createElement('span');
        meta.className = 'history-card__meta';
        meta.textContent = formatDateTimeForDisplay(entry.used_at || entry.used_at_iso);

        var noteText = trimNote(entry.note);
        if (noteText) {
          var note = document.createElement('span');
          note.className = 'history-card__note';
          note.textContent = noteText;
          body.appendChild(note);
        }

        body.insertBefore(meta, body.firstChild);
        body.insertBefore(ticketLabel, body.firstChild);

        var chevron = document.createElement('span');
        chevron.className = 'history-card__chevron';
        chevron.innerHTML =
          '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M9 5a1 1 0 0 1 .7.29l6 6a1 1 0 0 1 0 1.42l-6 6a1 1 0 0 1-1.4-1.42L13.09 12 8.3 7.29A1 1 0 0 1 9 5Z"></path></svg>';

        button.appendChild(status);
        button.appendChild(body);
        button.appendChild(chevron);
        li.appendChild(button);
        listElement.appendChild(li);
      });
    }

    function setLoadingState(isLoading) {
      if (loadingElement) {
        if (isLoading) {
          loadingElement.hidden = false;
        } else {
          loadingElement.hidden = true;
        }
      }

      if (sectionElement) {
        sectionElement.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      }
    }

    function setError(message) {
      if (!errorElement) {
        return;
      }

      if (message) {
        errorElement.textContent = message;
        errorElement.hidden = false;
      } else {
        errorElement.hidden = true;
        errorElement.textContent = '';
      }
    }

    function updateEmptyState(items) {
      if (!emptyElement) {
        return;
      }

      if (!Array.isArray(items) || items.length === 0) {
        emptyElement.hidden = false;
      } else {
        emptyElement.hidden = true;
      }
    }

    function updateSummary(month, year) {
      if (!summaryElement) {
        return;
      }

      summaryElement.textContent = 'Showing activity for ' + buildPeriodLabel(month, year) + '.';
    }

    function populateMonthOptions(select) {
      if (!select) {
        return;
      }

      select.innerHTML = '';
      MONTH_LABELS.forEach(function (label, index) {
        var option = document.createElement('option');
        option.value = String(index + 1);
        option.textContent = label;
        select.appendChild(option);
      });
    }

    function populateYearOptions(select, years, fallbackYear) {
      if (!select) {
        return;
      }

      var uniqueYears = Array.isArray(years) && years.length > 0 ? years.slice() : [];
      if (fallbackYear && uniqueYears.indexOf(fallbackYear) === -1) {
        uniqueYears.push(fallbackYear);
      }

      uniqueYears.sort(function (a, b) {
        return b - a;
      });

      select.innerHTML = '';
      uniqueYears.forEach(function (year) {
        var option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        select.appendChild(option);
      });
    }

    function syncFilters(filters) {
      if (!filters) {
        return;
      }

      state.isSyncingFilters = true;

      var month = filters.selected && filters.selected.month ? Number(filters.selected.month) : state.selectedMonth;
      var year = filters.selected && filters.selected.year ? Number(filters.selected.year) : state.selectedYear;

      state.selectedMonth = month;
      state.selectedYear = year;

      var availableYears = (filters.available && filters.available.years) || [];
      state.availableYears = availableYears.map(function (value) {
        return Number(value);
      });

      populateYearOptions(yearSelect, state.availableYears, year);

      if (monthSelect) {
        monthSelect.value = String(month);
      }

      if (yearSelect) {
        yearSelect.value = String(year);
      }

      updateSummary(month, year);

      state.isSyncingFilters = false;
    }

    function applyHistoryResponse(payload) {
      var filters = payload && payload.filters ? payload.filters : {};

      state.items = Array.isArray(payload.history) ? payload.history : [];
      state.periods = Array.isArray(filters.periods) ? filters.periods : [];

      syncFilters(filters);

      renderHistory(state.items);
      updateEmptyState(state.items);
    }

    function handleFetchError(error) {
      if (error && error.message === 'unauthorized') {
        window.location.href = resolvePath(LOGIN_PATH);
        return;
      }

      setError(error && error.message ? error.message : 'Unable to load staff history at this time.');
      state.items = [];
      renderHistory(state.items);
      updateEmptyState(state.items);
    }

    function fetchHistory(month, year) {
      setError('');
      setLoadingState(true);

      var params = new URLSearchParams();
      if (month) {
        params.set('month', String(month));
      }
      if (year) {
        params.set('year', String(year));
      }

      var url = API_PATH;
      if (params.toString()) {
        url += '?' + params.toString();
      }

      fetch(url, { credentials: 'include' })
        .then(function (response) {
          if (response.status === 401) {
            window.location.href = resolvePath(LOGIN_PATH);
            return Promise.reject(new Error('unauthorized'));
          }

          if (!response.ok) {
            throw new Error('Unable to load staff history at this time.');
          }

          return response.json();
        })
        .then(function (payload) {
          if (!payload || payload.status !== 'success') {
            var message = (payload && payload.message) || 'Unable to load staff history at this time.';
            throw new Error(message);
          }

          applyHistoryResponse(payload);
        })
        .catch(function (error) {
          handleFetchError(error);
        })
        .finally(function () {
          setLoadingState(false);
        });
    }

    function handleFilterChange() {
      if (state.isSyncingFilters) {
        return;
      }

      var month = monthSelect ? Number(monthSelect.value) : state.selectedMonth;
      var year = yearSelect ? Number(yearSelect.value) : state.selectedYear;

      state.selectedMonth = month;
      state.selectedYear = year;

      fetchHistory(month, year);
    }

    if (monthSelect) {
      populateMonthOptions(monthSelect);
      monthSelect.addEventListener('change', handleFilterChange);
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', handleFilterChange);
    }

    if (backButton) {
      backButton.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = HOME_PATH;
        }
      });
    }

    if (dialogClose) {
      dialogClose.addEventListener('click', closeDialog);
    }

    if (dialogElement) {
      dialogElement.addEventListener('click', function (event) {
        if (event.target && event.target.getAttribute('data-role') === 'dismiss') {
          closeDialog();
        }
      });
    }

    fetchHistory();
  });
})(window, document);
