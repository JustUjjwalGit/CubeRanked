import { AnimatePresence, motion } from "framer-motion";

export default function CountdownOverlay({ value }: { value: string }) {
  const isGo = value === "GO";
  const isRed = value === "3";
  const isOrange = value === "2";
  const isGreen = value === "1" || isGo;

  return (
    <motion.div
      className="countdown-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, backgroundColor: isGo ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.55)" }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="countdown-radial-glow"
        animate={{
          opacity: isGo ? 0.3 : 0.7,
          background: isRed
            ? "radial-gradient(circle at 50% 50%, rgba(239,68,68,0.4), transparent 60%)"
            : isOrange
            ? "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.4), transparent 60%)"
            : "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.4), transparent 60%)"
        }}
        transition={{ duration: 0.3 }}
      />

      <div className="traffic-light-housing">
        <div className={`traffic-light-bulb red ${isRed ? "active" : ""}`} />
        <div className={`traffic-light-bulb orange ${isOrange ? "active" : ""}`} />
        <div className={`traffic-light-bulb green ${isGreen ? "active" : ""}`} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          className={`countdown-digit ${isGo ? "is-go" : value === "3" ? "is-red" : value === "2" ? "is-orange" : "is-green"}`}
          initial={{ scale: 0.5, opacity: 0, y: 32, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ scale: 1.3, opacity: 0, y: -24, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
