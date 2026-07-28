import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CubePreviewCapture from "./components/cube/CubePreviewCapture";
import { AuthProvider } from "./features/auth/AuthContext";
import "./styles/global.css";

const Root = import.meta.env.DEV && window.location.pathname === "/__cube-preview-capture"
  ? <CubePreviewCapture />
  : (
    <AuthProvider>
      <App />
    </AuthProvider>
  );

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {Root}
  </React.StrictMode>,
);
