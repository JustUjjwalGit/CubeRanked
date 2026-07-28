import { useEffect, useRef } from "react";

export default function MouseFollowGlow({ disabled = false }: { disabled?: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const glowPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const supportsGlow = !disabled
      && window.matchMedia("(pointer: fine)").matches
      && window.matchMedia("(hover: hover)").matches
      && !window.matchMedia("(pointer: coarse)").matches
      && !window.matchMedia("(hover: none)").matches
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsGlow) return;

    const glow = glowRef.current;
    if (!glow) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      glow.dataset.visible = "true";
    };

    const onPointerLeave = () => {
      glow.dataset.visible = "false";
    };

    const onPointerEnter = () => {
      glow.dataset.visible = "true";
    };

    const render = () => {
      glowPositionRef.current.x += (pointerRef.current.x - glowPositionRef.current.x) * 0.16;
      glowPositionRef.current.y += (pointerRef.current.y - glowPositionRef.current.y) * 0.16;
      glow.style.transform = `translate3d(${glowPositionRef.current.x}px, ${glowPositionRef.current.y}px, 0) translate(-50%, -50%)`;
      frameRef.current = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerenter", onPointerEnter);
    frameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerenter", onPointerEnter);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [disabled]);

  if (disabled) return null;

  return <div ref={glowRef} className="mouse-follow-glow" data-visible="false" aria-hidden="true" />;
}
