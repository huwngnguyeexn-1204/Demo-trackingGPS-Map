import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from "react-native";
import * as Location from "expo-location";
import TrackingMap from "../TrackingMap";
import { sendTrackingLocation } from "../trackingApi";
import { subscribeToTaskLocations } from "../trackingSocket";
import { useDriverGps } from "../useDriverGps";
import type { Point, RoadRoute } from "../types";
import {
  DEMO_API_URL, DEMO_CUSTOMER, DEMO_PROVIDER_ID, DEMO_SOCKET_URL, DEMO_TASK_ID,
} from "./demoConfig";

type OsrmRouteResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
};

function distanceKm(a: Point, b: Point) {
  const rad = (x: number) => x * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function sampleRoute(route: Point[], steps: number) {
  // Space demo positions by distance so movement follows the road geometry evenly.
  const segmentLengths = route.slice(1).map((point, index) => distanceKm(route[index], point));
  const totalDistance = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalDistance === 0) return Array.from({ length: steps + 1 }, () => route[0]);

  const samples: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    let remaining = totalDistance * step / steps;
    let segmentIndex = 0;
    while (segmentIndex < segmentLengths.length - 1 && remaining > segmentLengths[segmentIndex]) {
      remaining -= segmentLengths[segmentIndex];
      segmentIndex += 1;
    }
    const start = route[segmentIndex];
    const end = route[segmentIndex + 1];
    const length = segmentLengths[segmentIndex];
    const fraction = length === 0 ? 0 : Math.min(1, remaining / length);
    samples.push({
      latitude: start.latitude + (end.latitude - start.latitude) * fraction,
      longitude: start.longitude + (end.longitude - start.longitude) * fraction,
    });
  }
  return samples;
}

export default function TrackingDemoScreen() {
  const [mode, setMode] = useState<"customer" | "driver">("customer");
  const [driver, setDriver] = useState<Point | null>(null);
  const [status, setStatus] = useState("Ready to test");
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("No updates yet");
  const [demoRunning, setDemoRunning] = useState(false);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoStepRef = useRef(0);
  const routeRef = useRef<RoadRoute | null>(null);
  const lastRouteRequestRef = useRef<{ point: Point; at: number } | null>(null);
  const routeRequestIdRef = useRef(0);
  const gps = useDriverGps({
    apiUrl: DEMO_API_URL,
    taskId: DEMO_TASK_ID,
    providerId: DEMO_PROVIDER_ID,
  });

  useEffect(() => {
    if (!gps.location) return;
    setDriver(gps.location);
    void refreshRoadRoute(gps.location);
  }, [gps.location]);

  useEffect(() => {
    if (gps.lastSentAt) setLastUpdate(new Date(gps.lastSentAt).toLocaleTimeString());
  }, [gps.lastSentAt]);

  useEffect(() => {
    if (gps.error) setStatus(gps.error);
  }, [gps.error]);

  async function refreshRoadRoute(origin: Point, force = false) {
    const lastRequest = lastRouteRequestRef.current;
    if (!force && lastRequest &&
      distanceKm(lastRequest.point, origin) < 0.2 &&
      Date.now() - lastRequest.at < 30_000) return routeRef.current;

    const requestId = ++routeRequestIdRef.current;
    lastRouteRequestRef.current = { point: origin, at: Date.now() };
    setRouteLoading(true);
    setRouteError("");
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${DEMO_CUSTOMER.longitude},${DEMO_CUSTOMER.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM returned ${response.status}`);
      const result = await response.json() as OsrmRouteResponse;
      const route = result.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (!route || result.code !== "Ok" || !Array.isArray(coordinates) || coordinates.length < 2 ||
        !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
        throw new Error("No suitable driving route found");
      }
      if (!coordinates.every(([longitude, latitude]) =>
        Number.isFinite(longitude) && Number.isFinite(latitude) &&
        Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90)) {
        throw new Error("OSRM returned invalid route coordinates");
      }
      const nextRoute: RoadRoute = {
        coordinates: coordinates.map(([longitude, latitude]: [number, number]) => ({
          latitude,
          longitude,
        })),
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
      };
      if (requestId !== routeRequestIdRef.current) return routeRef.current;
      routeRef.current = nextRoute;
      setRoadRoute(nextRoute);
      return nextRoute;
    } catch (e) {
      if (requestId === routeRequestIdRef.current) {
        setRouteError(e instanceof Error ? e.message : "Failed to load the route");
      }
      return null;
    } finally {
      if (requestId === routeRequestIdRef.current) setRouteLoading(false);
    }
  }

  useEffect(() => {
    return subscribeToTaskLocations(DEMO_SOCKET_URL, DEMO_TASK_ID, {
      onConnectionChange: setConnected,
      onConnectionError: (message) => {
        setStatus(`Socket.IO is not connected (${DEMO_SOCKET_URL}): ${message}`);
      },
      onLocation: (payload, point) => {
        setDriver(point);
        const timestamp = new Date(payload.timestamp || Date.now());
        setLastUpdate(Number.isNaN(timestamp.getTime()) ? "Just updated" : timestamp.toLocaleTimeString());
        setStatus("Receiving driver location through Socket.IO");
        void refreshRoadRoute(point);
      },
    });
  }, []);

  async function sendLocation(point: Point) {
    await sendTrackingLocation(DEMO_API_URL, {
      taskId: DEMO_TASK_ID,
      providerId: DEMO_PROVIDER_ID,
      lat: point.latitude,
      lng: point.longitude,
      timestamp: new Date().toISOString(),
    });
  }

  function stopGps() {
    gps.stop();
    setStatus("GPS sharing stopped");
  }

  useEffect(() => {
    return () => {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    };
  }, []);

  async function startGps() {
    try {
      await gps.start();
      setMode("driver");
      setStatus("GPS enabled; the first location was sent, with updates every 5 seconds");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start GPS tracking";
      setStatus(message);
      if (message === "Location permission was not granted") {
        Alert.alert("Location permission required", "Allow the app to access your location while you are using it.");
      }
    }
  }

  async function startDemo(publishToBackend = false) {
    if (gps.isTracking) gps.stop();
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    setStatus("Getting the device's current location…");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("Location permission is required to start the demo");
        Alert.alert("Location permission required", "Allow location access to use the device's GPS as the demo starting point.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const origin = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setDriver(origin);
      const route = await refreshRoadRoute(origin, true);
      if (!route || route.coordinates.length < 2) {
        setStatus("Cannot start the demo because the route could not be loaded");
        return;
      }
      setMode("customer");
      setDemoRunning(true);
      setStatus(publishToBackend
        ? "Demo from the device's GPS location: sending positions to the backend for Socket.IO broadcasts"
        : "Demo from the device's GPS location: the simulated driver is following the route");
      demoStepRef.current = 0;
      const steps = 24;
      const samples = sampleRoute(route.coordinates, steps);
      demoTimerRef.current = setInterval(() => {
        demoStepRef.current += 1;
        const point = samples[Math.min(demoStepRef.current, steps)];
        setDriver(point);
        setLastUpdate(new Date().toLocaleTimeString());
        if (publishToBackend && demoStepRef.current % 3 === 0) {
          void sendLocation(point).catch((e) => {
            if (demoTimerRef.current) clearInterval(demoTimerRef.current);
            demoTimerRef.current = null;
            setDemoRunning(false);
            setStatus(e instanceof Error ? e.message : "Failed to send the demo location to the backend");
          });
        }
        if (demoStepRef.current >= steps) {
          if (demoTimerRef.current) clearInterval(demoTimerRef.current);
          demoTimerRef.current = null;
          setDemoRunning(false);
          setStatus(publishToBackend
            ? "The demo driver reached point A; the final location may have been sent to the backend"
            : "The driver reached point A (demo)");
        }
      }, 1000);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not get the device's current location");
    }
  }

  function stopDemo() {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
    setDemoRunning(false);
    setStatus("Demo stopped");
  }

  function switchMode(next: "customer" | "driver") {
    if (next !== mode) {
      stopDemo();
      if (gps.isTracking) {
        gps.stop();
        setStatus("GPS sharing stopped");
      }
      setMode(next);
      setStatus(next === "driver" ? "Driver mode: enable GPS to share your location" : "Customer mode: tracking the task");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Driver Tracking</Text>
          <Text style={styles.subtitle}>Project B · IoT real-time tracking</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeButton, mode === "customer" && styles.modeActive]} onPress={() => switchMode("customer")}>
            <Text style={[styles.modeText, mode === "customer" && styles.modeTextActive]}>A · Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, mode === "driver" && styles.modeActive]} onPress={() => switchMode("driver")}>
            <Text style={[styles.modeText, mode === "driver" && styles.modeTextActive]}>B · Driver</Text>
          </TouchableOpacity>
        </View>

        <TrackingMap
          customerLocation={DEMO_CUSTOMER}
          driverLocation={driver}
          routeCoordinates={roadRoute?.coordinates}
          showUserLocation={mode === "driver"}
        />

        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <View>
              <Text style={styles.cardTitle}>{mode === "customer" ? "Driver on the way" : "Share your location"}</Text>
              <Text style={styles.muted}>Task #{DEMO_TASK_ID} · Provider #{DEMO_PROVIDER_ID}</Text>
            </View>
            <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{roadRoute ? `${roadRoute.distanceKm.toFixed(1)} km` : "--"}</Text>
              <Text style={styles.muted}>Road distance</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{roadRoute ? `~${Math.max(1, Math.round(roadRoute.durationMinutes))} min` : "--"}</Text>
              <Text style={styles.muted}>OSRM ETA, no traffic data</Text>
            </View>
          </View>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.muted}>
            {routeLoading
              ? "Loading route…"
              : routeError
                ? `Route: ${routeError}`
                : roadRoute
                  ? "Route follows the road network"
                  : "Waiting for the driver's GPS location"}
          </Text>
          <Text style={styles.muted}>
            {driver
              ? `Driver coordinates: ${driver.latitude.toFixed(6)}, ${driver.longitude.toFixed(6)}`
              : "No driver location received"}
          </Text>
          <Text style={styles.muted}>Socket.IO: {connected ? "Connected" : "Not connected"} · Updated: {lastUpdate}</Text>
        </View>

        {mode === "customer" ? (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.primary} onPress={() => void startDemo()} disabled={demoRunning || routeLoading}>
              <Text style={styles.primaryText}>{demoRunning ? "Demo running…" : "▶ Run demo without backend"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => void startDemo(true)}
              disabled={demoRunning || routeLoading}
            >
              <Text style={styles.secondaryText}>Run demo and broadcast via Socket.IO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={stopDemo}>
              <Text style={styles.secondaryText}>Stop demo</Text>
            </TouchableOpacity>
            <Text style={styles.note}>Socket.IO broadcasting requires a running backend and valid task/provider IDs. Open the customer app on another device to follow the driver. Offline demo mode does not send data to the server.</Text>
          </View>
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.primary} onPress={startGps} disabled={gps.isStarting || gps.isTracking}>
              {gps.isStarting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Enable GPS and send location</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={stopGps}>
              <Text style={styles.secondaryText}>Stop sharing GPS</Text>
            </TouchableOpacity>
            <Text style={styles.note}>The app tracks location only while it is open (foreground) and requires location permission. The demo backend accepts positive integer IDs; a production backend must validate task/provider IDs and check access permissions.</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Prototype limitations</Text>
          <Text style={styles.note}>Routes come from the OSRM demo server; origin and destination coordinates are sent to that service. The ETA does not include traffic. Background tracking, Socket.IO authorization, and backend task-access checks are not implemented.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  page: { padding: 16, gap: 14, paddingBottom: 30 },
  header: { gap: 4, paddingTop: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1", padding: 12, alignItems: "center", backgroundColor: "#fff" },
  modeActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  modeText: { color: "#334155", fontWeight: "700" },
  modeTextActive: { color: "#fff" },
  infoCard: { padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  infoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 17, color: "#0F172A", fontWeight: "800" },
  muted: { fontSize: 12, color: "#64748B", marginTop: 3 },
  dot: { width: 11, height: 11, borderRadius: 8 },
  dotOn: { backgroundColor: "#16A34A" },
  dotOff: { backgroundColor: "#94A3B8" },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12 },
  metricValue: { fontSize: 19, color: "#0F172A", fontWeight: "800" },
  status: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  controls: { gap: 9 },
  primary: { borderRadius: 12, backgroundColor: "#2563EB", padding: 15, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1", padding: 13, alignItems: "center", backgroundColor: "#fff" },
  secondaryText: { color: "#334155", fontWeight: "700" },
  note: { color: "#64748B", fontSize: 12, lineHeight: 18 },
  footer: { padding: 14, backgroundColor: "#EAF1FF", borderRadius: 14, gap: 5 },
  footerTitle: { color: "#1E3A8A", fontWeight: "800" }
});