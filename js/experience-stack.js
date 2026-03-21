document.addEventListener('DOMContentLoaded', () => {
  const stackContainer = document.getElementById('experience-stack');
  if (!stackContainer) return;

  const cards = Array.from(stackContainer.querySelectorAll('.stack-card'));
  let currentIndex = 0; // The index of the card that is currently at the top
  let isAnimating = false; // Guard to prevent rapid clicks

  const updateStackLayout = () => {
    const totalCards = cards.length;

    cards.forEach((card, i) => {
      // Find position of this card relative to current top
      const relativeIndex = (i - currentIndex + totalCards) % totalCards;

      // If the card is currently animating out, handle it separately
      if (card.classList.contains('animating-out')) {
        card.style.transform = `translateX(-120%) scale(1) translateY(0)`;
        card.style.zIndex = totalCards + 1; // Stay on top while leaving
        card.style.opacity = 0;
      } else {
        // Standard stacking: push back cards slightly down and to the right
        // You can adjust these values to change the visual depth of the stack
        const xOffset = relativeIndex * 15;
        const yOffset = relativeIndex * 15;
        const scale = Math.max(0.8, 1 - (relativeIndex * 0.05));

        card.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${scale})`;
        card.style.zIndex = totalCards - relativeIndex;

        // Show only the top few cards, hide the rest
        if (relativeIndex < 3) {
            // Keep opacity at 1 so cards behind don't bleed through
            // Instead, we can lower brightness using filter to simulate depth if desired,
            // or just rely on scale and overlap.
            card.style.opacity = 1;
            card.style.filter = `brightness(${100 - (relativeIndex * 15)}%)`;
            card.style.visibility = 'visible';
        } else {
            card.style.opacity = 0;
            card.style.visibility = 'hidden';
        }
      }
    });
  }

  // Initialize cards
  cards.forEach((card, i) => {
    card.setAttribute('tabindex', '0'); // Make focusable
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Experience card ${i + 1} of ${cards.length}`);
  });

  // Initial layout
  updateStackLayout();

  const handleCardInteraction = (clickedCard) => {
    if (isAnimating) return;

    const clickedIndex = cards.indexOf(clickedCard);

    // Only animate if the top card is interacted with
    if (clickedIndex === currentIndex) {
      isAnimating = true;
      // 1. Add class to animate top card out
      clickedCard.classList.add('animating-out');
      updateStackLayout(); // Move it off screen left

      // 2. Wait for animation to finish, then cycle array and update
      setTimeout(() => {
        clickedCard.classList.remove('animating-out');
        currentIndex = (currentIndex + 1) % cards.length;

        // Disable transition temporarily so it snaps behind instantly
        clickedCard.style.transition = 'none';
        updateStackLayout();

        // Restore transition after snap
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            clickedCard.style.transition = '';
            isAnimating = false;

            // Move focus to the new top card for accessibility
            cards[currentIndex].focus();
          });
        });
      }, 500); // 500ms matches CSS transition time (.5s in style-new.css)
    }
  };

  // Click handler
  stackContainer.addEventListener('click', (e) => {
    const clickedCard = e.target.closest('.stack-card');
    if (clickedCard) {
        handleCardInteraction(clickedCard);
    }
  });

  // Keyboard handler
  stackContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const activeCard = document.activeElement;
      if (activeCard && activeCard.classList.contains('stack-card')) {
        e.preventDefault(); // Prevent page scroll on Space
        handleCardInteraction(activeCard);
      }
    }
  });

});
