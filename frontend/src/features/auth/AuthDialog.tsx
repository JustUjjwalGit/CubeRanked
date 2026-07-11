import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type AuthModal = "none" | "login" | "register" | "profile";

const inputClass = "auth-input-new";

export default function AuthDialog({
  mode,
  error,
  onClose,
  onMode,
  onGuest,
  onLogin,
  onRegister,
  onOAuth,
}: {
  mode: "login" | "register";
  error: string | null;
  onClose: () => void;
  onMode: (mode: AuthModal) => void;
  onGuest: () => void;
  onLogin: (input: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  onRegister: (input: { username: string; email: string; password: string; rememberMe: boolean }) => Promise<void>;
  onOAuth: (provider: "google" | "github" | "discord") => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (isRegister) {
        await onRegister({ username, email, password, rememberMe });
      } else {
        await onLogin({ email, password, rememberMe });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "grid", placeItems: "center" }}
    >
      <motion.div
        className="auth-dialog-new"
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
      >
        {/* Header */}
        <div className="auth-header-new">
          <img src="/logos/CubeRankedLogosFull.png" alt="CubeRanked" style={{ height: "28px", objectFit: "contain" }} />
          <button type="button" className="auth-close-new" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <h2 className="auth-title-new">{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p className="auth-subtitle-new">
          {isRegister ? "Join the competitive speedcubing arena." : "Sign in to continue your climb."}
        </p>

        {/* Google Button — Primary */}
        <button
          type="button"
          className="auth-google-btn-new"
          onClick={() => onOAuth("google")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" opacity=".9" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity=".9" />
            <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#fff" opacity=".9" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#fff" opacity=".9" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="auth-divider-new">
          <span />
          <span>or</span>
          <span />
        </div>

        {/* Email Form */}
        <form className="auth-form-new" onSubmit={submit}>
          {isRegister ? (
            <div className="auth-field-new">
              <label htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                placeholder="Enter username"
              />
            </div>
          ) : null}
          <div className="auth-field-new">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="Enter email"
            />
          </div>
          <div className="auth-field-new">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password-wrap">
              <input
                id="auth-password"
                className={inputClass}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                minLength={isRegister ? 8 : 1}
                placeholder="Enter password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <label className="auth-remember-new">
            <div className="auth-checkbox-new">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="auth-checkbox-check" />
            </div>
            <span>Remember me</span>
          </label>

          <AnimatePresence>
            {error ? (
              <motion.div
                className="auth-error-new"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button type="submit" className="auth-submit-new" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="auth-spinner" />
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="auth-footer-new">
          <button type="button" onClick={() => onMode(isRegister ? "login" : "register")}>
            {isRegister ? "Already have an account?" : "Need an account?"}
          </button>
          <span className="auth-dot">·</span>
          <button type="button" onClick={onGuest}>
            Continue as Guest
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
