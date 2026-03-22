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
        card.style.transform = `translateX(-120%) scale(1) translateY(0) rotate(0deg)`;
        card.style.zIndex = totalCards + 1; // Stay on top while leaving
        card.style.opacity = 0;
      } else {
        // Standard stacking: push back cards slightly down and to the right
        // You can adjust these values to change the visual depth of the stack
        const xOffset = relativeIndex * 15;
        const yOffset = relativeIndex * 15;
        const scale = Math.max(0.8, 1 - (relativeIndex * 0.05));
        const rotation = relativeIndex * 2; // Tilt cards 2 degrees per layer depth

        card.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${scale}) rotate(${rotation}deg)`;
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

  // Setup pagination dots
  const dotsContainer = document.getElementById('experience-stack-dots');
  let dots = [];

  if (dotsContainer) {
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.classList.add('stack-dot');
      if (i === 0) dot.classList.add('active');
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', `Go to experience card ${i + 1}`);
      dot.setAttribute('tabindex', '0');

      dot.addEventListener('click', () => jumpToCard(i));
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          jumpToCard(i);
        }
      });

      dotsContainer.appendChild(dot);
      dots.push(dot);
    });
  }

  const updateDots = () => {
    dots.forEach((dot, i) => {
      if (i === currentIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  };

  // Initial layout
  updateStackLayout();

  const jumpToCard = (targetIndex) => {
    if (isAnimating || targetIndex === currentIndex) return;

    // For direct jumping, we update the index instantly
    // without the single-card slide-out animation to keep it snappy.
    isAnimating = true;

    // Optional fade-out all visible cards for a brief shuffle effect
    cards.forEach(card => card.style.opacity = '0');

    setTimeout(() => {
      currentIndex = targetIndex;
      updateStackLayout();
      updateDots();

      setTimeout(() => {
        isAnimating = false;
      }, 500);
    }, 150); // slight delay to allow opacity transition
  };

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
            updateDots();

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

  // Autoplay Logic
  let autoPlayInterval;
  const AUTOPLAY_DELAY = 6000; // 6 seconds

  const startAutoPlay = () => {
    stopAutoPlay(); // clear any existing
    autoPlayInterval = setInterval(() => {
        // Find current top card and interact
        handleCardInteraction(cards[currentIndex]);
    }, AUTOPLAY_DELAY);
  };

  const stopAutoPlay = () => {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
    }
  };

  // Setup Intersection Observer to start autoplay only when visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            startAutoPlay();
        } else {
            stopAutoPlay();
        }
    });
  }, { threshold: 0.5 }); // Start when 50% of the stack is visible

  observer.observe(stackContainer);

  // Pause autoplay on user interaction (hover or focus)
  stackContainer.addEventListener('mouseenter', stopAutoPlay);
  stackContainer.addEventListener('mouseleave', () => {
      // Only restart if the stack is mostly in view to avoid hidden autoplays
      const bounding = stackContainer.getBoundingClientRect();
      const inView = (
          bounding.top < window.innerHeight &&
          bounding.bottom > 0
      );
      if (inView) {
          startAutoPlay();
      }
  });

  stackContainer.addEventListener('focusin', stopAutoPlay);
  stackContainer.addEventListener('focusout', startAutoPlay);

});
