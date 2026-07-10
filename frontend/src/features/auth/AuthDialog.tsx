import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { UserPlus, LogIn, X } from "lucide-react";

type AuthModal = "none" | "login" | "register" | "profile";

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
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="auth-dialog"
        onSubmit={submit}
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Account</span>
            <h2>{isRegister ? "Create Account" : "Login"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close account dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="auth-fields">
          {isRegister ? (
            <label>
              <span>Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required minLength={3} />
            </label>
          ) : null}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 8 : 1} />
          </label>
          <label className="switch-row compact">
            <span>Remember Me</span>
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
          </label>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {isRegister ? <UserPlus size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
          {busy ? "Working..." : isRegister ? "Register" : "Login"}
        </button>

        <div className="oauth-row">
          <button type="button" onClick={() => onOAuth("google")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>

        <div className="auth-switch">
          <button type="button" onClick={() => onMode(isRegister ? "login" : "register")}>
            {isRegister ? "Already have an account?" : "Need an account?"}
          </button>
          <button type="button" onClick={onGuest}>Continue as Guest</button>
        </div>
      </motion.form>
    </motion.div>
  );
}
