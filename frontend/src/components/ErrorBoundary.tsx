import { Component, type ErrorInfo, type ReactNode } from "react";
import { API_URL, SOCKET_URL, BACKEND_HOST } from "../config";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack });
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#09090b",
            color: "#f4f4f5",
            fontFamily: "monospace",
            padding: "24px",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
            CubeRanked — Initialization Error
          </h1>
          <p style={{ fontSize: "14px", color: "#a1a1aa", maxWidth: "520px", lineHeight: 1.5 }}>
            {this.state.error.message}
          </p>
          <pre
            style={{
              fontSize: "12px",
              color: "#71717a",
              maxWidth: "640px",
              overflow: "auto",
              background: "#18181b",
              padding: "12px",
              borderRadius: "8px",
              textAlign: "left",
              maxHeight: "300px",
            }}
          >
            {this.state.info ?? this.state.error.stack}
          </pre>
          <div style={{ fontSize: "12px", color: "#52525b", maxWidth: "520px" }}>
            <div>hostname: {BACKEND_HOST}</div>
            <div>API: {API_URL}</div>
            <div>Socket: {SOCKET_URL}</div>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: "10px",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              background: "rgba(99, 102, 241, 0.1)",
              color: "#818cf8",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
