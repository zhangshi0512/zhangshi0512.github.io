/**
 * agent-chat.js — Floating chat bubble + SSE streaming panel
 * for shizhang-agent backend (HF Spaces).
 *
 * USAGE: add <script src="agent-chat.js"></script> to index.html
 *
 * Backend URL is read from the global AGENT_CHAT_BACKEND or defaults below.
 * Override in HTML before loading this script:
 *   <script>window.AGENT_CHAT_BACKEND = 'https://xxx.hf.space';</script>
 *   <script src="agent-chat.js"></script>
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────
  const BACKEND = window.AGENT_CHAT_BACKEND ||
    'https://simonsterrific-shizhang-agent.hf.space';

  const MAX_HISTORY = 12;       // conversation turns to keep
  let history = [];             // [{role, content}, ...]

  // ─── Inject Styles ────────────────────────────────────────
  const STYLE = /*css*/`
    /* ── Bubble ── */
    .ac-bubble {
      position: fixed; bottom: 28px; right: 28px; z-index: 8000;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent, oklch(72% 0.20 240));
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 24px oklch(72% 0.20 240 / 0.35);
      transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.25s;
      animation: ac-pulse 3s ease-in-out infinite;
    }
    .ac-bubble:hover {
      transform: scale(1.12);
      box-shadow: 0 0 36px oklch(72% 0.20 240 / 0.55);
    }
    .ac-bubble svg {
      width: 24px; height: 24px; fill: oklch(10% 0.012 55);
    }
    .ac-bubble.ac-open { opacity: 0; pointer-events: none; }

    @keyframes ac-pulse {
      0%, 100% { box-shadow: 0 0 24px oklch(72% 0.20 240 / 0.35); }
      50%      { box-shadow: 0 0 36px oklch(72% 0.20 240 / 0.50); }
    }

    /* ── Panel ── */
    .ac-panel {
      position: fixed; bottom: 28px; right: 28px; z-index: 7999;
      width: 400px; max-width: calc(100vw - 40px);
      height: 580px; max-height: calc(100vh - 80px);
      background: oklch(12% 0.01 55);
      border: 1px solid oklch(25% 0.008 55);
      border-radius: 12px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 16px 48px oklch(0% 0 0 / 0.55);
      transform: translateY(12px) scale(0.96);
      opacity: 0; pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.16,1,0.3,1),
                  opacity 0.25s;
    }
    .ac-panel.ac-open {
      transform: translateY(0) scale(1);
      opacity: 1; pointer-events: all;
    }

    /* ── Header ── */
    .ac-header {
      flex: 0 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid oklch(25% 0.008 55);
    }
    .ac-header-title {
      font-family: var(--font-display, 'Bebas Neue', sans-serif);
      font-size: 20px; letter-spacing: 0.04em;
      color: var(--fg, oklch(95% 0.008 80));
      display: flex; align-items: center; gap: 8px;
    }
    .ac-header-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent, oklch(72% 0.20 240));
      transition: background 0.3s;
    }
    .ac-header-dot.thinking {
      animation: ac-pulse-dot 0.8s ease-in-out infinite;
    }
    @keyframes ac-pulse-dot {
      0%,100%{opacity:1} 50%{opacity:0.3}
    }
    .ac-header-actions { display: flex; gap: 8px; align-items: center; }
    .ac-btn {
      background: none; border: 1px solid oklch(30% 0.008 55);
      color: var(--fg-dim, oklch(55% 0.006 80));
      font-family: var(--font-body, 'DM Mono', monospace);
      font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 4px 10px; border-radius: 4px; cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }
    .ac-btn:hover {
      border-color: var(--accent, oklch(72% 0.20 240));
      color: var(--fg, oklch(95% 0.008 80));
    }

    /* ── Status bar ── */
    .ac-status {
      font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--fg-dim, oklch(55% 0.006 80));
    }
    .ac-status.active {
      color: var(--accent, oklch(72% 0.20 240));
    }
    .ac-status.error { color: oklch(72% 0.20 30); }

    /* ── Messages Area ── */
    .ac-body {
      flex: 1 1 auto; overflow-y: auto;
      padding: 16px 18px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    .ac-body::-webkit-scrollbar { width: 4px; }
    .ac-body::-webkit-scrollbar-track { background: transparent; }
    .ac-body::-webkit-scrollbar-thumb {
      background: oklch(30% 0.008 55); border-radius: 2px;
    }

    /* ── Messages ── */
    .ac-msg {
      max-width: 88%; font-size: 12px; line-height: 1.7;
      font-family: var(--font-body, 'DM Mono', monospace);
      padding: 10px 14px; border-radius: 8px;
      animation: ac-fade-in 0.3s ease;
    }
    .ac-msg-user {
      align-self: flex-end;
      background: var(--accent, oklch(72% 0.20 240));
      color: oklch(10% 0.012 55); font-weight: 500;
      border-bottom-right-radius: 2px;
    }
    .ac-msg-agent {
      align-self: flex-start;
      background: oklch(18% 0.01 55);
      color: var(--fg, oklch(95% 0.008 80));
      border-bottom-left-radius: 2px;
      border: 1px solid oklch(25% 0.008 55);
    }
    .ac-msg-agent.ac-msg-streaming {
      border-left: 2px solid var(--accent, oklch(72% 0.20 240));
    }

    /* ── Thought — inline reasoning ── */
    .ac-thought {
      align-self: flex-start; max-width: 92%;
      font-size: 10px; line-height: 1.6; font-style: italic;
      font-family: var(--font-body, 'DM Mono', monospace);
      color: oklch(50% 0.006 80);
      padding: 6px 12px; border-radius: 6px;
      background: oklch(14% 0.005 55);
      border-left: 2px solid oklch(30% 0.008 55);
      animation: ac-fade-in 0.25s ease;
    }

    /* ── Tool Card — expandable tool execution ── */
    .ac-tool-card {
      align-self: flex-start; max-width: 94%; width: 100%;
      background: oklch(16% 0.01 55);
      border: 1px solid oklch(22% 0.008 55);
      border-radius: 8px;
      overflow: hidden;
      animation: ac-fade-in 0.25s ease;
      transition: border-color 0.2s;
    }
    .ac-tool-card:hover {
      border-color: oklch(35% 0.01 55);
    }
    .ac-tool-card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .ac-tool-card-header:hover {
      background: oklch(19% 0.008 55);
    }
    .ac-tool-card-header .ac-tool-icon {
      width: 24px; height: 24px; border-radius: 5px;
      background: oklch(22% 0.01 55);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; flex-shrink: 0;
    }
    .ac-tool-card-header .ac-tool-label {
      flex: 1 1 auto; min-width: 0;
      font-family: var(--font-body, 'DM Mono', monospace);
      font-size: 10px; letter-spacing: 0.04em;
      color: var(--fg, oklch(95% 0.008 80));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ac-tool-card-header .ac-tool-chevron {
      font-size: 8px; color: oklch(45% 0.006 80);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .ac-tool-card.expanded .ac-tool-chevron {
      transform: rotate(180deg);
    }
    .ac-tool-card-body {
      display: none;
      padding: 8px 12px 12px;
      border-top: 1px solid oklch(22% 0.008 55);
      font-family: var(--font-body, 'DM Mono', monospace);
      font-size: 10px; line-height: 1.6;
      color: oklch(60% 0.006 80);
    }
    .ac-tool-card.expanded .ac-tool-card-body {
      display: block;
    }
    .ac-tool-card-body .ac-match-count {
      display: inline-flex; align-items: center; gap: 4px;
      background: oklch(22% 0.01 55);
      color: var(--accent, oklch(72% 0.20 240));
      padding: 2px 8px; border-radius: 10px;
      font-size: 10px; font-weight: 500;
      margin-bottom: 6px;
    }
    .ac-tool-card-body .ac-result-line {
      padding: 3px 0;
      border-bottom: 1px solid oklch(17% 0.005 55);
    }
    .ac-tool-card-body .ac-result-line:last-child {
      border-bottom: none;
    }
    .ac-tool-card-body .ac-truncated {
      color: oklch(45% 0.006 80);
      margin-top: 4px; font-style: italic;
    }

    /* ── Iteration step marker ── */
    .ac-step {
      align-self: stretch;
      display: flex; align-items: center; gap: 10px;
      padding: 0 4px;
    }
    .ac-step-line {
      flex: 1 1 auto; height: 1px;
      background: oklch(20% 0.008 55);
    }
    .ac-step-label {
      font-family: var(--font-body, 'DM Mono', monospace);
      font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase;
      color: oklch(40% 0.006 80);
      white-space: nowrap;
    }

    /* ── Typing Indicator ── */
    .ac-typing {
      align-self: flex-start;
      display: flex; gap: 4px; padding: 8px 14px;
      background: oklch(18% 0.01 55);
      border-radius: 8px; border: 1px solid oklch(25% 0.008 55);
    }
    .ac-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--fg-dim, oklch(55% 0.006 80));
      animation: ac-blink 1.4s infinite both;
    }
    .ac-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ac-typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes ac-blink {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    @keyframes ac-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Input Area ── */
    .ac-input-wrap {
      flex: 0 0 auto;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 18px;
      border-top: 1px solid oklch(25% 0.008 55);
    }
    .ac-input {
      flex: 1 1 auto;
      background: oklch(16% 0.01 55);
      border: 1px solid oklch(25% 0.008 55);
      border-radius: 6px;
      padding: 10px 12px;
      font-family: var(--font-body, 'DM Mono', monospace);
      font-size: 12px; color: var(--fg, oklch(95% 0.008 80));
      outline: none; resize: none;
      line-height: 1.5; max-height: 80px;
      transition: border-color 0.2s;
    }
    .ac-input:focus { border-color: var(--accent, oklch(72% 0.20 240)); }
    .ac-input::placeholder { color: oklch(40% 0.006 80); }
    .ac-send {
      background: var(--accent, oklch(72% 0.20 240));
      color: oklch(10% 0.012 55);
      border: none; border-radius: 6px;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex: 0 0 auto;
      transition: opacity 0.2s;
    }
    .ac-send:hover { opacity: 0.8; }
    .ac-send:disabled { opacity: 0.35; pointer-events: none; }
    .ac-send svg { width: 16px; height: 16px; }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .ac-panel {
        width: calc(100vw - 20px); right: 10px; bottom: 10px;
        height: calc(100vh - 60px); max-height: none;
        border-radius: 10px;
      }
      .ac-bubble { bottom: 16px; right: 16px; }
    }
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
  panel.innerHTML = `
    <div class="ac-header">
      <div class="ac-header-title">
        <span class="ac-header-dot" id="ac-dot"></span>Ask Simon
      </div>
      <div class="ac-header-actions">
        <span class="ac-status" id="ac-status">Ready</span>
        <button class="ac-btn" id="ac-clear" title="Clear chat">Clear</button>
        <button class="ac-btn" id="ac-close" title="Close">✕</button>
      </div>
    </div>
    <div class="ac-body" id="ac-body">
      <div class="ac-msg ac-msg-agent">
        Hi, I'm Simon's digital twin. Ask me anything about architecture, AI, career, or things I've written.
      </div>
    </div>
    <div class="ac-input-wrap">
      <textarea class="ac-input" id="ac-input" rows="1"
        placeholder="Ask me anything..."
        ></textarea>
      <button class="ac-send" id="ac-send" aria-label="Send">
        <svg viewBox="0 0 24 24"><path fill="oklch(10% 0.012 55)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  // ─── Element refs ─────────────────────────────────────────
  const bodyEl    = document.getElementById('ac-body');
  const inputEl   = document.getElementById('ac-input');
  const sendBtn   = document.getElementById('ac-send');
  const closeBtn  = document.getElementById('ac-close');
  const clearBtn  = document.getElementById('ac-clear');
  const statusEl  = document.getElementById('ac-status');
  const dotEl     = document.getElementById('ac-dot');

  let isOpen      = false;
  let isStreaming = false;

  // ─── Helpers ──────────────────────────────────────────────

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
    const icons = {
      list_directory: '📂', read_file: '📄', search_content: '🔎',
      read_index: '📋', get_metadata: 'ℹ️',
    };
    const verbs = {
      list_directory: 'Browsing', read_file: 'Reading',
      search_content: 'Searching', read_index: 'Index',
      get_metadata: 'Metadata',
    };
    const icon = icons[toolName] || '⚙';
    const verb = verbs[toolName] || toolName;
    const target = toolArgs && toolArgs.path ? toolArgs.path
      : (toolArgs && toolArgs.pattern ? `"${toolArgs.pattern}"` : '');

    const card = document.createElement('div');
    card.className = 'ac-tool-card';
    card.innerHTML = `
      <div class="ac-tool-card-header">
        <span class="ac-tool-icon">${icon}</span>
        <span class="ac-tool-label">${verb}${target ? ': ' + target : ''}</span>
        <span class="ac-tool-chevron">▼</span>
      </div>
      <div class="ac-tool-card-body" id="ac-tool-result-${iteration}"></div>
    `;

    // Toggle expand on header click
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

    // Try to parse structured info from the result
    const matchCount = extractMatchCount(resultText);
    let html = '';

    if (matchCount !== null) {
      html += `<div class="ac-match-count">Found ${matchCount} items</div>`;
    }

    // Show truncated result
    const lines = resultText.split('\n').filter(l => l.trim());
    const preview = lines.slice(0, 10);
    html += preview.map(l => `<div class="ac-result-line">${escapeHtml(l.slice(0, 200))}</div>`).join('');

    if (lines.length > 10) {
      html += `<div class="ac-truncated">+ ${lines.length - 10} more lines</div>`;
    }

    body.innerHTML = html;
  }

  function extractMatchCount(text) {
    // Try common patterns: "Found X matches", "X articles", etc.
    const m1 = text.match(/Found\s+(\d+)\s+match/i);
    if (m1) return parseInt(m1[1]);
    const m2 = text.match(/(\d+)\s+(?:articles?|files?|items?|results?)/i);
    if (m2) return parseInt(m2[1]);
    const m3 = text.match(/total:\s*(\d+)/i);
    if (m3) return parseInt(m3[1]);
    return null;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'ac-typing';
    div.id = 'ac-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(div);
    scrollBottom();
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

    // Visual: start thinking state
    dotEl.classList.add('thinking');
    setStatus('ANALYZING...', 'active');

    // Show user message
    appendMessage('user', escapeHtml(query));
    history.push({ role: 'user', content: query });

    // Show typing indicator while waiting for first SSE event
    showTyping();

    let agentMsgDiv   = null;
    let agentContent  = '';
    let toolCount     = 0;
    let iteration     = 0;      // which agent loop iteration
    let firstEvent    = false;
    let lastThought   = '';     // last thought shown (avoid duplicates)

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const resp = await fetch(BACKEND + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          history: history.slice(-MAX_HISTORY),
          model: 'default',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`Server responded ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, data);
            } catch { /* skip */ }
          }
        }
      }

      // Process remaining
      if (buffer.trim()) {
        const lastLines = buffer.split('\n');
        let currentEvent = '';
        for (const line of lastLines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, data);
            } catch { /* skip */ }
          }
        }
      }

      // Final state
      dotEl.classList.remove('thinking');
      setStatus('Ready', '');

    } catch (err) {
      dotEl.classList.remove('thinking');
      hideTyping();
      if (err.name === 'AbortError') {
        setStatus('TIMEOUT', 'error');
        appendMessage('system', '⏱ Request timed out.');
      } else {
        setStatus('ERROR', 'error');
        appendMessage('system', '⚠ Connection lost.');
      }
      console.error('[agent-chat]', err);
    } finally {
      hideTyping();
      isStreaming = false;
      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();

      if (agentContent.trim()) {
        history.push({ role: 'assistant', content: agentContent });
        if (history.length > MAX_HISTORY) {
          history = history.slice(-MAX_HISTORY);
        }
      }
    }

    // ─── SSE event router ────────────────────────────────────

    function handleSSEEvent(event, data) {
      // Remove typing indicator on first real event
      if (!firstEvent) {
        firstEvent = true;
        hideTyping();
      }

      switch (event) {
        case 'thought': {
          const thought = (data.content || '').trim();
          if (thought && thought !== lastThought) {
            lastThought = thought;
            iteration++;
            appendThought('💭 ' + thought);
            setStatus(`ROUND ${iteration}/8`, 'active');
          }
          break;
        }

        case 'tool_call': {
          toolCount++;
          const card = appendToolCard(data.name, data.arguments, toolCount);
          setStatus(`ROUND ${iteration}/8 · TOOL ${toolCount}`, 'active');
          break;
        }

        case 'tool_result': {
          const resultStr = typeof data.result === 'string' ? data.result
            : JSON.stringify(data.result || '');
          fillToolResult(toolCount, resultStr);
          setStatus(`ROUND ${iteration}/8 · ANALYZING`, 'active');
          break;
        }

        case 'chunk': {
          if (!agentMsgDiv) {
            agentMsgDiv = appendMessage('agent', '');
            agentMsgDiv.classList.add('ac-msg-streaming');
            setStatus('WRITING...', 'active');
          }
          agentContent += data.content || '';
          agentMsgDiv.innerHTML = escapeHtml(agentContent);
          scrollBottom();
          break;
        }

        case 'done':
          dotEl.classList.remove('thinking');
          setStatus('Ready', '');
          if (agentMsgDiv) {
            agentMsgDiv.classList.remove('ac-msg-streaming');
          }
          break;

        case 'error':
          dotEl.classList.remove('thinking');
          setStatus('ERROR', 'error');
          appendMessage('system', '⚠ ' + (data.message || 'Something went wrong.'));
          break;
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── UI Event Handlers ────────────────────────────────────

  function openPanel() {
    isOpen = true;
    bubble.classList.add('ac-open');
    panel.classList.add('ac-open');
    inputEl.focus();
  }

  function closePanel() {
    isOpen = false;
    bubble.classList.remove('ac-open');
    panel.classList.remove('ac-open');
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function clearChat() {
    history = [];
    bodyEl.innerHTML = `
      <div class="ac-msg ac-msg-agent">
        Hi, I'm Simon's digital twin. Ask me anything about architecture, AI, career, or things I've written.
      </div>
    `;
    setStatus('Ready', '');
  }

  // ─── Event Bindings ───────────────────────────────────────

  bubble.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', closePanel);
  clearBtn.addEventListener('click', clearChat);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      closePanel();
    }
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (text && !isStreaming) {
        inputEl.value = '';
        inputEl.style.height = 'auto';
        sendMessage(text);
      }
    }
  });

  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  });

  sendBtn.addEventListener('click', function () {
    const text = inputEl.value.trim();
    if (text && !isStreaming) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
      sendMessage(text);
    }
  });

  // ─── Health check ─────────────────────────────────────────

  (async function healthCheck() {
    try {
      const resp = await fetch(BACKEND + '/health', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const h = await resp.json();
        console.log('[agent-chat] Backend healthy:', h);
        setStatus('Ready', '');
      } else {
        setStatus('OFFLINE', 'error');
      }
    } catch {
      setStatus('OFFLINE', 'error');
      console.warn('[agent-chat] Backend unreachable at', BACKEND);
    }
  })();

})();
