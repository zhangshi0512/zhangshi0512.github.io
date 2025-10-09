document.addEventListener('DOMContentLoaded', () => {
    const themeToggleLink = document.getElementById('theme-toggle-link');
    const body = document.body;

    // Function to apply the current theme
    function applyTheme(theme) {
        if (theme === 'dark-theme') {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
    }

    // Load saved theme or default to light
    let currentTheme = localStorage.getItem('theme') || 'light-theme';
    applyTheme(currentTheme);

    if (themeToggleLink) {
        themeToggleLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent the link from navigating
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
