import { useEffect, useRef } from "react";

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  "input",
  "select",
  "textarea",
  "[data-cursor-interactive]",
  ".sd2-cube-style-card",
  ".sd2-nav-item",
  ".settings-chip",
  ".settings-tab",
  ".queue-card",
  ".mode-card",
  ".play-card",
  ".nav-item",
  ".premium-slider-input",
  ".ui-scale-input",
].join(",");

const DISABLED_SELECTOR = "button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled='true']";
const TEXT_SELECTOR = "input, textarea, [contenteditable='true']";

type PointerMode = "default" | "interactive" | "text" | "disabled" | "dragging";

interface PremiumCursorProps {
  reducedMotion?: boolean;
  minimal?: boolean;
}

export default function PremiumCursor({ reducedMotion = false, minimal = false }: PremiumCursorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const enabledRef = useRef(false);
  const minimalRef = useRef(minimal);
  const pointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const previousPointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const outerPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const modeRef = useRef<PointerMode>("default");
  const targetRectRef = useRef<DOMRect | null>(null);
  const downRef = useRef(false);
  const lastTimeRef = useRef(0);
  const distortionRef = useRef(0);
  const burstUntilRef = useRef(0);
  const burstStartRef = useRef(0);

  useEffect(() => {
    minimalRef.current = minimal;
  }, [minimal]);

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches
      && window.matchMedia("(hover: hover)").matches
      && !window.matchMedia("(pointer: coarse)").matches
      && !window.matchMedia("(hover: none)").matches;
    const supportsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsSvgFilter = typeof SVGFEGaussianBlurElement !== "undefined" || typeof SVGFEColorMatrixElement !== "undefined";

    if (reducedMotion || !supportsFinePointer || !supportsMotion || !supportsSvgFilter) {
      return;
    }

    const root = rootRef.current;
    const dot = dotRef.current;
    const outer = outerRef.current;
    const crosshair = crosshairRef.current;
    const pulse = pulseRef.current;

    if (!root || !dot || !outer || !crosshair || !pulse) {
      return;
    }

    mountedRef.current = true;
    enabledRef.current = true;
    document.documentElement.classList.add("custom-cursor-ready");
    root.dataset.mode = "default";

    const burst = (duration = 430, strength = 1) => {
      const now = performance.now();
      burstStartRef.current = now;
      burstUntilRef.current = now + duration;
      distortionRef.current = Math.max(distortionRef.current, strength);
    };

    const updateTarget = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      if (!element || minimalRef.current) {
        targetRectRef.current = null;
        modeRef.current = downRef.current ? "dragging" : "default";
        root.dataset.mode = modeRef.current;
        return;
      }

      if (element.closest(TEXT_SELECTOR)) {
        targetRectRef.current = null;
        modeRef.current = "text";
      } else if (element.closest(DISABLED_SELECTOR)) {
        targetRectRef.current = null;
        modeRef.current = "disabled";
      } else {
        const interactive = element.closest(INTERACTIVE_SELECTOR);
        targetRectRef.current = interactive ? interactive.getBoundingClientRect() : null;
        modeRef.current = interactive ? "interactive" : "default";
        if (interactive) {
          burst(460, 0.8);
        }
      }

      root.dataset.mode = modeRef.current;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      updateTarget(event.target);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      downRef.current = true;
      modeRef.current = minimalRef.current ? "default" : "dragging";
      root.dataset.mode = modeRef.current;
      burst(360, 1);
      pulse.animate(
        [
          { opacity: 0.24, transform: "translate(-50%, -50%) scale(0.45)" },
          { opacity: 0, transform: "translate(-50%, -50%) scale(1.9)" },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      downRef.current = false;
      updateTarget(event.target);
      burst(320, 0.55);
    };

    const onPointerLeave = () => {
      root.dataset.hidden = "true";
    };

    const onPointerEnter = () => {
      root.dataset.hidden = "false";
    };

    const onVisibilityChange = () => {
      root.dataset.hidden = document.hidden ? "true" : "false";
      if (!document.hidden && frameRef.current === null) {
        lastTimeRef.current = performance.now();
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    const animate = (timestamp: number) => {
      if (!mountedRef.current || document.hidden) {
        frameRef.current = null;
        return;
      }

      const previousTime = lastTimeRef.current || timestamp;
      const deltaSeconds = Math.min((timestamp - previousTime) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const pointer = pointerRef.current;
      const previousPointer = previousPointerRef.current;
      const rawVx = (pointer.x - previousPointer.x) / Math.max(deltaSeconds, 0.001);
      const rawVy = (pointer.y - previousPointer.y) / Math.max(deltaSeconds, 0.001);
      previousPointerRef.current = { x: pointer.x, y: pointer.y };

      const velocityBlend = 1 - Math.exp(-14 * deltaSeconds);
      velocityRef.current.x += (rawVx - velocityRef.current.x) * velocityBlend;
      velocityRef.current.y += (rawVy - velocityRef.current.y) * velocityBlend;

      let targetX = pointer.x;
      let targetY = pointer.y;
      const rect = targetRectRef.current;
      const magnetic = modeRef.current === "interactive" && rect && !minimalRef.current;

      if (magnetic) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(centerX - pointer.x, centerY - pointer.y);
        const radius = Math.max(rect.width, rect.height) * 0.7 + 72;
        const pull = Math.max(0, 1 - distance / radius) * 0.24;
        targetX += (centerX - pointer.x) * pull;
        targetY += (centerY - pointer.y) * pull;
      }

      const speed = modeRef.current === "interactive" ? 18 : 13;
      const smoothFactor = 1 - Math.exp(-speed * deltaSeconds);
      outerPositionRef.current.x += (targetX - outerPositionRef.current.x) * smoothFactor;
      outerPositionRef.current.y += (targetY - outerPositionRef.current.y) * smoothFactor;

      const vx = velocityRef.current.x;
      const vy = velocityRef.current.y;
      const velocityMagnitude = Math.min(Math.hypot(vx, vy), 1600);
      const angle = Math.atan2(vy, vx) * 180 / Math.PI;
      const stretch = minimalRef.current ? 0 : velocityMagnitude / 1600;
      const baseScale = modeRef.current === "interactive" ? 1.32 : modeRef.current === "text" ? 0.72 : 1;
      const pressScale = downRef.current ? 0.84 : 1;
      const scaleX = baseScale * pressScale * (1 + stretch * 0.16);
      const scaleY = baseScale * pressScale * (1 - stretch * 0.08);
      const markOffset = modeRef.current === "interactive" ? 1.26 : downRef.current ? 0.72 : 1;
      const opacity = modeRef.current === "disabled" ? 0.34 : 1;

      if (timestamp < burstUntilRef.current) {
        const progress = (timestamp - burstStartRef.current) / Math.max(burstUntilRef.current - burstStartRef.current, 1);
        distortionRef.current = Math.max(0, (1 - progress) * distortionRef.current);
      } else {
        distortionRef.current = 0;
      }

      const outerTransform = minimalRef.current
        ? `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(0.01)`
        : `translate3d(${outerPositionRef.current.x}px, ${outerPositionRef.current.y}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
      outer.style.transform = outerTransform;
      outer.style.opacity = minimalRef.current || modeRef.current === "text" ? "0" : String(opacity);
      outer.style.filter = distortionRef.current > 0.02 ? "url(#premium-cursor-distortion)" : "none";
      crosshair.style.transform = `translate3d(${outerPositionRef.current.x}px, ${outerPositionRef.current.y}px, 0) translate(-50%, -50%) scale(${minimalRef.current || modeRef.current === "text" ? 0.01 : markOffset})`;
      crosshair.style.opacity = minimalRef.current || modeRef.current === "text" ? "0" : String(opacity);
      root.style.setProperty("--cursor-distortion", String(9 * distortionRef.current));

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerenter", onPointerEnter);
    document.addEventListener("visibilitychange", onVisibilityChange);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      mountedRef.current = false;
      enabledRef.current = false;
      document.documentElement.classList.remove("custom-cursor-ready");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerenter", onPointerEnter);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return null;
  }

  return (
    <div ref={rootRef} className="premium-cursor" data-hidden="false" aria-hidden="true">
      <svg className="premium-cursor-filter" width="0" height="0" focusable="false">
        <filter id="premium-cursor-distortion">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.08" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="var(--cursor-distortion)" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div ref={outerRef} className="premium-cursor-outer" />
      <div ref={crosshairRef} className="premium-cursor-crosshair">
        <span className="mark top" />
        <span className="mark right" />
        <span className="mark bottom" />
        <span className="mark left" />
      </div>
      <div ref={pulseRef} className="premium-cursor-pulse" />
      <div ref={dotRef} className="premium-cursor-dot" />
    </div>
  );
}
