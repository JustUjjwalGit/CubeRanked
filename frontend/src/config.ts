const BACKEND_HOST = window.location.host;

const API_URL = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, "")}/api/v1`
  : "/api/v1";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  ? import.meta.env.VITE_SOCKET_URL
  : `${window.location.origin}/v1`;

export { BACKEND_HOST, API_URL, SOCKET_URL };
