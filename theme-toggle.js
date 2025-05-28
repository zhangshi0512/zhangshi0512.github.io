document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');

    const body = document.body;

    // Function to apply the current theme
    function applyTheme(theme) {
        if (theme === 'dark-theme') {
            body.classList.add('dark-theme');
            // Update button text/state if needed
            // if (themeToggleButton) themeToggleButton.textContent = 'Switch to Light';
        } else {
            body.classList.remove('dark-theme');
            // Update button text/state if needed
            // if (themeToggleButton) themeToggleButton.textContent = 'Switch to Dark';
        }
    }

    // Load saved theme or default to light
    let currentTheme = localStorage.getItem('theme') || 'light-theme';
    applyTheme(currentTheme);

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            if (body.classList.contains('dark-theme')) {
                currentTheme = 'light-theme';
            } else {
                currentTheme = 'dark-theme';
            }
            localStorage.setItem('theme', currentTheme);
            applyTheme(currentTheme);

        });
    }
});
