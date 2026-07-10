import { motion } from "framer-motion";
import { type RankInfo } from "../lib/ranks";

export default function RankPromotionAnimation({
  rank,
  isPromotion,
  onComplete,
}: {
  rank: RankInfo;
  isPromotion: boolean;
  onComplete: () => void;
}) {
  return (
    <motion.div
      className="modal-backdrop promotion-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
      style={{
        zIndex: 9999,
        background: `radial-gradient(circle at center, ${rank.color}22 0%, rgba(3,5,10,0.95) 70%)`
      }}
    >
      <motion.div
        className="promotion-content"
        initial={{ scale: 0.5, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}
      >
        <motion.div 
          className="promotion-badge"
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 15, delay: 0.4 }}
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            border: `4px solid ${rank.color}`,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3rem",
            fontWeight: 800,
            color: rank.color,
            boxShadow: `0 0 60px ${rank.color}66, inset 0 0 30px ${rank.color}44`,
            textShadow: `0 2px 10px rgba(0,0,0,0.5)`,
          }}
        >
          {rank.badge}
        </motion.div>
        
        <div style={{ textAlign: "center" }}>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{ 
              fontSize: "2.5rem", 
              margin: "0 0 8px 0", 
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#fff"
            }}
          >
            {isPromotion ? "Promoted!" : "Demoted"}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            style={{
              fontSize: "1.2rem",
              margin: 0,
              color: rank.color,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            {isPromotion ? `Welcome to ${rank.tier}` : `Fallen to ${rank.tier}`}
          </motion.p>
        </div>
        
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="primary"
          onClick={onComplete}
          style={{
            marginTop: "20px",
            background: rank.color,
            boxShadow: `0 4px 20px ${rank.color}44`
          }}
        >
          Continue
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
