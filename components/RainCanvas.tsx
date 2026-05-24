"use client";

import { useEffect, useRef, useCallback } from "react";

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
  width: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  born: number;
}

const DROP_COUNT = 120;
const RIPPLE_DURATION = 900; // ms

export default function RainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Drop[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const lastTimeRef = useRef(0);

  const initDrops = useCallback((width: number, height: number) => {
    dropsRef.current = Array.from({ length: DROP_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,           // stagger initial positions
      speed: 1.5 + Math.random() * 3.5,
      length: 8 + Math.random() * 18,
      opacity: 0.12 + Math.random() * 0.22,
      width: 0.5 + Math.random() * 1.0,
    }));
  }, []);

  const spawnRipple = useCallback((x: number, y: number) => {
    ripplesRef.current.push({
      x,
      y,
      radius: 0,
      maxRadius: 12 + Math.random() * 16,
      opacity: 0.35,
      born: performance.now(),
    });
    // Keep ripple pool bounded
    if (ripplesRef.current.length > 60) ripplesRef.current.shift();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDrops(canvas.width, canvas.height);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(document.body);

    // Pause rain while user is actively interacting
    const onPointerDown = () => { pausedRef.current = true; };
    const onPointerUp = () => {
      setTimeout(() => { pausedRef.current = false; }, 600);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const draw = (time: number) => {
      rafRef.current = requestAnimationFrame(draw);
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      // Cap delta to avoid big jumps after tab switch
      const dt = Math.min(delta, 50) / 16.67; // normalise to 60fps

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      const speedMul = pausedRef.current ? 0.15 : 1;

      // Draw drops
      dropsRef.current.forEach((drop) => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.width * 0.3, drop.y + drop.length);
        ctx.strokeStyle = `rgba(165, 195, 215, ${drop.opacity})`;
        ctx.lineWidth = drop.width;
        ctx.lineCap = "round";
        ctx.stroke();

        drop.y += drop.speed * dt * speedMul;

        if (drop.y - drop.length > H) {
          // Spawn ripple at landing position
          if (!pausedRef.current && Math.random() < 0.4) {
            spawnRipple(drop.x, H - 2);
          }
          // Reset drop to top
          drop.x = Math.random() * W;
          drop.y = -drop.length;
          drop.speed = 1.5 + Math.random() * 3.5;
          drop.opacity = 0.12 + Math.random() * 0.22;
        }
      });

      // Draw ripples
      const now = performance.now();
      ripplesRef.current = ripplesRef.current.filter((r) => {
        const age = now - r.born;
        if (age > RIPPLE_DURATION) return false;

        const progress = age / RIPPLE_DURATION;
        r.radius = r.maxRadius * progress;
        r.opacity = 0.35 * (1 - progress);

        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(165, 195, 215, ${r.opacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        return true;
      });
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [initDrops, spawnRipple]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
