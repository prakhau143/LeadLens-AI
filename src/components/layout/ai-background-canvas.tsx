"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative "image → AI → structured data" scene: faint card outlines on the left,
 * a small AI node, and a dot-matrix "table" on the right, with particles carrying data
 * between them. Deliberately tiny: ~24 particles, 30 fps, one 2D canvas, no assets.
 * The wrapper only mounts this on wide screens without reduced-motion, and it stops
 * drawing whenever the tab is hidden.
 */

const FPS = 30;
const PARTICLES = 24;
const GRID_COLS = 8;
const GRID_ROWS = 5;

type Particle = {
  card: number; // which card it left from
  cell: number; // which grid cell it is heading to
  born: number;
  span: number; // ms for the whole journey
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (t: number) => t * t * (3 - 2 * t);

export default function AiBackgroundCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let lastFrame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cells = new Float32Array(GRID_COLS * GRID_ROWS).fill(0);
    let particles: Particle[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (now: number, stagger = false): Particle => ({
      card: Math.floor(rand(0, 3)),
      cell: Math.floor(rand(0, GRID_COLS * GRID_ROWS)),
      born: stagger ? now - rand(0, 4200) : now,
      span: rand(3800, 5200),
    });

    // Scene geometry, all derived from the viewport so it scales with it.
    const cardRect = (i: number, t: number) => {
      const cw = Math.min(150, w * 0.11);
      const ch = cw * 0.6;
      const x = w * (0.04 + [0.0, 0.06, 0.01][i]);
      const y = h * (0.16 + i * 0.19) + Math.sin(t * 0.0005 + i * 2) * 8;
      return { x, y, cw, ch };
    };
    const node = () => ({ x: w * 0.3, y: h * 0.4 });
    const gridCell = (index: number) => {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      const gap = Math.min(24, w * 0.017);
      return { x: w * 0.97 - GRID_COLS * gap + col * gap, y: h * 0.22 + row * gap };
    };

    const draw = (now: number) => {
      const dark = document.documentElement.classList.contains("dark");
      const rgb = dark ? "150,165,255" : "60,70,190";
      const a = (v: number) => `rgba(${rgb},${dark ? v : v * 0.8})`;
      ctx.clearRect(0, 0, w, h);

      // Card outlines (with faint "text line" bars): the input images.
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const { x, y, cw, ch } = cardRect(i, now);
        ctx.strokeStyle = a(0.13);
        ctx.beginPath();
        ctx.roundRect(x, y, cw, ch, 8);
        ctx.stroke();
        ctx.fillStyle = a(0.09);
        ctx.fillRect(x + 12, y + 14, cw * 0.45, 4);
        ctx.fillRect(x + 12, y + 26, cw * 0.3, 3);
        ctx.fillRect(x + 12, y + ch - 20, cw * 0.55, 3);
      }

      // AI node: a small ring with a slow pulse.
      const n = node();
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.002);
      ctx.strokeStyle = a(0.25 + 0.15 * pulse);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 9 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = a(0.5);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Structured grid: cells light up when a particle lands and then fade back.
      for (let i = 0; i < cells.length; i++) {
        const { x, y } = gridCell(i);
        ctx.fillStyle = a(0.1 + cells[i] * 0.45);
        ctx.fillRect(x, y, 6, 6);
        cells[i] *= 0.985;
      }

      // Particles: card → node → grid cell, two eased legs.
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const t = (now - p.born) / p.span;
        if (t >= 1) {
          cells[p.cell] = 1;
          particles[i] = spawn(now);
          continue;
        }
        if (t < 0) continue;
        const c = cardRect(p.card, now);
        const from = { x: c.x + c.cw, y: c.y + c.ch / 2 };
        const to = gridCell(p.cell);
        const leg1 = t < 0.45;
        const k = ease(leg1 ? t / 0.45 : (t - 0.45) / 0.55);
        const a0 = leg1 ? from : n;
        const b0 = leg1 ? n : { x: to.x + 3, y: to.y + 3 };
        const x = a0.x + (b0.x - a0.x) * k;
        const y = a0.y + (b0.y - a0.y) * k + Math.sin(k * Math.PI) * (leg1 ? -10 : 14);
        const fade = Math.sin(Math.min(1, t * 1.05) * Math.PI); // fade in and out
        ctx.strokeStyle = a(0.1 * fade);
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = a(0.75 * fade);
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastFrame < 1000 / FPS) return;
      lastFrame = now;
      draw(now);
    };
    const start = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };

    resize();
    const t0 = performance.now();
    particles = Array.from({ length: PARTICLES }, () => spawn(t0, true));
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    return () => {
      stop();
      cancelAnimationFrame(resizeRaf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
