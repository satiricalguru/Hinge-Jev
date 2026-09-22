import { useEffect, useRef } from "react";

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
}

export function InteractiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Mouse coordinates and smoothing
    const targetMouse = { x: -1000, y: -1000, active: false };
    const smoothMouse = { x: -1000, y: -1000 };
    let mouseAlpha = 0;
    let lastMoveTime = 0;
    const ripples: Ripple[] = [];

    const GRID_SIZE = 48;
    const SPOTLIGHT_RADIUS = 340;

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    function onMouseMove(e: MouseEvent) {
      targetMouse.x = e.clientX;
      targetMouse.y = e.clientY;
      targetMouse.active = true;
      lastMoveTime = performance.now();
      if (!animId) {
        animId = requestAnimationFrame(render);
      }
    }

    function onMouseLeave() {
      targetMouse.active = false;
    }

    function onPointerDown(e: MouseEvent) {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: 360,
        speed: 7,
        alpha: 0.85,
      });
      if (!animId) {
        animId = requestAnimationFrame(render);
      }
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    function render() {
      if (!ctx || !canvas) return;

      const isDark = document.documentElement.dataset.theme === "dark";
      const scrollY = window.scrollY || 0;
      const scrollOffset = -(scrollY % GRID_SIZE);

      // Smooth damping toward target mouse
      const lerp = 0.12;
      smoothMouse.x += (targetMouse.x - smoothMouse.x) * lerp;
      smoothMouse.y += (targetMouse.y - smoothMouse.y) * lerp;

      // Mouse alpha fade in / out
      const now = performance.now();
      const isRecent = targetMouse.active && now - lastMoveTime < 2800;
      const targetAlpha = isRecent ? 1 : 0;
      mouseAlpha += (targetAlpha - mouseAlpha) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // Colors based on theme
      const glowLineColor = isDark
        ? { r: 120, g: 185, b: 255 }
        : { r: 7, g: 91, b: 255 };
      const crosshairColor = isDark
        ? { r: 175, g: 220, b: 255 }
        : { r: 7, g: 91, b: 255 };

      // 1. Draw subtle ambient spotlight glow if mouse is active
      if (mouseAlpha > 0.01) {
        const ambientGrad = ctx.createRadialGradient(
          smoothMouse.x,
          smoothMouse.y,
          0,
          smoothMouse.x,
          smoothMouse.y,
          SPOTLIGHT_RADIUS,
        );
        if (isDark) {
          ambientGrad.addColorStop(
            0,
            `rgba(104, 165, 255, ${0.14 * mouseAlpha})`,
          );
          ambientGrad.addColorStop(
            0.35,
            `rgba(45, 110, 195, ${0.06 * mouseAlpha})`,
          );
          ambientGrad.addColorStop(1, "rgba(6, 16, 29, 0)");
        } else {
          ambientGrad.addColorStop(0, `rgba(7, 91, 255, ${0.09 * mouseAlpha})`);
          ambientGrad.addColorStop(
            0.35,
            `rgba(7, 91, 255, ${0.03 * mouseAlpha})`,
          );
          ambientGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        }
        ctx.fillStyle = ambientGrad;
        ctx.beginPath();
        ctx.arc(smoothMouse.x, smoothMouse.y, SPOTLIGHT_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw glowing illuminated grid lines near cursor
        const minCol = Math.max(
          0,
          Math.floor((smoothMouse.x - SPOTLIGHT_RADIUS) / GRID_SIZE),
        );
        const maxCol = Math.min(
          Math.ceil(width / GRID_SIZE),
          Math.ceil((smoothMouse.x + SPOTLIGHT_RADIUS) / GRID_SIZE),
        );
        const minRow = Math.max(
          0,
          Math.floor(
            (smoothMouse.y - SPOTLIGHT_RADIUS - scrollOffset) / GRID_SIZE,
          ),
        );
        const maxRow = Math.min(
          Math.ceil((height - scrollOffset) / GRID_SIZE),
          Math.ceil(
            (smoothMouse.y + SPOTLIGHT_RADIUS - scrollOffset) / GRID_SIZE,
          ),
        );

        ctx.lineWidth = 1.25;

        // Vertical lines near cursor
        for (let c = minCol; c <= maxCol; c++) {
          const gx = c * GRID_SIZE;
          const dx = Math.abs(gx - smoothMouse.x);
          if (dx < SPOTLIGHT_RADIUS) {
            const span = Math.sqrt(
              SPOTLIGHT_RADIUS * SPOTLIGHT_RADIUS - dx * dx,
            );
            const y1 = Math.max(0, smoothMouse.y - span);
            const y2 = Math.min(height, smoothMouse.y + span);

            const lineGrad = ctx.createLinearGradient(gx, y1, gx, y2);
            const mid = (smoothMouse.y - y1) / (y2 - y1 || 1);
            const peakAlpha =
              (1 - dx / SPOTLIGHT_RADIUS) *
              0.55 *
              mouseAlpha *
              (isDark ? 1 : 0.85);

            lineGrad.addColorStop(
              0,
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, 0)`,
            );
            lineGrad.addColorStop(
              Math.max(0, Math.min(1, mid)),
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, ${peakAlpha})`,
            );
            lineGrad.addColorStop(
              1,
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, 0)`,
            );

            ctx.strokeStyle = lineGrad;
            ctx.beginPath();
            ctx.moveTo(gx, y1);
            ctx.lineTo(gx, y2);
            ctx.stroke();
          }
        }

        // Horizontal lines near cursor
        for (let r = minRow; r <= maxRow; r++) {
          const gy = r * GRID_SIZE + scrollOffset;
          const dy = Math.abs(gy - smoothMouse.y);
          if (dy < SPOTLIGHT_RADIUS) {
            const span = Math.sqrt(
              SPOTLIGHT_RADIUS * SPOTLIGHT_RADIUS - dy * dy,
            );
            const x1 = Math.max(0, smoothMouse.x - span);
            const x2 = Math.min(width, smoothMouse.x + span);

            const lineGrad = ctx.createLinearGradient(x1, gy, x2, gy);
            const mid = (smoothMouse.x - x1) / (x2 - x1 || 1);
            const peakAlpha =
              (1 - dy / SPOTLIGHT_RADIUS) *
              0.55 *
              mouseAlpha *
              (isDark ? 1 : 0.85);

            lineGrad.addColorStop(
              0,
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, 0)`,
            );
            lineGrad.addColorStop(
              Math.max(0, Math.min(1, mid)),
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, ${peakAlpha})`,
            );
            lineGrad.addColorStop(
              1,
              `rgba(${glowLineColor.r}, ${glowLineColor.g}, ${glowLineColor.b}, 0)`,
            );

            ctx.strokeStyle = lineGrad;
            ctx.beginPath();
            ctx.moveTo(x1, gy);
            ctx.lineTo(x2, gy);
            ctx.stroke();
          }
        }

        // 3. Draw luminous intersection crosshairs / dots at grid junctions
        for (let c = minCol; c <= maxCol; c++) {
          const gx = c * GRID_SIZE;
          for (let r = minRow; r <= maxRow; r++) {
            const gy = r * GRID_SIZE + scrollOffset;
            const dist = Math.hypot(gx - smoothMouse.x, gy - smoothMouse.y);
            if (dist < SPOTLIGHT_RADIUS) {
              const norm = Math.max(0, 1 - dist / SPOTLIGHT_RADIUS);
              const nodeAlpha = Math.pow(norm, 2.2) * 0.9 * mouseAlpha;
              if (nodeAlpha > 0.02) {
                // Crosshair arms
                const arm = 3.5 * norm;
                ctx.strokeStyle = `rgba(${crosshairColor.r}, ${crosshairColor.g}, ${crosshairColor.b}, ${nodeAlpha * 0.9})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(gx - arm, gy);
                ctx.lineTo(gx + arm, gy);
                ctx.moveTo(gx, gy - arm);
                ctx.lineTo(gx, gy + arm);
                ctx.stroke();

                // Center diamond/dot
                ctx.fillStyle = `rgba(${crosshairColor.r}, ${crosshairColor.g}, ${crosshairColor.b}, ${nodeAlpha})`;
                ctx.beginPath();
                ctx.arc(gx, gy, 1.25, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      // 4. Update and render dynamic ripple pulses
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.radius += ripple.speed;
        ripple.alpha *= 0.96;

        if (ripple.alpha > 0.01 && ripple.radius < ripple.maxRadius) {
          ctx.strokeStyle = isDark
            ? `rgba(130, 200, 255, ${ripple.alpha * 0.5})`
            : `rgba(7, 91, 255, ${ripple.alpha * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ripples.splice(i, 1);
        }
      }

      // Continue animation if anything is active
      const mouseDist = Math.hypot(
        targetMouse.x - smoothMouse.x,
        targetMouse.y - smoothMouse.y,
      );
      if (mouseAlpha > 0.005 || ripples.length > 0 || mouseDist > 0.5) {
        animId = requestAnimationFrame(render);
      } else {
        animId = null;
      }
    }

    // Initial render
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="interactive-grid-canvas"
      aria-hidden="true"
    />
  );
}
