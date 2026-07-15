const BACKEND_HOST = window.location.hostname;

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : `http://${BACKEND_HOST}:4000/api/v1`;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  ? import.meta.env.VITE_SOCKET_URL
  : `http://${BACKEND_HOST}:4000/v1`;

console.log("window.location.hostname =", BACKEND_HOST);
console.log("API_URL =", API_URL);
console.log("SOCKET_URL =", SOCKET_URL);

export { BACKEND_HOST, API_URL, SOCKET_URL };
