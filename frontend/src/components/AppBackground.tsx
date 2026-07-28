import { useEffect, useRef } from "react";

export default function AppBackground() {
  const glowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const currentRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const hover = window.matchMedia("(hover: hover)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const noHover = window.matchMedia("(hover: none)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const shouldRun = finePointer.matches
      && hover.matches
      && !coarsePointer.matches
      && !noHover.matches
      && !reducedMotion.matches
      && document.documentElement.dataset.reducedMotion !== "true";

    if (!shouldRun) return;

    const glow = glowRef.current;
    if (!glow) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      targetRef.current.x = event.clientX;
      targetRef.current.y = event.clientY;
      glow.dataset.visible = "true";
    };

    const onPointerLeave = () => {
      glow.dataset.visible = "false";
    };

    const onPointerEnter = () => {
      glow.dataset.visible = "true";
    };

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameRef.current || timestamp;
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.08);
      lastFrameRef.current = timestamp;
      const smoothing = 1 - Math.exp(-8 * deltaSeconds);

      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * smoothing;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * smoothing;
      glow.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y}px, 0) translate(-50%, -50%)`;

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerenter", onPointerEnter);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerenter", onPointerEnter);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="home-bg">
      <div ref={glowRef} className="ambient-mouse-glow" data-visible="false" aria-hidden="true" />
      <div className="home-noise" />
      <div className="client-grid" />
    </div>
  );
}
