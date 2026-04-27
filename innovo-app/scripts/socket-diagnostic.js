const { io } = require("socket.io-client");

const normalizeSocketUrl = (rawUrl) => {
  const trimmedUrl = String(rawUrl || "").trim().replace(/\/+$/, "");

  if (trimmedUrl.endsWith("/socket.io")) {
    const normalizedUrl = trimmedUrl.slice(0, -"/socket.io".length);
    console.warn("SOCKET_TEST_URL debe ser la URL base. Usando:", normalizedUrl);
    return normalizedUrl;
  }

  return trimmedUrl || "https://api.innovoservicios.cl";
};

const url = normalizeSocketUrl(
  process.env.SOCKET_TEST_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "https://api.innovoservicios.cl"
);
const token = process.env.SOCKET_TEST_TOKEN || process.argv[2];

if (!token) {
  console.error("Falta token. Usa: SOCKET_TEST_TOKEN=<token> bun run socket:diagnose");
  process.exit(1);
}

console.log("Probando Socket.IO", {
  url,
  hasToken: Boolean(token),
  tokenLength: token.length,
});

const socket = io(url, {
  transports: ["websocket"],
  auth: { token },
  reconnection: false,
  timeout: 10000,
});


const finish = (code) => {
  socket.disconnect();
  process.exit(code);
};

socket.on("connect", () => {
  console.log("Socket.IO conectado", {
    id: socket.id,
    transport: socket.io.engine.transport.name,
  });
  finish(0);
});

socket.on("connect_error", (error) => {
  console.warn("Socket.IO connect_error", {
    message: error.message,
    description: error.description,
    context: error.context,
  });
  finish(2);
});

setTimeout(() => {
  console.warn("Timeout esperando conexion Socket.IO");
  finish(3);
}, 12000);
