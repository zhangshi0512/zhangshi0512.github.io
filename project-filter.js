// Project Filter Functionality
(function() {
  'use strict';

  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  if (filterBtns.length === 0 || projectCards.length === 0) {
    return; // Exit if no filter buttons or cards found
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Optimized: directly select and remove active class from current active button
      const activeBtn = document.querySelector('.filter-btn.active');
      if (activeBtn) {
        activeBtn.classList.remove('active');
      }
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      // Simplified card filtering logic
      projectCards.forEach(card => {
        const categories = card.getAttribute('data-category');
        const isVisible = filter === 'all' || (categories && categories.includes(filter));
        card.style.display = isVisible ? 'block' : 'none';
      });
    });
  });
})();
