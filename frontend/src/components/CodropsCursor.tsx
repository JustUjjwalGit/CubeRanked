import { useEffect, useRef } from "react";

const HOVER_SELECTOR = "a, button, [role='button'], [data-cursor-target]";
const TEXT_SELECTOR = "input, textarea, select, [contenteditable='true']";

export default function CodropsCursor({ disabled = false }: { disabled?: boolean }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: -100, y: -100 });
  const outerRefPos = useRef({ x: -100, y: -100 });
  const hoverRectRef = useRef<DOMRect | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const supportsCursor = !disabled
      && window.matchMedia("(pointer: fine)").matches
      && window.matchMedia("(hover: hover)").matches
      && !window.matchMedia("(pointer: coarse)").matches
      && !window.matchMedia("(hover: none)").matches
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsCursor) {
      return;
    }

    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    enabledRef.current = true;
    document.documentElement.classList.add("codrops-cursor-ready");

    const updateHoverTarget = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      if (!element || element.closest(TEXT_SELECTOR)) {
        hoverRectRef.current = null;
        outer.dataset.state = element?.closest(TEXT_SELECTOR) ? "text" : "default";
        return;
      }

      const hoverTarget = element.closest(HOVER_SELECTOR);
      hoverRectRef.current = hoverTarget ? hoverTarget.getBoundingClientRect() : null;
      outer.dataset.state = hoverTarget ? "stuck" : "default";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      updateHoverTarget(event.target);
      inner.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };

    const onPointerLeave = () => {
      inner.dataset.hidden = "true";
      outer.dataset.hidden = "true";
    };

    const onPointerEnter = () => {
      inner.dataset.hidden = "false";
      outer.dataset.hidden = "false";
    };

    const animate = () => {
      if (!enabledRef.current) return;

      const hoverRect = hoverRectRef.current;
      const targetX = hoverRect ? hoverRect.left + hoverRect.width / 2 : pointerRef.current.x;
      const targetY = hoverRect ? hoverRect.top + hoverRect.height / 2 : pointerRef.current.y;
      const speed = hoverRect ? 0.32 : 0.18;

      outerRefPos.current.x += (targetX - outerRefPos.current.x) * speed;
      outerRefPos.current.y += (targetY - outerRefPos.current.y) * speed;

      if (hoverRect) {
        outer.style.width = `${Math.max(hoverRect.width, 30)}px`;
        outer.style.height = `${Math.max(hoverRect.height, 30)}px`;
        outer.style.transform = `translate3d(${outerRefPos.current.x}px, ${outerRefPos.current.y}px, 0) translate(-50%, -50%)`;
      } else {
        outer.style.width = "";
        outer.style.height = "";
        outer.style.transform = `translate3d(${outerRefPos.current.x}px, ${outerRefPos.current.y}px, 0) translate(-50%, -50%)`;
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerenter", onPointerEnter);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      enabledRef.current = false;
      document.documentElement.classList.remove("codrops-cursor-ready");
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

  return (
    <div className="codrops-cursor" aria-hidden="true">
      <div ref={innerRef} className="circle-cursor circle-cursor--inner" />
      <div ref={outerRef} className="circle-cursor circle-cursor--outer" />
    </div>
  );
}
