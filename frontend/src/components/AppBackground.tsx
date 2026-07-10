import React, { useEffect, useState } from "react";

export default function AppBackground() {
  const [particles, setParticles] = useState<Array<{ id: number; left: string; size: string; delay: string; duration: string }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 6 + 3}px`,
      delay: `${Math.random() * -15}s`,
      duration: `${Math.random() * 20 + 20}s`,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="home-bg">
      <div className="home-noise" />
      <div className="client-grid" />
      <div className="light-streaks" />
      <div className="glow-blob-1" />
      <div className="glow-blob-2" />
      <div className="particles-container">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>
    </div>
  );
}
