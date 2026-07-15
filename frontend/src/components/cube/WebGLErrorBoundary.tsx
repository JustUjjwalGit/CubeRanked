import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null | undefined;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack });
    console.error("[WebGLErrorBoundary] Canvas error:", error, info.componentStack);
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
            height: "100%",
            minHeight: "200px",
            background: "rgba(7, 11, 18, 0.6)",
            color: "#a1a1aa",
            fontFamily: "monospace",
            padding: "24px",
            textAlign: "center",
            gap: "12px",
            borderRadius: "12px",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#ef4444" }}>
            3D Renderer Error
          </div>
          <p style={{ fontSize: "13px", color: "#a1a1aa", maxWidth: "480px", lineHeight: 1.5, margin: 0 }}>
            {this.state.error.message}
          </p>
          <pre
            style={{
              fontSize: "11px",
              color: "#71717a",
              maxWidth: "480px",
              overflow: "auto",
              background: "#18181b",
              padding: "8px",
              borderRadius: "6px",
              textAlign: "left",
              maxHeight: "150px",
              margin: 0,
            }}
          >
            {this.state.info ?? this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
