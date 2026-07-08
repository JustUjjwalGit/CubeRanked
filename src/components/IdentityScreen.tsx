import { motion } from "framer-motion";
import { LogIn, User } from "lucide-react";
import AppBackground from "./AppBackground";

interface IdentityScreenProps {
  onGuest: () => void;
  onGoogle: () => void;
  onEmail: () => void;
}

export default function IdentityScreen({ onGuest, onGoogle, onEmail }: IdentityScreenProps) {
  return (
    <motion.section
      className="identity-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <AppBackground />

      <img
        className="identity-logo"
        src="/logos/CubeRankedLogosFull.png"
        alt="CubeRanked"
      />

      <p className="identity-tagline">The competitive speedcubing platform</p>

      <div className="identity-cards">
        {/* Primary: Guest */}
        <button type="button" className="identity-card primary" onClick={onGuest}>
          <div className="identity-card-icon">
            <User size={22} />
          </div>
          <div className="identity-card-text">
            <strong>Continue as Guest</strong>
            <span>Jump in immediately. No account needed.</span>
          </div>
        </button>

        {/* Google OAuth */}
        <button type="button" className="identity-card" onClick={onGoogle}>
          <div className="identity-card-icon">
            {/* Google "G" SVG mark */}
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          </div>
          <div className="identity-card-text">
            <strong>Continue with Google</strong>
            <span>Sign in with your Google account.</span>
          </div>
        </button>

        {/* Email */}
        <button type="button" className="identity-card" onClick={onEmail}>
          <div className="identity-card-icon">
            <LogIn size={22} />
          </div>
          <div className="identity-card-text">
            <strong>Sign In / Create Account</strong>
            <span>Use email and password.</span>
          </div>
        </button>
      </div>

      <p className="identity-footer-note">
        Guest mode includes Practice, Bot Race, and Private Rooms.
        <br />
        Create an account to unlock Ranked and leaderboards.
      </p>
    </motion.section>
  );
}
