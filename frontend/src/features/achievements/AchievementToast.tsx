import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type { AchievementRarity } from "./achievement.types";

export interface ToastAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  category: string;
}

interface AchievementToastProps {
  queue: ToastAchievement[];
  onDismiss: (id: string) => void;
}

const ICON_MAP: Record<string, string> = {
  cube: "🧊", stopwatch: "⏱️", lightning: "⚡", bolt: "⚡",
  "cube-stack": "📦", layers: "📚", zap: "⚡", flame: "🔥",
  "gold-bolt": "⚡", trophy: "🏆", "fire-trophy": "🔥",
  "bronze-medal": "🥉", "silver-medal": "🥈", "gold-medal": "🥇",
  "user-plus": "➕", handshake: "🤝", eye: "👁️",
  cake: "🎂", moon: "🌙", phoenix: "🦅", google: "G",
};

export function AchievementToast({ queue, onDismiss }: AchievementToastProps) {
  const [active, setActive] = useState<ToastAchievement | null>(null);

  const dismiss = useCallback(() => {
    if (active) {
      onDismiss(active.id);
      setActive(null);
    }
  }, [active, onDismiss]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const next = queue[0];
    setActive(next);
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [queue, active, dismiss]);

  return (
    <div className="ach-toast-container">
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key={active.id}
            className={`ach-toast rarity-${active.rarity}`}
            initial={{ x: 360, opacity: 0, rotate: -2 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: 360, opacity: 0, rotate: 2 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="ach-toast-glow" />
            <div className="ach-toast-icon">
              {ICON_MAP[active.icon] ?? "★"}
            </div>
            <div className="ach-toast-body">
              <span className="ach-toast-label">Advancement Made!</span>
              <strong className="ach-toast-name">{active.name}</strong>
              <span className="ach-toast-desc">{active.description}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
