/** Shared blog list + reader for index preview and blog.html archive. */
(function () {
  const CONFIG = { owner: 'zhangshi0512', repo: 'shizhang.github.io', path: '_posts' };

  if (typeof marked !== 'undefined') {
    const mermaidRenderer = new marked.Renderer();
    mermaidRenderer.code = function (code, lang) {
      let codeText = typeof code === 'object' ? code.text : code;
      let language = (typeof code === 'object' ? code.lang : lang) || '';
      language = language.toLowerCase().trim();
      const trimmedCode = codeText.trim();
      if (language.includes('mermaid') || trimmedCode.toLowerCase().includes('graph ')) {
        const escapedCode = codeText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<div class="mermaid" data-source="${encodeURIComponent(codeText)}" style="display: block; margin: 2rem 0; background: transparent; overflow-x: auto; max-width: 100%; min-height: 50px; text-align: center;">${escapedCode}</div>`;
      }
      const escapedMain = codeText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre><code class="language-${language}">${escapedMain}</code></pre>`;
    };
    marked.setOptions({ renderer: mermaidRenderer });
  }

  async function runMermaid() {
    if (window.mermaid) {
      await mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
      await mermaid.run();
    }
  }

  function parsePostFile(file, text) {
    let content = text;
    let title = file.name.substring(11).replace(/-/g, ' ').replace('.md', '');
    let date = file.name.substring(0, 10);
    let tags = [];

    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (fmMatch) {
      content = text.replace(fmMatch[0], '');
      const fm = fmMatch[1];
      const titleMatch = fm.match(/title:\s*(.*)/);
      if (titleMatch) title = titleMatch[1].replace(/^["']|["']$/g, '');
      const dateMatch = fm.match(/date:\s*(.*)/);
      if (dateMatch) date = dateMatch[1].trim();
      const tagsMatch = fm.match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) tags = tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
    }

    const plainText = content
      .replace(/^# .+\n/m, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/[#*`_\[\]]/g, '')
      .trim();
    const excerpt =
      plainText.length > 0
        ? plainText.substring(0, 160).replace(/\s\w+$/, '') + '...'
        : '';
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 225));

    return { file, title, date, excerpt, readTime, wordCount, tags };
  }

  function renderCard(post, index, onOpen) {
    const card = document.createElement('div');
    card.className = 'blog-card reveal visible';
    card.style.transitionDelay = `${index * 0.1}s`;
    card.innerHTML = `
      <div class="blog-card-date">${post.date} · ${post.readTime} min read</div>
      <div class="blog-card-title">${post.title}</div>
      <div class="blog-card-excerpt">${post.excerpt}</div>
      <div class="blog-card-tags">${post.tags.map((t) => `<span class="blog-card-tag">${t}</span>`).join('')}</div>
      <div class="blog-card-read">Read →</div>
    `;
    card.onclick = () => onOpen(post.file.name);
    return card;
  }

  async function loadBlogList(options) {
    const {
      gridId = 'blog-grid',
      limit = null,
      viewAllId = 'blog-view-all',
      onPostsLoaded = null,
    } = options;

    const blogGrid = document.getElementById(gridId);
    if (!blogGrid) return;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.path}`
      );
      if (!response.ok) throw new Error('Failed to load posts');
      const files = await response.json();

      const postFiles = files
        .filter((f) => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name));

      if (postFiles.length === 0) {
        blogGrid.innerHTML = '<div class="blog-empty">No published posts yet.</div>';
        return;
      }

      const postsData = (
        await Promise.all(
          postFiles.map(async (file) => {
            try {
              const res = await fetch(
                `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/main/${CONFIG.path}/${file.name}`
              );
              const text = await res.text();
              return parsePostFile(file, text);
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);

      const viewAllBtn = viewAllId ? document.getElementById(viewAllId) : null;
      if (viewAllBtn) {
        viewAllBtn.style.display = limit && postsData.length > limit ? 'inline-flex' : 'none';
      }

      const postsToShow = limit ? postsData.slice(0, limit) : postsData;

      blogGrid.innerHTML = '';
      postsToShow.forEach((post, index) => {
        const card = renderCard(post, index, (filename) => {
          const base = options.readerBasePath || window.location.pathname;
          window.history.pushState({}, '', `${base}?post=${encodeURIComponent(filename)}`);
          openPostReader(filename, options);
        });
        blogGrid.appendChild(card);
        if (window.__blogRevealObserver) window.__blogRevealObserver.observe(card);
      });

      if (onPostsLoaded) onPostsLoaded(postsData.length, postsToShow.length);
    } catch (error) {
      console.error(error);
      blogGrid.innerHTML = '<div class="blog-empty">Failed to load posts.</div>';
    }
  }

  async function openPostReader(filename, options = {}) {
    const readerId = options.readerId || 'blog-reader';
    const reader = document.getElementById(readerId);
    if (!reader) return;

    document.getElementById('reader-title').textContent = 'Loading...';
    document.getElementById('reader-meta').textContent = '';
    document.getElementById('reader-body').innerHTML = '';
    reader.classList.add('open');
    reader.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/main/${CONFIG.path}/${filename}`
      );
      if (!response.ok) throw new Error('Post not found');
      const text = await response.text();

      let content = text;
      let title = filename.substring(11).replace(/-/g, ' ').replace('.md', '');
      let date = filename.substring(0, 10);
      let tags = [];
      let source = '';

      const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
      if (fmMatch) {
        content = text.replace(fmMatch[0], '');
        const fm = fmMatch[1];
        const titleMatch = fm.match(/title:\s*(.*)/);
        if (titleMatch) title = titleMatch[1].replace(/^["']|["']$/g, '');
        const dateMatch = fm.match(/date:\s*(.*)/);
        if (dateMatch) date = dateMatch[1].trim();
        const tagsMatch = fm.match(/tags:\s*\[(.*?)\]/);
        if (tagsMatch) tags = tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
        const sourceMatch = fm.match(/source:\s*(.*)/);
        if (sourceMatch) source = sourceMatch[1].trim();
      }

      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const readTime = Math.max(1, Math.ceil(wordCount / 225));

      const parseFn = marked.parse || marked;
      const html = parseFn(content);

      document.getElementById('reader-title').textContent = title;
      document.getElementById('reader-meta').innerHTML = [
        `${date} · ${readTime} min read`,
        tags.length ? tags.join(', ') : '',
        source
          ? `<a href="${source}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-underline-offset:3px;">Originally on X</a>`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      document.getElementById('reader-body').innerHTML = html;

      requestAnimationFrame(runMermaid);
    } catch (error) {
      console.error(error);
      document.getElementById('reader-body').innerHTML = 'Error loading post.';
    }
  }

  function initReader(options = {}) {
    const readerId = options.readerId || 'blog-reader';
    const reader = document.getElementById(readerId);
    const backPath = options.backPath || window.location.pathname;

    const backBtn = document.getElementById('reader-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        reader.classList.remove('open');
        document.body.style.overflow = '';
        window.history.pushState({}, '', backPath);
      });
    }

    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const post = params.get('post');
      if (post) openPostReader(post, options);
      else {
        reader.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    const postName = new URLSearchParams(window.location.search).get('post');
    if (postName) openPostReader(postName, options);
  }

  window.BlogApp = {
    CONFIG,
    loadBlogList,
    openPostReader,
    initReader,
  };
})();
