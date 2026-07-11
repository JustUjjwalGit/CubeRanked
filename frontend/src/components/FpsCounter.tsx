import { useEffect, useRef, useState } from "react";

export default function FpsCounter() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    let interval: ReturnType<typeof setInterval>;

    const tick = () => {
      frameCount.current += 1;
      raf = requestAnimationFrame(tick);
    };

    interval = setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTime.current) / 1000;
      setFps(Math.round(frameCount.current / delta));
      frameCount.current = 0;
      lastTime.current = now;
    }, 1000);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  return (
    <span className="fps-counter">
      FPS: {fps}
    </span>
  );
}
