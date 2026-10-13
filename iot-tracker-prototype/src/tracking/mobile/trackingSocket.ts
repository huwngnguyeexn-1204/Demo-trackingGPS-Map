import { io } from "socket.io-client";
import type { LocationUpdate, Point } from "./types";

type TrackingSocketHandlers = {
  onConnectionChange: (connected: boolean) => void;
  onConnectionError: (message: string) => void;
  onLocation: (location: LocationUpdate, point: Point) => void;
};

export function subscribeToTaskLocations(
  socketUrl: string,
  taskId: number,
  handlers: TrackingSocketHandlers,
) {
  const socket = io(socketUrl, { timeout: 5000, reconnection: true });
  socket.on("connect", () => handlers.onConnectionChange(true));
  socket.on("disconnect", () => handlers.onConnectionChange(false));
  socket.on("connect_error", (error) => {
    handlers.onConnectionChange(false);
    handlers.onConnectionError(error.message);
  });
  socket.on("location:update", (payload: LocationUpdate) => {
    // Ignore updates for other tasks and reject coordinates outside valid ranges.
    if (Number(payload.taskId) !== taskId) return;
    const point = { latitude: Number(payload.lat), longitude: Number(payload.lng) };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return;
    handlers.onLocation(payload, point);
  });

  return () => {
    socket.disconnect();
  };
}
