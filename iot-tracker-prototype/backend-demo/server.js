const http = require("node:http");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 4000);
const MAX_BODY_BYTES = 16 * 1024;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "tracking-demo-backend" });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/api/tracking/update") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
    sendJson(res, 415, { ok: false, error: "Content-Type must be application/json" });
    return;
  }

  let body = "";
  try {
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        sendJson(res, 413, { ok: false, error: "Request body is too large" });
        return;
      }
      body += chunk.toString("utf8");
    }
  } catch (error) {
    console.error("Could not read request body:", error);
    sendJson(res, 400, { ok: false, error: "Could not read request body" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    sendJson(res, 400, { ok: false, error: "Request body must be valid JSON" });
    return;
  }

  const { taskId, providerId, lat, lng, timestamp } = payload || {};
  const validTimestamp = typeof timestamp === "string" || typeof timestamp === "number";
  if (!Number.isInteger(taskId) || taskId < 1 ||
    !Number.isInteger(providerId) || providerId < 1 ||
    typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180 ||
    !validTimestamp || !Number.isFinite(new Date(timestamp).getTime())) {
    sendJson(res, 400, {
      ok: false,
      error: "Expected positive integer taskId/providerId, valid numeric lat/lng, and a valid timestamp",
    });
    return;
  }

  const location = {
    taskId,
    providerId,
    lat,
    lng,
    timestamp: new Date(timestamp).toISOString(),
  };

  console.log(
    `[${location.timestamp}] task=${taskId} provider=${providerId} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)}`
  );
  io.emit("location:update", location);
  sendJson(res, 200, { ok: true, location });
});

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);
  socket.on("disconnect", (reason) => {
    console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);
  });
});

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracking demo backend listening on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log("Socket.IO event: location:update");
});

function shutdown() {
  io.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
