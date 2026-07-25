import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import AppBackground from "../../components/AppBackground";
import { audioManager } from "../../utils/audioManager";

interface IdentityScreenProps {
  onGuest: () => void;
  onGoogle: () => void;
}

function AnimatedCube() {
  const faceSize = 18;
  const gap = 1.5;
  const cubeSize = faceSize * 3 + gap * 2;

  return (
    <div className="identity-cube-scene">
      <motion.div
        className="identity-cube"
        animate={{ rotateX: [20, 380], rotateY: [0, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{
          width: cubeSize,
          height: cubeSize,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        {[
          { color: "#22c55e", transform: `translateZ(${cubeSize / 2}px)` },
          { color: "#3b82f6", transform: `rotateY(180deg) translateZ(${cubeSize / 2}px)` },
          { color: "#ef4444", transform: `rotateY(90deg) translateZ(${cubeSize / 2}px)` },
          { color: "#f97316", transform: `rotateY(-90deg) translateZ(${cubeSize / 2}px)` },
          { color: "#f8fafc", transform: `rotateX(90deg) translateZ(${cubeSize / 2}px)` },
          { color: "#facc15", transform: `rotateX(-90deg) translateZ(${cubeSize / 2}px)` },
        ].map((face, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: cubeSize,
              height: cubeSize,
              transform: face.transform,
              display: "grid",
              gridTemplateColumns: `repeat(3, ${faceSize}px)`,
              gridTemplateRows: `repeat(3, ${faceSize}px)`,
              gap,
              backfaceVisibility: "hidden",
            }}
          >
            {Array.from({ length: 9 }).map((_, j) => (
              <div
                key={j}
                style={{
                  width: faceSize,
                  height: faceSize,
                  borderRadius: 2.5,
                  background: face.color,
                  opacity: 0.82 + (j % 3) * 0.06,
                }}
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function IdentityScreen({ onGuest, onGoogle }: IdentityScreenProps) {
  return (
    <motion.section
      className="identity-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <AppBackground />

      <motion.div
        className="identity-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatedCube />

        <div className="identity-brand">
          <img
            className="identity-logo"
            src="/logos/CubeRankedLogosFull.png"
            alt="CubeRanked"
          />
          <p className="identity-tagline">The competitive speedcubing platform</p>
        </div>

        <div className="identity-actions">
          <button
            type="button"
            className="identity-google-btn"
            onClick={() => { audioManager.playButtonClick(); onGoogle(); }}
            onMouseEnter={() => audioManager.playButtonHover()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            className="identity-guest-btn"
            onClick={() => { audioManager.playButtonClick(); onGuest(); }}
            onMouseEnter={() => audioManager.playButtonHover()}
          >
            <LogIn size={16} aria-hidden="true" />
            Continue as Guest
          </button>
        </div>

        <p className="identity-legal">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </motion.section>
  );
}
