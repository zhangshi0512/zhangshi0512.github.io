document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const currentTheme = localStorage.getItem('theme');

    // Apply the saved theme on page load
    if (currentTheme) {
        document.body.classList.add(currentTheme);
        // If the saved theme is dark, and the button exists, you might want to update its text or state
        if (currentTheme === 'dark-theme' && themeToggleButton) {
            // Example: themeToggleButton.textContent = 'Switch to Light Theme';
        }
    } else {
        // Optional: Set a default theme if no theme is saved in localStorage
        // document.body.classList.add('light-theme'); // Assuming light-theme is default
    }

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');

            let theme = 'light-theme'; // Default to light theme
            if (document.body.classList.contains('dark-theme')) {
                theme = 'dark-theme';
                // Example: themeToggleButton.textContent = 'Switch to Light Theme';
            } else {
                // Example: themeToggleButton.textContent = 'Switch to Dark Theme';
            }
            localStorage.setItem('theme', theme);
        });
    }
});
