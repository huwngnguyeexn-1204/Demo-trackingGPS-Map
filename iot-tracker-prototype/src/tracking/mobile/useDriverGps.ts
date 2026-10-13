import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { sendTrackingLocation } from "./trackingApi";
import type { Point } from "./types";

type UseDriverGpsOptions = {
  apiUrl: string;
  taskId: number;
  providerId: number;
  intervalMs?: number;
};

export function useDriverGps({
  apiUrl,
  taskId,
  providerId,
  intervalMs = 5000,
}: UseDriverGpsOptions) {
  const [location, setLocation] = useState<Point | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestLocationRef = useRef<Point | null>(null);
  const sendInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);

  const stop = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    latestLocationRef.current = null;
    setIsTracking(false);
  }, []);

  const start = useCallback(async () => {
    if (watchRef.current || startInFlightRef.current) return;
    startInFlightRef.current = true;
    setIsStarting(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission was not granted");
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const first = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      latestLocationRef.current = first;
      setLocation(first);
      await sendTrackingLocation(apiUrl, {
        taskId,
        providerId,
        lat: first.latitude,
        lng: first.longitude,
        timestamp: new Date().toISOString(),
      });
      setLastSentAt(Date.now());

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (position) => {
          const point = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          latestLocationRef.current = point;
          setLocation(point);
        },
      );

      timerRef.current = setInterval(async () => {
        // Keep only one request in flight while sending the latest sampled position.
        const point = latestLocationRef.current;
        if (!point || sendInFlightRef.current || !watchRef.current) return;
        sendInFlightRef.current = true;
        try {
          await sendTrackingLocation(apiUrl, {
            taskId,
            providerId,
            lat: point.latitude,
            lng: point.longitude,
            timestamp: new Date().toISOString(),
          });
          setLastSentAt(Date.now());
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to send location to the backend");
        } finally {
          sendInFlightRef.current = false;
        }
      }, intervalMs);
      setIsTracking(true);
    } catch (e) {
      stop();
      const message = e instanceof Error ? e.message : "Failed to start GPS tracking";
      setError(message);
      throw e;
    } finally {
      startInFlightRef.current = false;
      setIsStarting(false);
    }
  }, [apiUrl, intervalMs, providerId, stop, taskId]);

  useEffect(() => stop, [stop]);

  return { location, isStarting, isTracking, lastSentAt, error, start, stop };
}
