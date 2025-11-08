document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-button');
  const ticketList = document.querySelector('#ticket-list');

  if (!filterButtons.length || !ticketList) {
    return;
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.classList.contains('is-active')) {
        return;
      }

      filterButtons.forEach((btn) => btn.classList.remove('is-active'));
      button.classList.add('is-active');

      const filter = button.dataset.filter || 'active';
      ticketList.dataset.filter = filter;
    });
  });
});
