
// --- configuration ---
const CONFIG = {
    repoOwner: 'zhangshi0512',
    repoName: 'shizhang.github.io',
    branch: 'main', 
    path: '_posts'
};

// --- state ---
let octokit = null;
let currentUser = null;
let currentFileSha = null;
let currentFilePath = null;
let unsavedChanges = false;

// --- initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check for existing token
    const token = localStorage.getItem('gh_token');
    
    // Bind Login Button
    const saveTokenBtn = document.getElementById('save-token-btn');
    if(saveTokenBtn) {
        saveTokenBtn.addEventListener('click', async () => {
            const input = document.getElementById('gh-token-input');
            const newToken = input.value.trim();
            if(!newToken) return alert("Please enter a token");
            
            try {
                await initializeGithub(newToken);
                localStorage.setItem('gh_token', newToken);
                hideLogin();
            } catch (error) {
                alert("Invalid Token. Please check and try again.");
                console.error(error);
            }
        });
    }

    // Bind Logout
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.addEventListener('click', logout);

    // Bind Editor Save
    const savePostBtn = document.getElementById('save-post-btn');
    if(savePostBtn) savePostBtn.addEventListener('click', saveCurrentPost);
    
    // Auto-resize textarea
    const textarea = document.getElementById('editor-content');
    if(textarea) {
        textarea.addEventListener('input', () => {
            updatePreview();
            unsavedChanges = true;
        });
    }

    if (token) {
        try {
            await initializeGithub(token);
        } catch (error) {
            console.error("Auth failed", error);
            showLogin();
        }
    } else {
        showLogin();
    }
});

// --- auth flow ---
function showLogin() {
    const modal = document.getElementById('login-modal');
    const app = document.getElementById('app-container');
    if(modal) modal.classList.remove('hidden');
    if(app) app.classList.add('blur-sm');
}

function hideLogin() {
    const modal = document.getElementById('login-modal');
    const app = document.getElementById('app-container');
    if(modal) modal.classList.add('hidden');
    if(app) app.classList.remove('blur-sm');
}

async function logout() {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_user');
    window.location.reload();
}

async function initializeGithub(token) {
    // 1. Init Octokit
    const { Octokit } = await import("https://esm.sh/octokit");
    octokit = new Octokit({ auth: token });

    // 2. Validate & Get User
    const { data: user } = await octokit.rest.users.getAuthenticated();
    currentUser = user;
    
    // 3. Update UI
    const avatar = document.getElementById('user-avatar');
    if(avatar) avatar.src = user.avatar_url;
    
    const msg = document.getElementById('welcome-msg');
    if(msg) msg.textContent = `Good evening, ${user.login}`;
    
    hideLogin();
    loadPosts();
}

// --- data fetching ---
async function loadPosts() {
    const listContainer = document.getElementById('post-list');
    if(!listContainer) return;
    
    listContainer.innerHTML = '<div class="text-center text-gray-400 mt-10">Loading posts...</div>';

    try {
        const { data: files } = await octokit.rest.repos.getContent({
            owner: CONFIG.repoOwner,
            repo: CONFIG.repoName,
            path: CONFIG.path
        });

        // Filter and sort
        const posts = Array.isArray(files) 
            ? files.filter(f => f.name.endsWith('.md')).sort((a,b) => b.name.localeCompare(a.name))
            : [];

        listContainer.innerHTML = '';
        if(posts.length === 0) {
             listContainer.innerHTML = '<div class="text-center text-gray-400 mt-10">No posts found.</div>';
        } else {
            posts.forEach(file => {
                const item = createPostListItem(file);
                listContainer.appendChild(item);
            });
        }

    } catch (error) {
        if(error.status === 404) {
             listContainer.innerHTML = '<div class="text-center text-gray-400 mt-10">_posts folder not found. Create your first post!</div>';
        } else {
             console.error(error);
             listContainer.innerHTML = `<div class="text-red-400 mt-10 text-xs p-4">Error loading posts: ${error.message}</div>`;
        }
    }
}

function createPostListItem(file) {
    const displayName = file.name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
    const datePart = file.name.match(/^\d{4}-\d{2}-\d{2}/) ? file.name.match(/^\d{4}-\d{2}-\d{2}/)[0] : 'Draft';

    const div = document.createElement('div');
    div.className = "group cursor-pointer hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5";
    div.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-gray-500 font-mono">${datePart}</span>
            <span class="text-white font-medium capitalize truncate">${displayName}</span>
        </div>
        <div class="h-[1px] bg-white/5 w-full group-hover:bg-white/10 transition-colors"></div>
    `;
    div.onclick = () => loadPostContent(file);
    return div;
}

// --- editor logic ---
async function loadPostContent(file) {
    if(unsavedChanges) {
        if(!confirm("You have unsaved changes. Discard them?")) return;
    }

    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: CONFIG.repoOwner,
            repo: CONFIG.repoName,
            path: file.path,
            ref: CONFIG.branch
        });

        const content = atob(data.content); // Base64 decode
        
        currentFileSha = data.sha;
        currentFilePath = file.path;
        
        const titleInput = document.getElementById('editor-title');
        const contentInput = document.getElementById('editor-content');
        
        if(titleInput) titleInput.value = file.name;
        if(contentInput) contentInput.value = content;
        
        // Use global openDetail from HTML
        if(window.openDetail) window.openDetail(file.name, 'Blog Post');
        
        updatePreview();
        unsavedChanges = false;

    } catch (error) {
        console.error(error);
        alert("Failed to load file content");
    }
}

async function saveCurrentPost() {
    const content = document.getElementById('editor-content').value;
    const filename = document.getElementById('editor-title').value;
    
    if(!filename.endsWith('.md')) {
        alert("Filename must end with .md");
        return;
    }

    let path = currentFilePath;
    let sha = currentFileSha;
    
    if(!path || path.split('/').pop() !== filename) {
        path = `${CONFIG.path}/${filename}`;
        try {
             const { data } = await octokit.rest.repos.getContent({
                owner: CONFIG.repoOwner,
                repo: CONFIG.repoName,
                path: path
            });
            sha = data.sha;
        } catch (e) {
            sha = null;
        }
    }

    try {
        // Unicode safe base64 encoding
        const base64Content = btoa(unescape(encodeURIComponent(content))); 
        
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: CONFIG.repoOwner,
            repo: CONFIG.repoName,
            path: path,
            message: `Update ${filename} via Dashboard`,
            content: base64Content,
            sha: sha || undefined,
            branch: CONFIG.branch
        });
        
        alert("Saved successfully!");
        unsavedChanges = false;
        loadPosts(); 

    } catch (error) {
        console.error(error);
        alert(`Error saving: ${error.message}`);
    }
}

function updatePreview() {
    const content = document.getElementById('editor-content').value;
    const container = document.getElementById('preview-container');
    if(container && window.marked) {
        // Simple frontmatter removal for preview if needed, or just render it
        const html = marked.parse(content);
        container.innerHTML = `<article class="prose prose-invert prose-sm max-w-none">${html}</article>`;
    }
}
