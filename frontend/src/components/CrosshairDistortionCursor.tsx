import { useEffect, useRef } from "react";

const HOVER_SELECTOR = "a, button, [role='button'], [data-cursor-target]";
const TEXT_SELECTOR = "input, textarea, select, [contenteditable='true']";

export default function CrosshairDistortionCursor({ disabled = false }: { disabled?: boolean }) {
  const horizontalRef = useRef<SVGSVGElement>(null);
  const verticalRef = useRef<SVGSVGElement>(null);
  const turbulenceXRef = useRef<SVGFETurbulenceElement>(null);
  const turbulenceYRef = useRef<SVGFETurbulenceElement>(null);
  const frameRef = useRef<number | null>(null);
  const distortionFrameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const renderedRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const supportsCursor = !disabled
      && window.matchMedia("(pointer: fine)").matches
      && window.matchMedia("(hover: hover)").matches
      && !window.matchMedia("(pointer: coarse)").matches
      && !window.matchMedia("(hover: none)").matches
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsCursor) return;

    const horizontal = horizontalRef.current;
    const vertical = verticalRef.current;
    const turbulenceX = turbulenceXRef.current;
    const turbulenceY = turbulenceYRef.current;
    if (!horizontal || !vertical || !turbulenceX || !turbulenceY) return;

    document.documentElement.classList.add("crosshair-cursor-ready");

    const stopDistortion = () => {
      if (distortionFrameRef.current !== null) {
        cancelAnimationFrame(distortionFrameRef.current);
        distortionFrameRef.current = null;
      }
      horizontal.style.filter = "none";
      vertical.style.filter = "none";
      turbulenceX.setAttribute("baseFrequency", "0");
      turbulenceY.setAttribute("baseFrequency", "0");
    };

    const startDistortion = () => {
      stopDistortion();
      const startedAt = performance.now();
      const duration = 520;
      horizontal.style.filter = "url(#crosshair-filter-noise-x)";
      vertical.style.filter = "url(#crosshair-filter-noise-y)";

      const step = (timestamp: number) => {
        const progress = Math.min((timestamp - startedAt) / duration, 1);
        const turbulence = String(Math.max(0, 1 - progress));
        turbulenceX.setAttribute("baseFrequency", turbulence);
        turbulenceY.setAttribute("baseFrequency", turbulence);

        if (progress < 1) {
          distortionFrameRef.current = requestAnimationFrame(step);
        } else {
          stopDistortion();
        }
      };

      distortionFrameRef.current = requestAnimationFrame(step);
    };

    const updateHoverTarget = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const shouldDistort = Boolean(element?.closest(HOVER_SELECTOR)) && !element?.closest(TEXT_SELECTOR);
      if (shouldDistort) {
        startDistortion();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        renderedRef.current = pointerRef.current;
        horizontal.dataset.visible = "true";
        vertical.dataset.visible = "true";
      }
      updateHoverTarget(event.target);
    };

    const render = () => {
      renderedRef.current.x += (pointerRef.current.x - renderedRef.current.x) * 0.15;
      renderedRef.current.y += (pointerRef.current.y - renderedRef.current.y) * 0.15;
      vertical.style.transform = `translate3d(${renderedRef.current.x}px, 0, 0)`;
      horizontal.style.transform = `translate3d(0, ${renderedRef.current.y}px, 0)`;
      frameRef.current = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frameRef.current = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove("crosshair-cursor-ready");
      window.removeEventListener("pointermove", onPointerMove);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      stopDistortion();
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <div className="crosshair-cursor" aria-hidden="true">
      <svg ref={horizontalRef} className="crosshair-cursor__line crosshair-cursor__line--horizontal" viewBox="0 0 200 20" preserveAspectRatio="none">
        <defs>
          <filter id="crosshair-filter-noise-x" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
            <feTurbulence ref={turbulenceXRef} type="fractalNoise" baseFrequency="0" numOctaves="1" result="warp" />
            <feOffset dx="-30" result="warpOffset" />
            <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="warpOffset" />
          </filter>
        </defs>
        <line className="crosshair-cursor__line-element" x1="0" y1="10" x2="200" y2="10" shapeRendering="crispEdges" vectorEffect="non-scaling-stroke" />
      </svg>

      <svg ref={verticalRef} className="crosshair-cursor__line crosshair-cursor__line--vertical" viewBox="0 0 20 200" preserveAspectRatio="none">
        <defs>
          <filter id="crosshair-filter-noise-y" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
            <feTurbulence ref={turbulenceYRef} type="fractalNoise" baseFrequency="0" numOctaves="1" result="warp" />
            <feOffset dy="-30" result="warpOffset" />
            <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="warpOffset" />
          </filter>
        </defs>
        <line className="crosshair-cursor__line-element" x1="10" y1="0" x2="10" y2="200" shapeRendering="crispEdges" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
