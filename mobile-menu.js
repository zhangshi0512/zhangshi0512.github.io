// Mobile Menu Toggle Functionality
(function() {
  'use strict';

  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!mobileMenuToggle || !navLinks) {
    return; // Exit if elements not found
  }

  mobileMenuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');

    // Update aria-expanded attribute for accessibility
    const isExpanded = navLinks.classList.contains('active');
    mobileMenuToggle.setAttribute('aria-expanded', isExpanded);

    // Change icon
    mobileMenuToggle.textContent = isExpanded ? '✕' : '☰';
  });

  // Close menu when clicking on a link
  const navLinksItems = navLinks.querySelectorAll('a');
  navLinksItems.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
      mobileMenuToggle.textContent = '☰';
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
      navLinks.classList.remove('active');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
      mobileMenuToggle.textContent = '☰';
    }
  });
})();
