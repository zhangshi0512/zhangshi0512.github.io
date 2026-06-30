/**
 * hero-fluid.js — Soft metaball orbs + drift particles for the hero void.
 * Fills the right-side dark area and gives the chat glass panel something to blur.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('hero-fluid-canvas');
  const host = document.getElementById('hero-fluid');
  const hero = document.getElementById('hero');
  if (!canvas || !host || !hero) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  const mouse = { x: 0, y: 0, active: false };
  let accentRgb = [110, 195, 255];
  let secondaryRgb = [180, 140, 255];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let orbs = [];
  let particles = [];
  let rafId = 0;
  let running = false;
  let startTime = performance.now();

  function readAccentColors() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--accent)';
    document.documentElement.appendChild(probe);
    const accent = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.style.color = 'var(--fg)';
    const fg = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    if (accent && accent.length >= 3) {
      accentRgb = accent.slice(0, 3).map(Number);
    }
    if (fg && fg.length >= 3) {
      const f = fg.slice(0, 3).map(Number);
      secondaryRgb = [
        Math.round(accentRgb[0] * 0.45 + f[0] * 0.55),
        Math.round(accentRgb[1] * 0.45 + f[1] * 0.55),
        Math.round(accentRgb[2] * 0.45 + f[2] * 0.55),
      ];
    }
  }

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
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

    const pCount = isMobile() ? 28 : 55;
    particles = [];
    for (let i = 0; i < pCount; i++) {
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

    orbs.forEach(function (o, i) {
      const x = o.bx + Math.sin(t * o.speed + o.phase) * o.ampX + mx * (0.6 + i * 0.08);
      const y = o.by + Math.cos(t * o.speed * 1.25 + o.phase * 1.4) * o.ampY + my * (0.5 + i * 0.06);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, o.r);
      grad.addColorStop(0, rgba(o.color, o.alpha));
      grad.addColorStop(0.45, rgba(o.color, o.alpha * 0.55));
      grad.addColorStop(1, rgba(o.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    if (!reducedMotion) {
      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -4) p.x = width + 4;
        if (p.x > width + 4) p.x = -4;
        if (p.y < -4) p.y = height + 4;
        if (p.y > height + 4) p.y = -4;
        ctx.fillStyle = rgba(accentRgb, p.a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(
      width * 0.55, height * 0.45, width * 0.08,
      width * 0.55, height * 0.45, width * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function loop(time) {
    if (!running) return;
    drawFrame(time);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
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

  hero.addEventListener('pointermove', function (e) {
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    mouse.x = (e.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (e.clientY - rect.top) / rect.height - 0.5;
    mouse.active = e.clientX >= rect.left;
  }, { passive: true });

  hero.addEventListener('pointerleave', function () {
    mouse.active = false;
    mouse.x = 0;
    mouse.y = 0;
  });

  window.addEventListener('resize', resize);

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) start();
      else stop();
    });
  }, { threshold: 0.05 });
  observer.observe(hero);

  readAccentColors();
  resize();
  drawFrame(startTime);
  start();
})();
