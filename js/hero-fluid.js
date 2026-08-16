/**
 * hero-fluid.js — Soft metaballs, drift particles, and a knowledge star chart.
 * Node coordinates are resolved against live hero text so labels never cover
 * editorial type. The chart is an intentionally curated topic map, not a claim
 * that every article has a verified semantic relationship with every other.
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
  const MAX_NODES = 32;
  const MAX_EDGES = 40;
  const TEXT_OBSTACLE_SELECTORS = [
    '.hero-tag',
    '.hero-title',
    '.hero-eyebrow',
    '.hero-desc',
    '.hero-scroll',
    '#constellation-fallback',
  ];

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
  let labelMetrics = new Map();
  let cachedObstacles = [];
  let lastPhysicsTime = 0;
  const controlButtons = new Map();
  const resolved = new Map();

  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function layoutMode() {
    if (window.matchMedia('(max-width: 768px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 1100px)').matches) return 'tablet';
    return 'desktop';
  }

  function isCompact() {
    const mode = layoutMode();
    return mode === 'mobile' || mode === 'tablet';
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function inflate(rect, pad) {
    return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
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
    const nextWidth = Math.max(1, Math.floor(rect.width));
    const nextHeight = Math.max(1, Math.floor(rect.height));
    const nextDpr = Math.min(window.devicePixelRatio || 1, layoutMode() === 'mobile' ? 1.25 : 2);
    const sizeChanged = nextWidth !== width || nextHeight !== height || nextDpr !== dpr;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    if (sizeChanged) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      labelMetrics = new Map();
      buildScene();
    }
    resolveLayout();
    syncConstellationControls();
    if (reducedMotion) drawFrame(startTime);
  }

  function buildScene() {
    const mobile = layoutMode() === 'mobile';
    const count = mobile ? 4 : 7;
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

    const particleCount = mobile ? 36 : 70;
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * (i % 7 === 0 ? 1.8 : 1.2) + 0.25,
        a: Math.random() * 0.32 + 0.06,
        spark: i % 9 === 0,
      });
    }
  }

  function visibleNodes() {
    if (!constellation) return [];
    if (isCompact()) return constellation.nodes.filter(node => node.kind === 'domain');
    return constellation.nodes;
  }

  function addLocalRect(obstacles, hostRect, rect, pad) {
    if (!rect || rect.width < 3 || rect.height < 3) return;
    const local = {
      x: rect.left - hostRect.left,
      y: rect.top - hostRect.top,
      w: rect.width,
      h: rect.height,
    };
    if (local.x + local.w < -8 || local.y + local.h < -8 || local.x > width + 8 || local.y > height + 8) return;
    obstacles.push(inflate(local, pad));
  }

  function collectTextRects(el, hostRect, obstacles, pad) {
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    let added = 0;
    while ((node = walker.nextNode())) {
      if (!node.textContent || !node.textContent.trim()) continue;
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        addLocalRect(obstacles, hostRect, rects[i], pad);
        added += 1;
      }
    }
    if (!added) addLocalRect(obstacles, hostRect, el.getBoundingClientRect(), pad);
  }

  function collectObstacles() {
    const hostRect = host.getBoundingClientRect();
    const obstacles = [];
    const nav = document.querySelector('nav');
    if (nav) addLocalRect(obstacles, hostRect, nav.getBoundingClientRect(), 6);

    TEXT_OBSTACLE_SELECTORS.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        if (!el || el.hidden) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const pad = el.classList.contains('hero-tag') ? 16 : (el.classList.contains('hero-title') || el.closest('.hero-title')) ? 12 : 8;
        collectTextRects(el, hostRect, obstacles, pad);
      });
    });
    return obstacles;
  }

  function fieldBounds() {
    const mode = layoutMode();
    return {
      minX: mode === 'mobile' ? width * 0.08 : width * 0.05,
      maxX: width - (mode === 'mobile' ? 18 : 22),
      minY: mode === 'mobile' ? 30 : 70,
      maxY: height - (mode === 'mobile' ? 34 : 48),
    };
  }

  function measureLabel(node) {
    const cached = labelMetrics.get(node.id);
    if (cached) return cached;
    const ctx = canvas.getContext('2d');
    const text = node.label.toUpperCase();
    if (!ctx) {
      const fallback = { text: text, w: text.length * 6.2, h: node.kind === 'domain' ? 14 : 11 };
      labelMetrics.set(node.id, fallback);
      return fallback;
    }
    ctx.save();
    ctx.font = node.kind === 'domain' ? '10px "DM Mono", monospace' : '8px "DM Mono", monospace';
    const metrics = { text: text, w: Math.ceil(ctx.measureText(text).width), h: node.kind === 'domain' ? 14 : 11 };
    ctx.restore();
    labelMetrics.set(node.id, metrics);
    return metrics;
  }

  function labelBox(x, y, node, side) {
    const metrics = measureLabel(node);
    const gap = 11;
    if (side === 'left') return { x: x - gap - metrics.w, y: y - metrics.h / 2, w: metrics.w, h: metrics.h, side: side };
    if (side === 'top') return { x: x - metrics.w / 2, y: y - gap - metrics.h, w: metrics.w, h: metrics.h, side: side };
    if (side === 'bottom') return { x: x - metrics.w / 2, y: y + gap, w: metrics.w, h: metrics.h, side: side };
    return { x: x + gap, y: y - metrics.h / 2, w: metrics.w, h: metrics.h, side: side };
  }

  function starBox(x, y, node) {
    const r = nodeRadius(node) + 7;
    return { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  }

  function hitsAny(box, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      if (overlaps(box, obstacles[i])) return true;
    }
    return false;
  }

  function chooseLabelSide(x, y, node, obstacles, occupied) {
    const order = x > width * 0.74 ? ['left', 'top', 'bottom', 'right'] : ['right', 'left', 'top', 'bottom'];
    for (let i = 0; i < order.length; i++) {
      const box = labelBox(x, y, node, order[i]);
      if (box.x < 4 || box.y < 4 || box.x + box.w > width - 4 || box.y + box.h > height - 4) continue;
      if (hitsAny(box, obstacles) || hitsAny(box, occupied)) continue;
      return box;
    }
    return null;
  }

  function seedPosition(node, mode) {
    if (mode === 'mobile') {
      const domains = constellation.nodes.filter(item => item.kind === 'domain');
      const index = Math.max(0, domains.findIndex(item => item.id === node.id));
      const count = Math.max(domains.length, 1);
      const t = count === 1 ? 0.5 : index / (count - 1);
      const angle = -Math.PI * 0.72 + t * Math.PI * 0.92;
      const radius = Math.min(width, height) * (0.26 + (index % 3) * 0.045);
      return {
        x: width * 0.58 + Math.cos(angle) * radius,
        y: height * 0.5 + Math.sin(angle) * radius * 0.78,
      };
    }
    let nx = node.layout.x;
    let ny = node.layout.y;
    return { x: nx * width, y: ny * height };
  }

  function resolveLayout() {
    if (!constellation || !width || !height) return;
    const mode = layoutMode();
    const nodes = visibleNodes();
    cachedObstacles = collectObstacles();
    const obstacles = cachedObstacles;
    const bounds = fieldBounds();
    const previous = new Map(resolved);

    resolved.clear();
    const items = nodes.map(function (node) {
      const seed = seedPosition(node, mode);
      const prev = previous.get(node.id);
      return {
        id: node.id,
        node: node,
        homeX: clamp(seed.x, bounds.minX, bounds.maxX),
        homeY: clamp(seed.y, bounds.minY, bounds.maxY),
        x: prev ? prev.x : clamp(seed.x, bounds.minX, bounds.maxX),
        y: prev ? prev.y : clamp(seed.y, bounds.minY, bounds.maxY),
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        side: prev ? prev.side : 'right',
        showLabel: false,
      };
    });

    for (let iter = 0; iter < 40; iter++) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sBox = starBox(item.homeX, item.homeY, item.node);
        for (let o = 0; o < obstacles.length; o++) {
          if (!overlaps(sBox, obstacles[o])) continue;
          const ob = obstacles[o];
          const dx = (sBox.x + sBox.w / 2) - (ob.x + ob.w / 2);
          const dy = (sBox.y + sBox.h / 2) - (ob.y + ob.h / 2);
          const len = Math.hypot(dx, dy) || 1;
          item.homeX += (dx / len) * 5;
          item.homeY += (dy / len) * 5;
        }
        for (let j = i + 1; j < items.length; j++) {
          const other = items[j];
          const minDist = item.node.kind === 'domain' && other.node.kind === 'domain' ? 58 : 38;
          const dx = item.homeX - other.homeX;
          const dy = item.homeY - other.homeY;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist >= minDist) continue;
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          item.homeX += ux * push;
          item.homeY += uy * push;
          other.homeX -= ux * push;
          other.homeY -= uy * push;
        }
        item.homeX = clamp(item.homeX, bounds.minX, bounds.maxX);
        item.homeY = clamp(item.homeY, bounds.minY, bounds.maxY);
      }
    }

    const occupied = [];
    items.forEach(function (item) {
      if (!previous.has(item.id)) {
        item.x = item.homeX;
        item.y = item.homeY;
      }
      const always = item.node.kind === 'domain' || coarsePointer.matches;
      const box = chooseLabelSide(item.homeX, item.homeY, item.node, obstacles, occupied);
      if (box && always) {
        item.side = box.side;
        item.showLabel = true;
        occupied.push(inflate(box, 6));
      } else if (box) {
        item.side = box.side;
        item.showLabel = false;
      } else {
        item.showLabel = false;
      }
      resolved.set(item.id, item);
    });
  }

  function repelFromObstacle(item, ob, strength) {
    const inside = item.x >= ob.x && item.x <= ob.x + ob.w && item.y >= ob.y && item.y <= ob.y + ob.h;
    if (inside) {
      const dx = item.x - (ob.x + ob.w / 2);
      const dy = item.y - (ob.y + ob.h / 2);
      const len = Math.hypot(dx, dy) || 1;
      item.vx += (dx / len) * 0.28;
      item.vy += (dy / len) * 0.28;
      return;
    }
    const cx = clamp(item.x, ob.x, ob.x + ob.w);
    const cy = clamp(item.y, ob.y, ob.y + ob.h);
    const dx = item.x - cx;
    const dy = item.y - cy;
    const dist = Math.hypot(dx, dy);
    const min = 20;
    if (dist <= 0 || dist >= min) return;
    const force = ((min - dist) / min) * strength;
    item.vx += (dx / dist) * force;
    item.vy += (dy / dist) * force;
  }

  function stepPhysics(time) {
    if (!constellation || !resolved.size) return;
    const dt = lastPhysicsTime ? Math.min(32, time - lastPhysicsTime) / 16.67 : 1;
    lastPhysicsTime = time;

    const items = visibleNodes().map(function (node) { return resolved.get(node.id); }).filter(Boolean);
    const bounds = fieldBounds();
    const t = time - startTime;
    const wander = reducedMotion ? 3.2 : 11;
    const mousePull = reducedMotion ? 0.0012 : 0.0048;

    items.forEach(function (item) {
      const targetX = item.homeX + Math.sin(t * 0.00042 + item.node.phase) * wander;
      const targetY = item.homeY + Math.cos(t * 0.00034 + item.node.phase * 1.27) * wander * 0.72;
      item.vx += (targetX - item.x) * 0.028 * dt;
      item.vy += (targetY - item.y) * 0.028 * dt;

      if (attract.active) {
        const dx = attract.x - item.x;
        const dy = attract.y - item.y;
        const dist2 = dx * dx + dy * dy;
        const falloff = 1 / (1 + dist2 / 28000);
        item.vx += dx * mousePull * falloff * dt;
        item.vy += dy * mousePull * falloff * dt;
        if (item.id === activeNodeId) {
          item.vx += dx * 0.0022 * dt;
          item.vy += dy * 0.0022 * dt;
        }
      }

      for (let o = 0; o < cachedObstacles.length; o++) {
        repelFromObstacle(item, cachedObstacles[o], 0.16 * dt);
      }
    });

    if (constellation.edges) {
      constellation.edges.forEach(function (edge) {
        const source = resolved.get(edge.source);
        const target = resolved.get(edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const rest = source.node.kind === 'domain' && target.node.kind === 'subtopic' ? 78 : 92;
        const pull = (dist - rest) * 0.0007 * dt;
        const ux = dx / dist;
        const uy = dy / dist;
        source.vx += ux * pull;
        source.vy += uy * pull;
        target.vx -= ux * pull;
        target.vy -= uy * pull;
      });
    }

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minDist = a.node.kind === 'domain' && b.node.kind === 'domain' ? 56 : 36;
        if (dist >= minDist) continue;
        const push = ((minDist - dist) / minDist) * 0.14 * dt;
        const ux = dx / dist;
        const uy = dy / dist;
        a.vx += ux * push;
        a.vy += uy * push;
        b.vx -= ux * push;
        b.vy -= uy * push;
      }
    }

    items.forEach(function (item) {
      item.vx *= Math.pow(0.88, dt);
      item.vy *= Math.pow(0.88, dt);
      const speed = Math.hypot(item.vx, item.vy);
      const maxSpeed = reducedMotion ? 0.55 : 1.35;
      if (speed > maxSpeed) {
        item.vx = (item.vx / speed) * maxSpeed;
        item.vy = (item.vy / speed) * maxSpeed;
      }
      item.x = clamp(item.x + item.vx * dt, bounds.minX, bounds.maxX);
      item.y = clamp(item.y + item.vy * dt, bounds.minY, bounds.maxY);
    });
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
    if (node.kind !== 'domain') return 2.4;
    return 3.6 + ((node.weight || 0.4) * 4.2);
  }

  function pointForNode(node) {
    const layout = resolved.get(node.id);
    if (layout) return { x: layout.x, y: layout.y };
    return seedPosition(node, layoutMode());
  }

  function drawSpark(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgba([245, 232, 192], 0.9);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawConstellation(ctx, time) {
    if (!constellation) return;
    const nodes = visibleNodes();
    const visibleIds = new Set(nodes.map(node => node.id));
    const positions = new Map(nodes.map(node => [node.id, pointForNode(node)]));
    const obstacles = cachedObstacles;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    constellation.edges.forEach(function (edge) {
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return;
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const related = activeNodeId && (rootForNode(edge.source) === rootForNode(activeNodeId));
      ctx.beginPath();
      ctx.strokeStyle = rgba(accentRgb, related ? 0.55 : 0.16 + edge.strength * 0.14);
      ctx.lineWidth = related ? 1.15 : 0.7;
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.fillStyle = rgba(accentRgb, related ? 0.45 : 0.16);
      ctx.beginPath();
      ctx.arc(mx, my, related ? 1.4 : 0.9, 0, Math.PI * 2);
      ctx.fill();
    });

    nodes.forEach(function (node) {
      const point = positions.get(node.id);
      const active = node.id === activeNodeId;
      const inCluster = isNodeInActiveCluster(node);
      const radius = nodeRadius(node) + (active ? 1.8 : 0);
      const twinkle = reducedMotion ? 1 : 0.82 + Math.sin(time * 0.0024 + node.phase) * 0.18;
      const alpha = (active ? 1 : inCluster ? 0.92 : node.kind === 'domain' ? 0.88 : 0.42) * twinkle;

      if (active || inCluster || node.kind === 'domain') {
        const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 5.2);
        halo.addColorStop(0, rgba(accentRgb, active ? 0.38 : node.kind === 'domain' ? 0.16 : 0.12));
        halo.addColorStop(1, rgba(accentRgb, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 5.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (node.kind === 'domain') drawSpark(ctx, point.x, point.y, radius * 2.4, alpha * 0.7);

      ctx.fillStyle = node.kind === 'domain' ? rgba([245, 232, 192], alpha) : rgba(secondaryRgb, alpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (node.kind === 'domain' || active) {
        ctx.strokeStyle = rgba(accentRgb, active ? 0.95 : 0.5);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    nodes.forEach(function (node) {
      const layout = resolved.get(node.id);
      const active = node.id === activeNodeId;
      const inCluster = isNodeInActiveCluster(node);
      const show = (layout && layout.showLabel) || active || inCluster;
      if (!show) return;
      const point = positions.get(node.id);
      const side = layout ? layout.side : (point.x > width * 0.74 ? 'left' : 'right');
      const box = labelBox(point.x, point.y, node, side);
      if (!active && !inCluster && hitsAny(box, obstacles)) return;

      const metrics = measureLabel(node);
      let lx = point.x;
      let ly = point.y;
      let align = 'left';
      if (side === 'left') { lx = point.x - 11; align = 'right'; }
      else if (side === 'right') { lx = point.x + 11; align = 'left'; }
      else if (side === 'top') { lx = point.x; ly = point.y - 12; align = 'center'; }
      else { lx = point.x; ly = point.y + 12; align = 'center'; }

      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, active ? 0.45 : 0.22);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(side === 'left' ? point.x - 8 : side === 'right' ? point.x + 8 : point.x, side === 'top' ? point.y - 8 : side === 'bottom' ? point.y + 8 : point.y);
      ctx.stroke();
      ctx.fillStyle = rgba([245, 232, 192], active ? 0.98 : node.kind === 'domain' ? 0.86 : 0.64);
      ctx.font = node.kind === 'domain' ? '10px "DM Mono", monospace' : '8px "DM Mono", monospace';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(metrics.text, lx, ly);
      ctx.restore();
    });

    if (activeNodeId && layoutMode() !== 'mobile') {
      const activeNode = constellation.nodeById.get(activeNodeId);
      if (activeNode) {
        ctx.save();
        ctx.fillStyle = rgba([245, 232, 192], 0.72);
        ctx.font = '9px "DM Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const text = activeNode.summary.length > 58 ? activeNode.summary.slice(0, 55) + '…' : activeNode.summary;
        ctx.fillText(text, 18, height - 46);
        ctx.fillStyle = rgba(accentRgb, 0.9);
        ctx.font = '8px "DM Mono", monospace';
        ctx.fillText((coarsePointer.matches ? 'TAP AGAIN TO ASK →' : 'CLICK TO ASK →'), 18, height - 29);
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
        if (particle.spark) drawSpark(ctx, particle.x, particle.y, 3.2, particle.a * 0.8);
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
    syncControlPositions();
  }

  function loop(time) {
    if (!running) return;
    stepPhysics(time);
    drawFrame(time);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || chatOpen) return;
    running = true;
    lastPhysicsTime = 0;
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
    if (reducedMotion) drawFrame(startTime);
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

  function nearestNodeAt(x, y) {
    const nodes = visibleNodes();
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const point = pointForNode(node);
      const layout = resolved.get(node.id);
      const radius = (node.kind === 'domain' ? 28 : 18) + nodeRadius(node);
      const dist = Math.hypot(point.x - x, point.y - y);
      if (dist < radius && dist < bestDist) {
        best = node;
        bestDist = dist;
      }
      if (layout && (layout.showLabel || node.id === activeNodeId || isNodeInActiveCluster(node))) {
        const box = labelBox(point.x, point.y, node, layout.side);
        if (x >= box.x - 4 && x <= box.x + box.w + 4 && y >= box.y - 4 && y <= box.y + box.h + 4 && dist < bestDist + 24) {
          best = node;
          bestDist = Math.min(bestDist, dist);
        }
      }
    }
    return best;
  }

  function hoverAtClient(clientX, clientY) {
    const rect = host.getBoundingClientRect();
    if (!rect.width) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      if (!coarsePointer.matches) setActiveNode(null);
      return null;
    }
    const node = nearestNodeAt(x, y);
    if (node) setActiveNode(node.id);
    else if (!coarsePointer.matches) setActiveNode(null);
    return node;
  }

  function positionControl(node, button) {
    const point = pointForNode(node);
    button.style.left = (point.x / width * 100) + '%';
    button.style.top = (point.y / height * 100) + '%';
    button.dataset.kind = node.kind;
  }

  function syncControlPositions() {
    if (!width || !height) return;
    controlButtons.forEach(function (button, id) {
      if (button.hidden) return;
      const node = constellation && constellation.nodeById.get(id);
      if (node) positionControl(node, button);
    });
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
      resolveLayout();
      syncConstellationControls();
      if (reducedMotion) drawFrame(startTime);
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
    hoverAtClient(event.clientX, event.clientY);
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

  if (typeof ResizeObserver === 'function') {
    let layoutTimer = 0;
    const observerLayout = new ResizeObserver(function () {
      window.clearTimeout(layoutTimer);
      layoutTimer = window.setTimeout(resize, 80);
    });
    observerLayout.observe(hero);
  }

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
    handlePointerClick: function (clientX, clientY) {
      const rect = host.getBoundingClientRect();
      if (!rect.width) return false;
      const node = nearestNodeAt(clientX - rect.left, clientY - rect.top);
      if (!node) return false;
      if (coarsePointer.matches && touchSelectedNodeId !== node.id) {
        touchSelectedNodeId = node.id;
        setActiveNode(node.id);
        return true;
      }
      openNode(node);
      return true;
    },
  };

  readAccentColors();
  resize();
  drawFrame(startTime);
  start();
  loadConstellation();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      labelMetrics = new Map();
      resolveLayout();
      syncConstellationControls();
      if (reducedMotion) drawFrame(startTime);
    });
  }
  window.setTimeout(function () {
    resolveLayout();
    syncConstellationControls();
    if (reducedMotion) drawFrame(startTime);
  }, 1100);
})();
