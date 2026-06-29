/**
 * agent-chat.js — Floating chat bubble + SSE streaming panel
 * for shizhang-agent backend (HF Spaces).
 *
 * v2 — adds Markdown rendering, transparent agent reasoning display.
 *
 * Backend URL is read from the global AGENT_CHAT_BACKEND or defaults below.
 *   <script>window.AGENT_CHAT_BACKEND = 'https://xxx.workers.dev';</script>
 *   <script src="agent-chat.js"></script>
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────
  const WIDGET_VERSION = '0.1.9';
  const BACKEND = window.AGENT_CHAT_BACKEND ||
    'https://simonsterrific-shizhang-agent.hf.space';
  const MAX_HISTORY = 12;
  const STREAM_FLUSH_MS = 28;
  const STREAM_CHARS_PER_TICK = 2;
  let history = [];

  // ─── Inject Styles ────────────────────────────────────────
  const STYLE = /*css*/`
    .ac-bubble{position:fixed;bottom:28px;right:28px;z-index:8000;width:52px;height:52px;border-radius:50%;background:var(--accent,oklch(72% 0.20 240));border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 24px oklch(72% 0.20 240/0.35);transition:transform .25s,box-shadow .25s,opacity .25s;animation:ac-pulse 3s ease-in-out infinite}
    .ac-bubble:hover{transform:scale(1.12);box-shadow:0 0 36px oklch(72% 0.20 240/0.55)}
    .ac-bubble svg{width:24px;height:24px;fill:oklch(10% 0.012 55)}
    .ac-bubble.ac-open{opacity:0;pointer-events:none}
    @keyframes ac-pulse{0%,100%{box-shadow:0 0 24px oklch(72% 0.20 240/0.35)}50%{box-shadow:0 0 36px oklch(72% 0.20 240/0.50)}}

    .ac-panel{position:fixed;bottom:28px;right:28px;z-index:7999;width:420px;min-width:320px;max-width:calc(100vw - 16px);height:600px;min-height:380px;max-height:calc(100vh - 16px);background:oklch(12% 0.01 55);border:1px solid oklch(25% 0.008 55);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 48px oklch(0% 0 0/0.55);transform:translateY(12px) scale(.96);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .25s}
    .ac-panel.ac-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}

    .ac-header{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid oklch(25% 0.008 55);cursor:move;user-select:none}
    .ac-header-title{font-family:var(--font-display,'Bebas Neue',sans-serif);font-size:20px;letter-spacing:.04em;color:var(--fg,oklch(95% 0.008 80));display:flex;align-items:center;gap:8px}
    .ac-header-dot{width:8px;height:8px;border-radius:50%;background:var(--accent,oklch(72% 0.20 240));transition:background .3s}
    .ac-header-dot.thinking{animation:ac-pulse-dot .8s ease-in-out infinite}
    @keyframes ac-pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}
    .ac-header-actions{display:flex;gap:8px;align-items:center;cursor:default}
    .ac-btn{background:none;border:1px solid oklch(30% 0.008 55);color:var(--fg-dim,oklch(55% 0.006 80));font-family:var(--font-body,'DM Mono',monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:4px;cursor:pointer;transition:border-color .2s,color .2s}
    .ac-btn:hover{border-color:var(--accent,oklch(72% 0.20 240));color:var(--fg,oklch(95% 0.008 80))}
    .ac-status{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-dim,oklch(55% 0.006 80))}
    .ac-status.active{color:var(--accent,oklch(72% 0.20 240))}
    .ac-status.error{color:oklch(72% 0.20 30)}

    .ac-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 18px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none}
    .ac-body::-webkit-scrollbar{display:none}

    /* Messages */
    .ac-msg{flex:0 0 auto;max-width:88%;font-size:12px;line-height:1.7;font-family:var(--font-body,'DM Mono',monospace);padding:10px 14px;border-radius:8px;animation:ac-fade-in .3s ease;word-break:break-word;scrollbar-width:none;-ms-overflow-style:none}
    .ac-msg::-webkit-scrollbar{display:none}
    .ac-msg-user{align-self:flex-end;background:var(--accent,oklch(72% 0.20 240));color:oklch(10% 0.012 55);font-weight:500;border-bottom-right-radius:2px}
    .ac-msg-agent{align-self:flex-start;background:oklch(18% 0.01 55);color:var(--fg,oklch(95% 0.008 80));border-bottom-left-radius:2px;border:1px solid oklch(25% 0.008 55);overflow:auto;max-width:min(88%,100%);max-height:min(65vh,520px)}
    .ac-msg-agent.ac-msg-streaming{border-left:2px solid var(--accent,oklch(72% 0.20 240))}
    .ac-msg-agent::-webkit-scrollbar{display:none}

    /* Markdown inside agent messages */
    .ac-msg-agent h1,.ac-msg-agent h2,.ac-msg-agent h3{font-family:var(--font-display,'Bebas Neue',sans-serif);font-weight:400;margin:8px 0 4px;line-height:1.3;color:var(--fg,oklch(95% 0.008 80))}
    .ac-msg-agent h1{font-size:17px;letter-spacing:.04em}
    .ac-msg-agent h2{font-size:15px;letter-spacing:.03em}
    .ac-msg-agent h3{font-size:13px;letter-spacing:.02em}
    .ac-msg-agent strong{color:var(--accent,oklch(72% 0.20 240));font-weight:600}
    .ac-msg-agent em{color:oklch(85% 0.008 80);font-style:italic}
    .ac-msg-agent code{background:oklch(22% 0.01 55);color:var(--accent,oklch(72% 0.20 240));padding:1px 5px;border-radius:3px;font-family:var(--font-body,'DM Mono',monospace);font-size:11px}
    .ac-msg-agent pre{background:oklch(14% 0.01 55);border:1px solid oklch(22% 0.008 55);border-radius:6px;padding:10px 14px;overflow:auto;font-size:11px;line-height:1.6;margin:8px 0;scrollbar-width:none;-ms-overflow-style:none}
    .ac-msg-agent pre::-webkit-scrollbar{display:none}
    .ac-msg-agent pre code{background:none;color:var(--fg,oklch(95% 0.008 80));padding:0;font-size:inherit}
    .ac-msg-agent ul,.ac-msg-agent ol{margin:4px 0;padding-left:18px}
    .ac-msg-agent li{margin:2px 0;line-height:1.6}
    .ac-msg-agent li::marker{color:var(--accent,oklch(72% 0.20 240))}
    .ac-msg-agent a{color:var(--accent,oklch(72% 0.20 240));text-decoration:underline;text-underline-offset:2px}
    .ac-msg-agent a:hover{opacity:.8}
    .ac-msg-agent blockquote{border-left:3px solid var(--accent,oklch(72% 0.20 240));padding:4px 0 4px 12px;margin:6px 0;color:oklch(60% 0.006 80);font-style:italic}
    .ac-msg-agent table{width:max-content;min-width:100%;border-collapse:collapse;margin:8px 0;font-size:11px;line-height:1.5}
    .ac-msg-agent th,.ac-msg-agent td{border:1px solid oklch(25% 0.008 55);padding:6px 10px;text-align:left;vertical-align:top}
    .ac-msg-agent th{background:oklch(18% 0.01 55);color:var(--accent,oklch(72% 0.20 240));font-weight:600;white-space:nowrap}
    .ac-msg-agent td{color:var(--fg-dim,oklch(80% 0.006 80))}
    .ac-msg-agent tr:nth-child(even) td{background:oklch(15% 0.008 55)}
    .ac-msg-agent hr{border:none;border-top:1px solid oklch(25% 0.008 55);margin:10px 0}
    .ac-msg-agent p{margin:0 0 6px}
    .ac-msg-agent p:last-child{margin-bottom:0}

    /* Thought */
    .ac-thought{flex:0 0 auto;align-self:flex-start;max-width:92%;font-size:10px;line-height:1.6;font-style:italic;font-family:var(--font-body,'DM Mono',monospace);color:oklch(50% 0.006 80);padding:6px 12px;border-radius:6px;background:oklch(14% 0.005 55);border-left:2px solid oklch(30% 0.008 55);animation:ac-fade-in .25s ease}
    .ac-transient{flex:0 0 auto;align-self:flex-start;max-width:94%;width:100%;padding:9px 12px 8px;border-radius:8px;background:oklch(14% 0.005 55);border:1px solid oklch(22% 0.008 55);animation:ac-fade-in .25s ease;overflow:hidden}
    .ac-transient-list{position:relative;display:flex;flex-direction:column;gap:5px;padding-left:13px;border-left:1px solid oklch(32% 0.02 240/0.5)}
    .ac-transient-item{position:relative;font-family:var(--font-body,'DM Mono',monospace);font-size:10px;line-height:1.45;color:oklch(62% 0.006 80);animation:ac-timeline-in .32s cubic-bezier(.16,1,.3,1);transition:opacity .25s,transform .25s}
    .ac-transient-item::before{content:'';position:absolute;left:-16px;top:.55em;width:6px;height:6px;border-radius:50%;background:oklch(38% 0.012 80);box-shadow:0 0 0 3px oklch(14% 0.005 55)}
    .ac-transient-item.current{color:oklch(78% 0.008 80)}
    .ac-transient-item.current::before{background:var(--accent,oklch(72% 0.20 240));box-shadow:0 0 10px oklch(72% 0.20 240/0.45),0 0 0 3px oklch(14% 0.005 55);animation:ac-pulse-dot .9s ease-in-out infinite}
    .ac-transient-item.old-1{opacity:.7}
    .ac-transient-item.old-2{opacity:.5}
    .ac-transient-item.old-3{opacity:.34}
    .ac-transient-item.old-4{opacity:.22}
    @keyframes ac-timeline-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

    /* Tool Card */
    .ac-tool-card{flex:0 0 auto;align-self:flex-start;max-width:94%;width:100%;background:oklch(16% 0.01 55);border:1px solid oklch(22% 0.008 55);border-radius:8px;overflow:hidden;animation:ac-fade-in .25s ease;transition:border-color .2s}
    .ac-tool-card:hover{border-color:oklch(35% 0.01 55)}
    .ac-tool-card-header{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;user-select:none;transition:background .15s}
    .ac-tool-card-header:hover{background:oklch(19% 0.008 55)}
    .ac-tool-card-header .ac-tool-icon{width:24px;height:24px;border-radius:5px;background:oklch(22% 0.01 55);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
    .ac-tool-card-header .ac-tool-label{flex:1 1 auto;min-width:0;font-family:var(--font-body,'DM Mono',monospace);font-size:10px;letter-spacing:.04em;color:var(--fg,oklch(95% 0.008 80));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ac-tool-card-header .ac-tool-chevron{font-size:8px;color:oklch(45% 0.006 80);transition:transform .2s;flex-shrink:0}
    .ac-tool-card.expanded .ac-tool-chevron{transform:rotate(180deg)}
    .ac-tool-card-body{display:none;padding:8px 12px 12px;border-top:1px solid oklch(22% 0.008 55);font-family:var(--font-body,'DM Mono',monospace);font-size:10px;line-height:1.6;color:oklch(60% 0.006 80);max-height:180px;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}
    .ac-tool-card-body::-webkit-scrollbar{display:none}
    .ac-tool-card.expanded .ac-tool-card-body{display:block}
    .ac-tool-card-body .ac-match-count{display:inline-flex;align-items:center;gap:4px;background:oklch(22% 0.01 55);color:var(--accent,oklch(72% 0.20 240));padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;margin-bottom:6px}
    .ac-tool-card-body .ac-result-line{padding:3px 0;border-bottom:1px solid oklch(17% 0.005 55)}
    .ac-tool-card-body .ac-result-line:last-child{border-bottom:none}
    .ac-tool-card-body .ac-truncated{color:oklch(45% 0.006 80);margin-top:4px;font-style:italic}

    /* Typing */
    .ac-typing{flex:0 0 auto;align-self:flex-start;display:flex;gap:4px;padding:8px 14px;background:oklch(18% 0.01 55);border-radius:8px;border:1px solid oklch(25% 0.008 55)}
    .ac-typing span{width:6px;height:6px;border-radius:50%;background:var(--fg-dim,oklch(55% 0.006 80));animation:ac-blink 1.4s infinite both}
    .ac-typing span:nth-child(2){animation-delay:.2s}
    .ac-typing span:nth-child(3){animation-delay:.4s}
    @keyframes ac-blink{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
    @keyframes ac-fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

    /* Input */
    .ac-disclaimer{flex:0 0 auto;padding:6px 18px 0;font-family:var(--font-body,'DM Mono',monospace);font-size:8px;line-height:1.45;color:oklch(45% 0.006 80);text-align:center;border-top:1px solid oklch(20% 0.006 55)}
    .ac-input-wrap{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid oklch(25% 0.008 55)}
    .ac-input{flex:1 1 auto;background:oklch(16% 0.01 55);border:1px solid oklch(25% 0.008 55);border-radius:6px;padding:10px 12px;font-family:var(--font-body,'DM Mono',monospace);font-size:12px;color:var(--fg,oklch(95% 0.008 80));outline:none;resize:none;line-height:1.5;max-height:80px;transition:border-color .2s}
    .ac-input:focus{border-color:var(--accent,oklch(72% 0.20 240))}
    .ac-input::placeholder{color:oklch(40% 0.006 80)}
    .ac-send{background:var(--accent,oklch(72% 0.20 240));color:oklch(10% 0.012 55);border:none;border-radius:6px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;transition:opacity .2s}
    .ac-send:hover{opacity:.8}
    .ac-send:disabled{opacity:.35;pointer-events:none}
    .ac-send svg{width:16px;height:16px}
    .ac-resize-handle{position:absolute;z-index:3;background:transparent}
    .ac-resize-n,.ac-resize-s{left:12px;right:12px;height:8px;cursor:ns-resize}
    .ac-resize-n{top:0}.ac-resize-s{bottom:0}
    .ac-resize-e,.ac-resize-w{top:12px;bottom:12px;width:8px;cursor:ew-resize}
    .ac-resize-e{right:0}.ac-resize-w{left:0}
    .ac-resize-ne,.ac-resize-nw,.ac-resize-se,.ac-resize-sw{width:16px;height:16px}
    .ac-resize-ne{right:0;top:0;cursor:nesw-resize}.ac-resize-nw{left:0;top:0;cursor:nwse-resize}.ac-resize-se{right:0;bottom:0;cursor:nwse-resize}.ac-resize-sw{left:0;bottom:0;cursor:nesw-resize}

    @media(max-width:480px){.ac-panel{width:calc(100vw - 20px);right:10px;bottom:10px;height:calc(100vh - 60px);max-height:none;border-radius:10px}.ac-bubble{bottom:16px;right:16px}}
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  // ─── Build DOM ────────────────────────────────────────────
  const bubble = document.createElement('button');
  bubble.className = 'ac-bubble';
  bubble.setAttribute('aria-label', 'Chat with Simon');
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  const panel = document.createElement('div');
  panel.className = 'ac-panel';
  panel.innerHTML = `<div class="ac-header"><div class="ac-header-title"><span class="ac-header-dot" id="ac-dot"></span>Ask Simon</div><div class="ac-header-actions"><span class="ac-status" id="ac-status">Ready</span><button class="ac-btn" id="ac-clear">Clear</button><button class="ac-btn" id="ac-close">✕</button></div></div><div class="ac-body" id="ac-body"><div class="ac-msg ac-msg-agent">Hi, I'm Simon's digital twin. Ask me anything about architecture, AI, career, or things I've written.</div></div><div class="ac-disclaimer">Simon could be wrong or make mistakes, please perform fact check before using the context. / Simon 可能出错，请在使用相关内容前自行核查事实。</div><div class="ac-input-wrap"><textarea class="ac-input" id="ac-input" rows="1" placeholder="Ask me anything..."></textarea><button class="ac-send" id="ac-send" aria-label="Send"><svg viewBox="0 0 24 24"><path fill="oklch(10% 0.012 55)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>`;

  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (dir) {
    const handle = document.createElement('div');
    handle.className = 'ac-resize-handle ac-resize-' + dir;
    handle.dataset.resizeDir = dir;
    panel.appendChild(handle);
  });

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const bodyEl = document.getElementById('ac-body');
  const inputEl = document.getElementById('ac-input');
  const sendBtn = document.getElementById('ac-send');
  const headerEl = panel.querySelector('.ac-header');
  const closeBtn = document.getElementById('ac-close');
  const clearBtn = document.getElementById('ac-clear');
  const statusEl = document.getElementById('ac-status');
  const dotEl = document.getElementById('ac-dot');

  let isOpen = false, isStreaming = false;

  // ─── Markdown Renderer ────────────────────────────────────

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /**
   * Lightweight Markdown → HTML.
   * `inlineOnly: true` = only bold/italic/code/link (safe during streaming).
   * `inlineOnly: false` = full render (headings, lists, code blocks, etc.).
   */
  function renderMarkdown(text, inlineOnly) {
    // ── Step 1: Extract fenced code blocks before escaping ──
    const codeBlocks = [];
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      const id = codeBlocks.length;
      codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
      return '\x00CODE' + id + '\x00';
    });

    // ── Step 2: Escape remaining HTML ──
    html = escapeHtml(html);

    // ── Step 3: Restore code blocks as <pre><code> ──
    html = html.replace(/\x00CODE(\d+)\x00/g, function (_, id) {
      const cb = codeBlocks[parseInt(id)];
      return '<pre><code>' + cb.code + '</code></pre>';
    });

    // ── Step 4: Inline formatting ──
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    if (inlineOnly) return html;

    // ── Step 4.5: Tables (before paragraph wrapping, after inline formatting) ──
    const tableRowRe = /^\|.+\|$/;
    const tableSepRe = /^\|[-: |]+\|$/;
    const lines = html.split('\n');
    let i = 0;
    while (i < lines.length) {
      // Look for table start: header row followed by separator row
      if (tableRowRe.test(lines[i]) && i + 1 < lines.length && tableSepRe.test(lines[i + 1])) {
        const headerRow = lines[i];
        const sepRow = lines[i + 1];
        const dataRows = [];
        let j = i + 2;
        while (j < lines.length && tableRowRe.test(lines[j])) {
          dataRows.push(lines[j]);
          j++;
        }
        // Build <table>
        const parseRow = (row) => row.replace(/^\||\|$/g, '').split('|');
        const headerCells = parseRow(headerRow);
        // Detect alignment from separator (skip for simplicity — use default)
        let tbl = '<table><thead><tr>';
        headerCells.forEach(cell => { tbl += '<th>' + cell.trim() + '</th>'; });
        tbl += '</tr></thead>';
        if (dataRows.length) {
          tbl += '<tbody>';
          dataRows.forEach(row => {
            tbl += '<tr>';
            parseRow(row).forEach(cell => { tbl += '<td>' + cell.trim() + '</td>'; });
            tbl += '</tr>';
          });
          tbl += '</tbody>';
        }
        tbl += '</table>';
        lines.splice(i, j - i, tbl);
        i++; // skip past the inserted table
      } else {
        i++;
      }
    }
    html = lines.join('\n');

    // ── Step 5: Block-level formatting ──
    // Blockquotes
    html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

    // Horizontal rules
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr>');

    // Headings (must be after blockquote to avoid matching > inside)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Unordered lists — group consecutive <li> into <ul>
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs: double newlines → paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    // Clean empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  // ─── Helpers ──────────────────────────────────────────────

  const MIN_PANEL_WIDTH = 320;
  const MIN_PANEL_HEIGHT = 380;
  const PANEL_MARGIN = 8;

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  function setPanelGeometry(left, top, width, height) {
    const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - PANEL_MARGIN * 2);
    const nextWidth = clamp(width, MIN_PANEL_WIDTH, maxWidth);
    const nextHeight = clamp(height, MIN_PANEL_HEIGHT, maxHeight);
    const nextLeft = clamp(left, PANEL_MARGIN, window.innerWidth - nextWidth - PANEL_MARGIN);
    const nextTop = clamp(top, PANEL_MARGIN, window.innerHeight - nextHeight - PANEL_MARGIN);

    panel.style.left = nextLeft + 'px';
    panel.style.top = nextTop + 'px';
    panel.style.width = nextWidth + 'px';
    panel.style.height = nextHeight + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function freezePanelGeometry() {
    const rect = panel.getBoundingClientRect();
    setPanelGeometry(rect.left, rect.top, rect.width, rect.height);
  }

  function startPanelDrag(e) {
    if (e.button !== 0 || e.target.closest('.ac-header-actions')) return;
    e.preventDefault();
    freezePanelGeometry();
    const rect = panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;

    function move(ev) {
      setPanelGeometry(rect.left + ev.clientX - startX, rect.top + ev.clientY - startY, rect.width, rect.height);
    }

    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  function startPanelResize(e) {
    if (e.button !== 0) return;
    const dir = e.currentTarget.dataset.resizeDir || '';
    e.preventDefault();
    e.stopPropagation();
    freezePanelGeometry();
    const rect = panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;

    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let left = rect.left;
      let top = rect.top;
      let width = rect.width;
      let height = rect.height;

      if (dir.includes('e')) width = rect.width + dx;
      if (dir.includes('s')) height = rect.height + dy;
      if (dir.includes('w')) {
        width = rect.width - dx;
        left = rect.left + dx;
      }
      if (dir.includes('n')) {
        height = rect.height - dy;
        top = rect.top + dy;
      }

      if (width < MIN_PANEL_WIDTH && dir.includes('w')) left = rect.right - MIN_PANEL_WIDTH;
      if (height < MIN_PANEL_HEIGHT && dir.includes('n')) top = rect.bottom - MIN_PANEL_HEIGHT;
      setPanelGeometry(left, top, width, height);
    }

    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  function scrollBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'ac-status' + (cls ? ' ' + cls : '');
  }

  function appendMessage(role, html) {
    const div = document.createElement('div');
    div.className = 'ac-msg ac-msg-' + role;
    div.innerHTML = html;
    bodyEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendThought(text) {
    const div = document.createElement('div');
    div.className = 'ac-thought';
    div.textContent = text;
    bodyEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendToolCard(toolName, toolArgs, iteration) {
    const icons = { list_directory:'📂', read_file:'📄', search_content:'🔎', read_index:'📋', get_metadata:'ℹ️' };
    const verbs = { list_directory:'Browsing', read_file:'Reading', search_content:'Searching', read_index:'Index', get_metadata:'Metadata' };
    const target = toolArgs && toolArgs.path ? toolArgs.path
      : (toolArgs && toolArgs.pattern ? '"' + toolArgs.pattern + '"' : '');

    const card = document.createElement('div');
    card.className = 'ac-tool-card';
    card.innerHTML = `<div class="ac-tool-card-header"><span class="ac-tool-icon">${icons[toolName]||'⚙'}</span><span class="ac-tool-label">${verbs[toolName]||toolName}${target?': '+target:''}</span><span class="ac-tool-chevron">▼</span></div><div class="ac-tool-card-body" id="ac-tool-result-${iteration}"></div>`;
    card.querySelector('.ac-tool-card-header').addEventListener('click', function () {
      card.classList.toggle('expanded');
    });
    bodyEl.appendChild(card);
    scrollBottom();
    return card;
  }

  function fillToolResult(iteration, resultText) {
    const body = document.getElementById('ac-tool-result-' + iteration);
    if (!body) return;
    const cnt = extractMatchCount(resultText);
    let html = '';
    if (cnt !== null) html += `<div class="ac-match-count">Found ${cnt} items</div>`;
    const lines = resultText.split('\n').filter(l => l.trim());
    const preview = lines.slice(0, 10);
    html += preview.map(l => `<div class="ac-result-line">${escapeHtml(l.slice(0,200))}</div>`).join('');
    if (lines.length > 10) html += `<div class="ac-truncated">+ ${lines.length - 10} more lines</div>`;
    body.innerHTML = html;
  }

  function formatToolResult(result) {
    if (typeof result === 'string') return result;
    if (!result || typeof result !== 'object') return '';
    if (result.error) return 'Error: ' + result.error;

    const lines = [];
    if (result.path !== undefined) lines.push('Path: ' + (result.path || 'root'));
    if (result.overview) lines.push('Overview: ' + result.overview);
    if (Array.isArray(result.core_viewpoints) && result.core_viewpoints.length) {
      lines.push('Core viewpoints:');
      result.core_viewpoints.slice(0, 6).forEach(v => lines.push('- ' + v));
    }
    if (Array.isArray(result.subtopics) && result.subtopics.length) {
      lines.push('Subtopics:');
      result.subtopics.slice(0, 8).forEach(t => {
        lines.push('- ' + (t.name || t.path || JSON.stringify(t)));
      });
    }
    if (Array.isArray(result.articles) && result.articles.length) {
      lines.push('Articles:');
      result.articles.slice(0, 8).forEach(a => {
        lines.push('- ' + (a.title || a.path || JSON.stringify(a)));
      });
    }
    if (Array.isArray(result.matches)) {
      lines.push('Found ' + (result.match_count || result.matches.length) + ' matches');
      result.matches.slice(0, 8).forEach(m => {
        lines.push('- ' + (m.file || '') + (m.line_number ? ':' + m.line_number : ''));
        if (m.context) lines.push('  ' + m.context.replace(/\n/g, ' / ').slice(0, 220));
      });
    }
    if (result.content) lines.push(result.content);
    if (Array.isArray(result.entries)) {
      result.entries.slice(0, 12).forEach(e => lines.push('- ' + e.type + ': ' + e.name));
    }

    return lines.length ? lines.join('\n') : JSON.stringify(result, null, 2);
  }

  function extractMatchCount(text) {
    return ((text.match(/Found\s+(\d+)\s+match/i) ||
             text.match(/(\d+)\s+(?:articles?|files?|items?|results?)/i) ||
             text.match(/total:\s*(\d+)/i)) || [])[1] | 0 || null;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'ac-typing'; div.id = 'ac-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(div); scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('ac-typing');
    if (el) el.remove();
  }

  // ─── SSE Stream Handler ───────────────────────────────────

  async function sendMessage(query) {
    if (isStreaming) return;
    isStreaming = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;
    dotEl.classList.add('thinking');
    setStatus('ANALYZING...', 'active');

    appendMessage('user', escapeHtml(query));
    history.push({ role: 'user', content: query });

    let agentMsgDiv = null;
    let agentText = '';
    let displayedAgentText = '';
    let pendingAgentText = '';
    let streamFlushTimer = null;
    let transientEl = null;
    let transientTextEl = null;
    let transientTimer = null;
    let realOutputStarted = false;
    let toolCount = 0, iteration = 0, firstEvent = false, lastThought = '';
    const transientMessageSets = {
      en: [
        'Connecting to Simon\'s knowledge base',
        'Reading the shape of the question',
        'Selecting the first thread to pull',
        'Waiting for the model to choose a move',
        'Checking which memory shelf matters',
        'Tracing the nearest topic cluster',
        'Looking for a useful entry point',
        'Separating context from noise',
        'Mapping the question to prior notes',
        'Warming up the retrieval path',
        'Finding the right level of detail',
        'Skimming the index before opening files',
        'Choosing between recall and precision',
        'Looking for Simon-shaped evidence',
        'Preparing the first grounded step',
        'Checking if this needs deeper reading',
        'Holding the answer until context lands',
        'Following the strongest signal',
        'Letting the knowledge base catch up',
        'Assembling the first pass of context',
        'Opening a narrow path through the archive',
        'Testing whether the question needs memory',
        'Measuring the distance to a useful answer',
        'Listening for the topic under the wording',
        'Scanning for the least noisy clue',
        'Pulling one reference thread at a time',
        'Framing the answer before writing it',
        'Sorting broad context into smaller pieces',
        'Weighing personal memory against general knowledge',
        'Narrowing the search window',
        'Aligning tone with the question',
        'Sketching a compact answer shape',
        'Collecting enough context to be precise',
        'Anchoring the response before it starts',
        'Filtering out the easy but weak answer',
        'Comparing nearby memories',
        'Marking the strongest source candidate',
        'Crossing off irrelevant branches',
        'Keeping the first answer from rushing out',
        'Building a small context map',
        'Turning the query into retrieval terms',
        'Reading between the prompt lines',
        'Watching for the first reliable signal',
        'Choosing a compact route through the notes',
        'Pulling context without flooding the answer',
        'Checking the archive before improvising',
        'Letting the first pass settle',
        'Threading memory into the response',
        'Searching for the practical angle',
        'Preparing a grounded opening',
        'Balancing specificity with speed',
        'Running a quick relevance check',
        'Looking past the obvious phrasing',
        'Settling on the answer\'s center of gravity',
        'Translating context into a useful reply',
        'Keeping the response tied to evidence',
        'Matching the question to Simon\'s timeline',
        'Waiting for the first solid foothold',
        'Moving from vague context to usable signal',
        'Folding the notes into a coherent path',
      ],
      zh: [
        '连接到 Simon 的知识库',
        '先看这个问题的形状',
        '挑出第一条线索',
        '等待模型决定下一步动作',
        '确认哪一层记忆最相关',
        '追踪最近的主题簇',
        '找一个合适的切入点',
        '把上下文和噪声分开',
        '问题正在映射到既有笔记',
        '检索路径开始预热',
        '判断细节应该下潜多深',
        '先扫一遍知识库索引',
        '在召回和精度之间找平衡',
        '寻找更像 Simon 的证据',
        '准备第一步可靠上下文',
        '判断是否需要深读文件',
        '先等上下文落地，再开始回答',
        '顺着最强信号往下找',
        '知识库正在跟上问题',
        '组装第一版上下文',
        '从档案里打开一条窄路',
        '先判断这个问题需不需要记忆',
        '量一下它离可用答案有多远',
        '听出措辞下面真正的话题',
        '扫掉噪声，留下最小线索',
        '一根线一根线往外抽',
        '先给答案搭一个形状',
        '把大块上下文拆小一点',
        '在个人记忆和常识之间称重',
        '缩小检索窗口',
        '让语气对齐问题',
        '给回答画一张小草图',
        '攒够上下文再保持精确',
        '先把回答锚住',
        '过滤掉容易但薄弱的答案',
        '对照几段相邻记忆',
        '标出最强的来源候选',
        '划掉无关分支',
        '先别让答案太快冲出来',
        '搭一张小型上下文地图',
        '把问题改写成检索词',
        '读一下提示词的弦外之音',
        '等第一个可靠信号出现',
        '选一条穿过笔记的短路径',
        '抽取上下文，但不淹没回答',
        '先查档案，再组织语言',
        '让第一轮判断沉一下',
        '把记忆线索织进回答',
        '寻找更实际的切面',
        '准备一个有依据的开头',
        '在速度和具体性之间找平衡',
        '做一次快速相关性检查',
        '越过问题表面的措辞',
        '找到回答的重心',
        '把上下文翻译成可用回答',
        '让回答贴着证据走',
        '匹配问题和 Simon 的时间线',
        '等一个扎实的落脚点',
        '从模糊上下文走向可用信号',
        '把笔记折成一条连贯路径',
      ],
    };
    const transientMessages = /[\u4e00-\u9fff]/.test(query)
      ? transientMessageSets.zh
      : transientMessageSets.en;
    let transientQueue = [];

    function shuffleMessages(messages) {
      const shuffled = messages.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }
      return shuffled;
    }

    function nextTransientMessage() {
      if (!transientQueue.length) {
        transientQueue = shuffleMessages(transientMessages);
      }
      return transientQueue.shift();
    }

    function refreshTransientTimeline() {
      if (!transientTextEl) return;
      const items = Array.from(transientTextEl.querySelectorAll('.ac-transient-item'));
      items.forEach(function (item, index) {
        const age = items.length - 1 - index;
        item.className = 'ac-transient-item' + (age === 0 ? ' current' : ' old-' + Math.min(age, 4));
      });
    }

    function startTransientStatus() {
      transientEl = document.createElement('div');
      transientEl.className = 'ac-transient';
      transientEl.innerHTML = '<div class="ac-transient-list"></div>';
      transientTextEl = transientEl.querySelector('.ac-transient-list');
      bodyEl.appendChild(transientEl);
      updateTransientStatus(nextTransientMessage());
      transientTimer = setInterval(function () {
        updateTransientStatus(nextTransientMessage());
      }, 2200);
      scrollBottom();
    }

    function updateTransientStatus(text) {
      if (!transientTextEl || realOutputStarted) return;
      const item = document.createElement('div');
      item.className = 'ac-transient-item current';
      item.textContent = text;
      transientTextEl.appendChild(item);
      while (transientTextEl.children.length > 5) {
        transientTextEl.firstElementChild.remove();
      }
      refreshTransientTimeline();
      scrollBottom();
    }

    function stopTransientStatus() {
      realOutputStarted = true;
      if (transientTimer !== null) {
        clearInterval(transientTimer);
        transientTimer = null;
      }
      if (transientEl) {
        transientEl.remove();
        transientEl = null;
        transientTextEl = null;
      }
    }

    startTransientStatus();

    function ensureAgentMessage() {
      stopTransientStatus();
      if (!agentMsgDiv) {
        agentMsgDiv = appendMessage('agent', '');
        agentMsgDiv.classList.add('ac-msg-streaming');
        setStatus('WRITING...', 'active');
      }
    }

    function renderStreamingText() {
      ensureAgentMessage();
      agentMsgDiv.innerHTML = renderMarkdown(displayedAgentText, true);
      scrollBottom();
    }

    function scheduleStreamFlush() {
      if (streamFlushTimer === null) {
        streamFlushTimer = setTimeout(flushStreamText, STREAM_FLUSH_MS);
      }
    }

    function flushStreamText() {
      streamFlushTimer = null;
      if (!pendingAgentText) return;

      const nextSize = pendingAgentText[0] === '\n'
        ? 1
        : Math.min(STREAM_CHARS_PER_TICK, pendingAgentText.length);
      displayedAgentText += pendingAgentText.slice(0, nextSize);
      pendingAgentText = pendingAgentText.slice(nextSize);
      renderStreamingText();

      if (pendingAgentText) scheduleStreamFlush();
    }

    function queueStreamText(content) {
      if (!content) return;
      agentText += content;
      pendingAgentText += content;
      ensureAgentMessage();
      scheduleStreamFlush();
    }

    async function drainStreamText() {
      while (pendingAgentText) {
        if (streamFlushTimer !== null) {
          clearTimeout(streamFlushTimer);
          streamFlushTimer = null;
        }
        flushStreamText();
        await new Promise(resolve => setTimeout(resolve, STREAM_FLUSH_MS));
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const resp = await fetch(BACKEND + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: history.slice(-MAX_HISTORY), model: 'default' }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`Server responded ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processSSEBlock(block) {
        let currentEvent = '';
        const dataLines = [];
        for (const rawLine of block.split(/\r?\n/)) {
          const line = rawLine.trimEnd();
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (!dataLines.length) return;
        try {
          handleSSEEvent(currentEvent, JSON.parse(dataLines.join('\n')));
        } catch { /* skip malformed SSE payload */ }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        blocks.forEach(processSSEBlock);
      }

      // Process remaining buffer
      buffer += decoder.decode();
      if (buffer.trim()) {
        processSSEBlock(buffer);
      }

      // ── DONE: finish paced stream, then apply full Markdown render ──
      if (agentMsgDiv && agentText.trim()) {
        await drainStreamText();
        agentMsgDiv.innerHTML = renderMarkdown(agentText, false);
        agentMsgDiv.classList.remove('ac-msg-streaming');
      }

      dotEl.classList.remove('thinking');
      setStatus('Ready', '');

    } catch (err) {
      if (streamFlushTimer !== null) clearTimeout(streamFlushTimer);
      stopTransientStatus();
      dotEl.classList.remove('thinking');
      hideTyping();
      setStatus(err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR', 'error');
      appendMessage('system', err.name === 'AbortError' ? '⏱ Request timed out.' : '⚠ Connection lost.');
      console.error('[agent-chat]', err);
    } finally {
      hideTyping();
      isStreaming = false;
      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
      if (agentText.trim()) {
        history.push({ role: 'assistant', content: agentText });
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      }
    }

    function handleSSEEvent(event, data) {
      console.log('[agent] SSE:', event, data);  // debug: verify events arrive
      if (!firstEvent) { firstEvent = true; hideTyping(); }

      switch (event) {
        case 'thought': {
          const t = (data.content || '').trim();
          if (!realOutputStarted) {
            if (t && t !== lastThought) {
              lastThought = t;
            }
            setStatus('ANALYZING...', 'active');
            break;
          }
          if (t && t !== lastThought) {
            lastThought = t;
            iteration++;
            appendThought('💭 ' + t);
            setStatus('ROUND ' + iteration + '/8', 'active');
          }
          break;
        }

        case 'tool_call':
          stopTransientStatus();
          toolCount++;
          appendToolCard(data.tool, data.arguments, toolCount);
          setStatus(iteration ? 'ROUND ' + iteration + '/8 · SEARCHING' : 'SEARCHING', 'active');
          break;

        case 'tool_result':
          stopTransientStatus();
          fillToolResult(toolCount, formatToolResult(data.result));
          setStatus(iteration ? 'ROUND ' + iteration + '/8 · ANALYZING' : 'ANALYZING', 'active');
          break;

        case 'chunk':
          queueStreamText(data.content || '');
          break;

        case 'rollback':
          // 后端发现之前发送的 chunk 其实是思考过程，需要清除
          if (agentMsgDiv) {
            agentMsgDiv.remove();
            agentMsgDiv = null;
            agentText = '';
            displayedAgentText = '';
            pendingAgentText = '';
            if (streamFlushTimer !== null) {
              clearTimeout(streamFlushTimer);
              streamFlushTimer = null;
            }
          }
          break;

        case 'done':
          break;  // full Markdown applied in outer block

        case 'heartbeat':
          if (!realOutputStarted) {
            updateTransientStatus(nextTransientMessage());
          }
          setStatus('THINKING...', 'active');
          break;

        case 'error':
          stopTransientStatus();
          dotEl.classList.remove('thinking');
          setStatus('ERROR', 'error');
          appendMessage('system', '⚠ ' + (data.message || 'Something went wrong.'));
          break;
      }
    }
  }

  // ─── UI Events ────────────────────────────────────────────

  function openPanel() { isOpen = true; bubble.classList.add('ac-open'); panel.classList.add('ac-open'); inputEl.focus(); }
  function closePanel() { isOpen = false; bubble.classList.remove('ac-open'); panel.classList.remove('ac-open'); }
  function togglePanel() { isOpen ? closePanel() : openPanel(); }
  function clearChat() {
    history = [];
    bodyEl.innerHTML = '<div class="ac-msg ac-msg-agent">Hi, I\'m Simon\'s digital twin. Ask me anything about architecture, AI, career, or things I\'ve written.</div>';
    setStatus('Ready', '');
  }

  bubble.addEventListener('click', togglePanel);
  headerEl.addEventListener('pointerdown', startPanelDrag);
  panel.querySelectorAll('.ac-resize-handle').forEach(function (handle) {
    handle.addEventListener('pointerdown', startPanelResize);
  });
  closeBtn.addEventListener('click', closePanel);
  clearBtn.addEventListener('click', clearChat);

  window.addEventListener('resize', function () {
    if (isOpen && panel.style.left && panel.style.top) freezePanelGeometry();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = inputEl.value.trim();
      if (t && !isStreaming) { inputEl.value = ''; inputEl.style.height = 'auto'; sendMessage(t); }
    }
  });

  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  });

  sendBtn.addEventListener('click', function () {
    const t = inputEl.value.trim();
    if (t && !isStreaming) { inputEl.value = ''; inputEl.style.height = 'auto'; sendMessage(t); }
  });

  // ─── Health check ─────────────────────────────────────────

  (async function () {
    try {
      const resp = await fetch(BACKEND + '/health', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) { const h = await resp.json(); console.log('[agent-chat] healthy:', h, 'widget:', WIDGET_VERSION); setStatus('Ready', ''); }
      else setStatus('OFFLINE', 'error');
    } catch { setStatus('OFFLINE', 'error'); console.warn('[agent-chat] unreachable:', BACKEND); }
  })();

})();
