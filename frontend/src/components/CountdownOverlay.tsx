import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function CountdownOverlay({ value }: { value: string }) {
  const digitRef = useRef<HTMLDivElement>(null);
  const isGo = value === "GO";
  const isRed = value === "3";
  const isOrange = value === "2";
  const isGreen = value === "1" || isGo;

  const glowColor = isRed
    ? "rgba(239,68,68,0.4)"
    : isOrange
    ? "rgba(245,158,11,0.4)"
    : "rgba(16,185,129,0.4)";

  useEffect(() => {
    const digit = digitRef.current;
    if (!digit) return;

    const animation = digit.animate(
      [
        { opacity: 0, transform: "scale(0.82) translateY(10px)" },
        { opacity: 1, transform: "scale(1) translateY(0)", offset: 0.24 },
        { opacity: 1, transform: "scale(1) translateY(0)", offset: 0.72 },
        { opacity: 0, transform: "scale(1.08) translateY(-8px)" },
      ],
      {
        duration: isGo ? 520 : 780,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "both",
      },
    );

    return () => animation.cancel();
  }, [isGo, value]);

  return (
    <motion.div
      className="countdown-overlay"
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        backgroundColor: isGo ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.55)",
      }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="countdown-radial-glow"
        animate={{
          opacity: isGo ? 0.2 : 0.6,
          background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 60%)`,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      <div className="traffic-light-housing">
        <motion.div
          className="traffic-light-bulb red"
          animate={isRed ? {
            background: "radial-gradient(circle at 35% 35%, #ff8787 0%, #ef4444 60%, #7f1d1d 100%)",
            borderColor: "#fca5a5",
            boxShadow: "0 0 20px rgba(239,68,68,0.85), 0 0 40px rgba(239,68,68,0.45), inset 0 2px 2px rgba(255,255,255,0.4)",
          } : {
            background: "#090d16",
            borderColor: "rgba(239,68,68,0.15)",
            boxShadow: "inset 0 4px 6px rgba(0,0,0,0.8), inset 0 -2px 3px rgba(255,255,255,0.05)",
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
        <motion.div
          className="traffic-light-bulb orange"
          animate={isOrange ? {
            background: "radial-gradient(circle at 35% 35%, #ffe066 0%, #f59e0b 60%, #78350f 100%)",
            borderColor: "#fef08a",
            boxShadow: "0 0 20px rgba(245,158,11,0.85), 0 0 40px rgba(245,158,11,0.45), inset 0 2px 2px rgba(255,255,255,0.4)",
          } : {
            background: "#090d16",
            borderColor: "rgba(245,158,11,0.15)",
            boxShadow: "inset 0 4px 6px rgba(0,0,0,0.8), inset 0 -2px 3px rgba(255,255,255,0.05)",
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
        <motion.div
          className="traffic-light-bulb green"
          animate={isGreen ? {
            background: "radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 60%, #064e3b 100%)",
            borderColor: "#a7f3d0",
            boxShadow: "0 0 20px rgba(16,185,129,0.85), 0 0 40px rgba(16,185,129,0.45), inset 0 2px 2px rgba(255,255,255,0.4)",
          } : {
            background: "#090d16",
            borderColor: "rgba(16,185,129,0.15)",
            boxShadow: "inset 0 4px 6px rgba(0,0,0,0.8), inset 0 -2px 3px rgba(255,255,255,0.05)",
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      </div>

      <div
        ref={digitRef}
        className={`countdown-digit ${isGo ? "is-go" : isRed ? "is-red" : isOrange ? "is-orange" : "is-green"}`}
      >
        {value}
      </div>
    </motion.div>
  );
}
