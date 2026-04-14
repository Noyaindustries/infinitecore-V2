import { useEffect, useRef } from 'react';

/**
 * Fond marketing calqué sur infinitecore-v4.html : canvas (orbs + particules),
 * grille masquée, bruit SVG, spotlight curseur.
 */
export default function MarketingV4Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reduceMotionRef.current = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxRaw = canvas.getContext('2d');
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const orbs = [
      { x: 0.2, y: 0.15, r: 0.45, color: [74, 127, 181] as const, a: 0.12, speed: 0.00012, phase: 0 },
      { x: 0.8, y: 0.7, r: 0.38, color: [232, 150, 30] as const, a: 0.08, speed: 0.00018, phase: 1.5 },
      { x: 0.5, y: 0.4, r: 0.55, color: [74, 127, 181] as const, a: 0.06, speed: 0.00009, phase: 3.0 },
      { x: 0.15, y: 0.75, r: 0.28, color: [232, 150, 30] as const, a: 0.07, speed: 0.00022, phase: 0.7 },
      { x: 0.85, y: 0.2, r: 0.32, color: [74, 127, 181] as const, a: 0.09, speed: 0.00015, phase: 2.2 },
      { x: 0.6, y: 0.85, r: 0.25, color: [232, 150, 30] as const, a: 0.05, speed: 0.0002, phase: 4.5 },
    ];

    let W = 0;
    let H = 0;
    let T = 0;
    let particleCount = 60;
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
      c: readonly [number, number, number];
    }[] = [];

    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.4 + 0.3,
          a: Math.random() * 0.35 + 0.08,
          c: Math.random() > 0.55 ? ([74, 127, 181] as const) : ([232, 150, 30] as const),
        });
      }
    }

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      if (!reduceMotionRef.current) {
        particleCount = W < 768 ? 28 : 60;
        initParticles();
      }
      if (reduceMotionRef.current) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
      }
    }

    function drawBg() {
      if (reduceMotionRef.current) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
        return;
      }

      T += 1;
      ctx.clearRect(0, 0, W, H);

      orbs.forEach((orb) => {
        const t = T * orb.speed;
        const ox = (orb.x + Math.sin(t + orb.phase) * 0.12) * W;
        const oy = (orb.y + Math.cos(t * 0.7 + orb.phase) * 0.1) * H;
        const radius = orb.r * Math.min(W, H);
        const grd = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        grd.addColorStop(0, `rgba(${orb.color.join(',')},${orb.a})`);
        grd.addColorStop(0.5, `rgba(${orb.color.join(',')},${orb.a * 0.4})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c.join(',')},${p.a})`;
        ctx.fill();
      });

      const maxDist = W < 768 ? 80 : 100;
      const connAlpha = W < 768 ? 0.035 : 0.055;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(74,127,181,${connAlpha * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(drawBg);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotionRef.current) {
      rafRef.current = requestAnimationFrame(drawBg);
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const sp = spotlightRef.current;
    if (!sp) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      sp.style.opacity = '0';
      return;
    }

    const onMove = (e: MouseEvent) => {
      sp.style.transform = `translate(${e.clientX - 350}px, ${e.clientY - 350}px)`;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const noiseSvg =
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  return (
    <>
      <canvas
        ref={canvasRef}
        id="bg-canvas"
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1] bg-[length:64px_64px] opacity-100"
        style={{
          /* Lignes horizontales uniquement — les lignes verticales laissaient une bande grise visible au bord droit */
          backgroundImage: `linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)`,
          maskImage: 'radial-gradient(ellipse 120% 80% at 50% 0%, black 10%, transparent 75%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.016]"
        style={{
          backgroundImage: noiseSvg,
          backgroundSize: '180px',
        }}
        aria-hidden
      />
      <div
        ref={spotlightRef}
        className="pointer-events-none fixed left-0 top-0 z-[1] h-[700px] w-[700px] rounded-full transition-transform duration-75 ease-linear will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(74,127,181,0.05) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden
      />
    </>
  );
}
