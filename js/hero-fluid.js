/**
 * hero-fluid.js — Soft metaballs, drift particles, and a small knowledge constellation.
 * The constellation is an intentionally curated topic map, not a claim that every
 * article in the knowledge base has a verified semantic relationship with every other.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('hero-fluid-canvas');
  const host = document.getElementById('hero-fluid');
  const hero = document.getElementById('hero');
  const controls = document.getElementById('knowledge-constellation-controls');
  const fallbackButton = document.getElementById('constellation-fallback');
  if (!canvas || !host || !hero) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const MAX_NODES = 32;
  const MAX_EDGES = 40;

  const mouse = { x: 0, y: 0, active: false };
  const attract = { x: 0, y: 0, active: false };
  let accentRgb = [110, 195, 255];
  let secondaryRgb = [180, 140, 255];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let orbs = [];
  let particles = [];
  let rafId = 0;
  let running = false;
  let chatOpen = false;
  let startTime = performance.now();
  let constellation = null;
  let activeNodeId = null;
  let touchSelectedNodeId = null;
  let impressionTracked = false;
  const controlButtons = new Map();

  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function readAccentColors() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--accent)';
    document.documentElement.appendChild(probe);
    const accent = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.style.color = 'var(--fg)';
    const fg = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    if (accent && accent.length >= 3) accentRgb = accent.slice(0, 3).map(Number);
    if (fg && fg.length >= 3) {
      const f = fg.slice(0, 3).map(Number);
      secondaryRgb = [
        Math.round(accentRgb[0] * 0.45 + f[0] * 0.55),
        Math.round(accentRgb[1] * 0.45 + f[1] * 0.55),
        Math.round(accentRgb[2] * 0.45 + f[2] * 0.55),
      ];
    }
  }

  function rgba(rgb, alpha) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
  }

  function stableNumber(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 10000) / 10000;
  }

  function validateManifest(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
    if (!data.nodes.length || data.nodes.length > MAX_NODES || data.edges.length > MAX_EDGES) return null;
    const ids = new Set();
    const nodes = [];
    for (const node of data.nodes) {
      if (!node || !/^[a-z0-9-]+$/.test(node.id || '') || ids.has(node.id)) return null;
      if (!['domain', 'subtopic'].includes(node.kind) || typeof node.label !== 'string' || !node.label) return null;
      if (typeof node.summary !== 'string' || typeof node.query !== 'string' || !node.query) return null;
      if (!node.layout || !Number.isFinite(node.layout.x) || !Number.isFinite(node.layout.y)) return null;
      if (node.layout.x < 0 || node.layout.x > 1 || node.layout.y < 0 || node.layout.y > 1) return null;
      ids.add(node.id);
      nodes.push(Object.assign({}, node, { phase: stableNumber(node.id) * Math.PI * 2 }));
    }
    for (const edge of data.edges) {
      if (!edge || edge.kind !== 'taxonomy' || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) return null;
    }
    return { nodes: nodes, edges: data.edges, nodeById: new Map(nodes.map(node => [node.id, node])) };
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.25 : 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    buildScene();
    syncConstellationControls();
  }

  function buildScene() {
    const count = isMobile() ? 4 : 7;
    orbs = [];
    for (let i = 0; i < count; i++) {
      orbs.push({
        bx: width * (0.35 + (i / count) * 0.45 + (Math.random() - 0.5) * 0.08),
        by: height * (0.18 + (i % 3) * 0.22 + Math.random() * 0.12),
        r: width * (0.14 + Math.random() * 0.16),
        phase: Math.random() * Math.PI * 2,
        speed: 0.00035 + Math.random() * 0.00045,
        ampX: width * (0.06 + Math.random() * 0.1),
        ampY: height * (0.05 + Math.random() * 0.08),
        color: i % 3 === 0 ? accentRgb : i % 3 === 1 ? secondaryRgb : [
          Math.round(accentRgb[0] * 0.7 + 40),
          Math.round(accentRgb[1] * 0.75 + 30),
          Math.round(accentRgb[2] * 0.85 + 20),
        ],
        alpha: 0.42 + Math.random() * 0.22,
      });
    }

    const particleCount = isMobile() ? 28 : 55;
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.35 + 0.08,
      });
    }
  }

  function visibleNodes() {
    if (!constellation) return [];
    return constellation.nodes.filter(node => !(isMobile() || reducedMotion) || node.kind === 'domain');
  }

  function mobileDomainPosition(node) {
    const domains = constellation.nodes.filter(item => item.kind === 'domain');
    const index = Math.max(0, domains.findIndex(item => item.id === node.id));
    const columns = 2;
    return {
      x: width * (0.64 + (index % columns) * 0.19),
      y: height * (0.3 + Math.floor(index / columns) * 0.2),
    };
  }

  function pointForNode(node, time) {
    const base = isMobile() ? mobileDomainPosition(node) : {
      x: width * node.layout.x,
      y: height * node.layout.y,
    };
    if (reducedMotion) return base;
    const drift = node.kind === 'domain' ? 2.8 : 1.6;
    return {
      x: base.x + Math.sin(time * 0.00034 + node.phase) * drift,
      y: base.y + Math.cos(time * 0.00028 + node.phase * 1.3) * drift,
    };
  }

  function rootForNode(nodeId) {
    const node = constellation && constellation.nodeById.get(nodeId);
    if (!node) return null;
    if (node.kind === 'domain') return node.id;
    const parent = constellation.edges.find(edge => edge.target === node.id);
    return parent ? parent.source : null;
  }

  function isNodeInActiveCluster(node) {
    if (!activeNodeId) return false;
    return rootForNode(node.id) === rootForNode(activeNodeId);
  }

  function nodeRadius(node) {
    if (node.kind !== 'domain') return 3.1;
    return 5.2 + ((node.weight || 0.4) * 5.5);
  }

  function drawConstellation(ctx, time) {
    // Reduced-motion uses the visible DOM topic controls as the complete
    // constellation UI. Keeping a second Canvas rendering here duplicates
    // their labels when the chat drawer is closed and the background redraws.
    if (!constellation || reducedMotion) return;
    const nodes = visibleNodes();
    const visibleIds = new Set(nodes.map(node => node.id));
    const positions = new Map(nodes.map(node => [node.id, pointForNode(node, time)]));

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 0.8;
    constellation.edges.forEach(function (edge) {
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return;
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const related = activeNodeId && (rootForNode(edge.source) === rootForNode(activeNodeId));
      ctx.strokeStyle = rgba(accentRgb, related ? 0.44 : 0.12 * edge.strength);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });

    nodes.forEach(function (node) {
      const point = positions.get(node.id);
      const active = node.id === activeNodeId;
      const inCluster = isNodeInActiveCluster(node);
      const radius = nodeRadius(node) + (active ? 2.5 : 0);
      const alpha = active ? 1 : inCluster ? 0.88 : node.kind === 'domain' ? 0.82 : 0.38;

      ctx.save();
      if (active || inCluster) {
        const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4.5);
        halo.addColorStop(0, rgba(accentRgb, active ? 0.42 : 0.2));
        halo.addColorStop(1, rgba(accentRgb, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = node.kind === 'domain' ? rgba(accentRgb, alpha) : rgba(secondaryRgb, alpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (node.kind === 'domain' || active) {
        ctx.strokeStyle = rgba([245, 232, 192], active ? 0.9 : 0.62);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    nodes.forEach(function (node) {
      const showLabel = node.kind === 'domain' || node.id === activeNodeId || isNodeInActiveCluster(node);
      if (!showLabel) return;
      const point = positions.get(node.id);
      const onRight = point.x > width * 0.72;
      const active = node.id === activeNodeId;
      ctx.save();
      ctx.fillStyle = rgba([245, 232, 192], active ? 0.98 : node.kind === 'domain' ? 0.84 : 0.58);
      ctx.font = (node.kind === 'domain' ? '11px "DM Mono", monospace' : '8px "DM Mono", monospace');
      ctx.textAlign = onRight ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label.toUpperCase(), point.x + (onRight ? -11 : 11), point.y - 1);
      ctx.restore();
    });

    if (activeNodeId) {
      const activeNode = constellation.nodeById.get(activeNodeId);
      if (activeNode) {
        ctx.save();
        ctx.fillStyle = rgba([245, 232, 192], 0.7);
        ctx.font = '9px "DM Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const text = activeNode.summary.length > 58 ? activeNode.summary.slice(0, 55) + '…' : activeNode.summary;
        ctx.fillText(text, 18, height - 46);
        ctx.fillStyle = rgba(accentRgb, 0.9);
        ctx.font = '8px "DM Mono", monospace';
        ctx.fillText('CLICK TO ASK →', 18, height - 29);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawFrame(time) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const t = time - startTime;
    const mx = mouse.active ? mouse.x * width * 0.04 : 0;
    const my = mouse.active ? mouse.y * height * 0.03 : 0;

    ctx.save();
    ctx.filter = 'blur(34px)';
    ctx.globalCompositeOperation = 'lighter';
    orbs.forEach(function (orb, index) {
      let x = orb.bx + Math.sin(t * orb.speed + orb.phase) * orb.ampX + mx * (0.6 + index * 0.08);
      let y = orb.by + Math.cos(t * orb.speed * 1.25 + orb.phase * 1.4) * orb.ampY + my * (0.5 + index * 0.06);
      if (attract.active) {
        x += (attract.x - x) * 0.045;
        y += (attract.y - y) * 0.045;
      }
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, orb.r);
      gradient.addColorStop(0, rgba(orb.color, orb.alpha));
      gradient.addColorStop(0.45, rgba(orb.color, orb.alpha * 0.55));
      gradient.addColorStop(1, rgba(orb.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    if (!reducedMotion) {
      particles.forEach(function (particle) {
        if (attract.active) {
          particle.vx += (attract.x - particle.x) * 0.003;
          particle.vy += (attract.y - particle.y) * 0.003;
          particle.vx *= 0.97;
          particle.vy *= 0.97;
        }
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -4) particle.x = width + 4;
        if (particle.x > width + 4) particle.x = -4;
        if (particle.y < -4) particle.y = height + 4;
        if (particle.y > height + 4) particle.y = -4;
        ctx.fillStyle = rgba(accentRgb, particle.a);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.save();
    const vignette = ctx.createRadialGradient(width * 0.55, height * 0.45, width * 0.08, width * 0.55, height * 0.45, width * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawConstellation(ctx, time);
  }

  function loop(time) {
    if (!running) return;
    drawFrame(time);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || chatOpen) return;
    running = true;
    if (reducedMotion) {
      drawFrame(startTime);
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function setActiveNode(nodeId) {
    activeNodeId = nodeId || null;
    const node = constellation && activeNodeId ? constellation.nodeById.get(activeNodeId) : null;
    if (fallbackButton) fallbackButton.textContent = node ? 'Ask about ' + node.label : "Explore Simon's knowledge";
  }

  function openNode(node) {
    if (!node) return;
    track('knowledge_constellation_open_chat', { node_id: node.id, topic_kind: node.kind });
    if (window.SimonChat && typeof window.SimonChat.open === 'function') {
      window.SimonChat.open({ initialQuery: node.query, source: 'knowledge_constellation', nodeId: node.id });
    } else {
      window.dispatchEvent(new CustomEvent('knowledge-constellation:select', { detail: { node: node } }));
    }
  }

  function positionControl(node, button) {
    const point = pointForNode(node, performance.now());
    button.style.left = (point.x / width * 100) + '%';
    button.style.top = (point.y / height * 100) + '%';
  }

  function createNodeControl(node) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'constellation-node-control';
    button.textContent = node.label;
    button.setAttribute('aria-label', 'Explore ' + node.label + '. ' + node.summary + ' Opens Ask Simon with a suggested question.');
    button.addEventListener('pointerenter', function () { setActiveNode(node.id); });
    button.addEventListener('pointerleave', function () { if (activeNodeId === node.id) setActiveNode(null); });
    button.addEventListener('focus', function () { setActiveNode(node.id); });
    button.addEventListener('blur', function () { if (activeNodeId === node.id) setActiveNode(null); });
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (coarsePointer.matches && touchSelectedNodeId !== node.id) {
        touchSelectedNodeId = node.id;
        setActiveNode(node.id);
        return;
      }
      openNode(node);
    });
    controls.appendChild(button);
    controlButtons.set(node.id, button);
  }

  function syncConstellationControls() {
    if (!constellation || !controls || !width || !height) return;
    const visible = visibleNodes();
    const visibleIds = new Set(visible.map(node => node.id));
    constellation.nodes.forEach(function (node) {
      let button = controlButtons.get(node.id);
      if (!button) {
        createNodeControl(node);
        button = controlButtons.get(node.id);
      }
      button.hidden = !visibleIds.has(node.id);
      if (!button.hidden) positionControl(node, button);
    });
  }

  async function loadConstellation() {
    try {
      const response = await fetch('data/knowledge-constellation.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Manifest request failed');
      const data = validateManifest(await response.json());
      if (!data) throw new Error('Manifest validation failed');
      constellation = data;
      syncConstellationControls();
      if (!impressionTracked) {
        track('knowledge_constellation_impression', { node_count: constellation.nodes.length });
        impressionTracked = true;
      }
    } catch (error) {
      console.warn('[hero-fluid] knowledge constellation unavailable:', error);
    }
  }

  hero.addEventListener('pointermove', function (event) {
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    mouse.x = (event.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (event.clientY - rect.top) / rect.height - 0.5;
    mouse.active = event.clientX >= rect.left;
  }, { passive: true });

  hero.addEventListener('pointerleave', function () {
    mouse.active = false;
    mouse.x = 0;
    mouse.y = 0;
    if (!coarsePointer.matches) setActiveNode(null);
  });

  if (fallbackButton) {
    fallbackButton.addEventListener('click', function (event) {
      if (!activeNodeId || !constellation) return;
      event.preventDefault();
      event.stopPropagation();
      openNode(constellation.nodeById.get(activeNodeId));
    });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('simon-chat:state', function (event) {
    chatOpen = !!(event.detail && event.detail.open);
    if (chatOpen) stop();
    else start();
  });

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) start();
      else stop();
    });
  }, { threshold: 0.05 });
  observer.observe(hero);

  window.__heroFluid = {
    setAttract: function (x, y, active) {
      attract.x = x;
      attract.y = y;
      attract.active = !!active;
    },
    focusTopic: function (nodeId) {
      if (constellation && constellation.nodeById.has(nodeId)) setActiveNode(nodeId);
    },
  };

  readAccentColors();
  resize();
  drawFrame(startTime);
  start();
  loadConstellation();
})();
