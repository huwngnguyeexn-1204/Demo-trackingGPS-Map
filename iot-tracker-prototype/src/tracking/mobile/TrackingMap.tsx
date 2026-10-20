import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import type { Point } from "./types";

type TrackingMapProps = {
  customerLocation: Point;
  driverLocation: Point | null;
  routeCoordinates?: Point[];
};

function createMapHtml(initialCenter: Point) {
  const center = JSON.stringify([initialCenter.latitude, initialCenter.longitude]);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; background: #e2e8f0; }
    .marker-icon { display: flex; width: 32px; height: 32px; align-items: center; justify-content: center;
      border: 3px solid #fff; border-radius: 50%; color: #fff; font: 700 14px sans-serif;
      box-shadow: 0 1px 5px #334155; }
    .customer-marker { background: #16a34a; }
    .driver-marker { background: #2563eb; }
    .map-error { padding: 20px; color: #334155; font: 14px sans-serif; text-align: center; }
  </style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    onerror="window.ReactNativeWebView.postMessage(JSON.stringify({type:'map-error'}))"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    if (!window.L) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'map-error'}));
    } else {
      const map = L.map('map').setView(${center}, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const customerIcon = L.divIcon({
        className: '',
        html: '<div class="marker-icon customer-marker">A</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      const driverIcon = L.divIcon({
        className: '',
        html: '<div class="marker-icon driver-marker">B</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      let customerMarker;
      let driverMarker;
      let routeLine;
      let hasFittedRoute = false;

      window.updateTrackingMap = function(data) {
        const customer = [data.customerLocation.latitude, data.customerLocation.longitude];
        if (customerMarker) customerMarker.setLatLng(customer);
        else customerMarker = L.marker(customer, {icon: customerIcon}).addTo(map).bindPopup('A · Customer');

        if (data.driverLocation) {
          const driver = [data.driverLocation.latitude, data.driverLocation.longitude];
          if (driverMarker) driverMarker.setLatLng(driver);
          else driverMarker = L.marker(driver, {icon: driverIcon}).addTo(map).bindPopup('B · Driver');
        } else if (driverMarker) {
          map.removeLayer(driverMarker);
          driverMarker = null;
        }

        if (routeLine) {
          map.removeLayer(routeLine);
          routeLine = null;
        }
        if (data.routeCoordinates && data.routeCoordinates.length) {
          const route = data.routeCoordinates.map(point => [point.latitude, point.longitude]);
          routeLine = L.polyline(route, {color: '#2563eb', weight: 5}).addTo(map);
          if (!hasFittedRoute && route.length > 1) {
            map.fitBounds(routeLine.getBounds(), {padding: [40, 40]});
            hasFittedRoute = true;
          }
        } else if (data.driverLocation) {
          const bounds = L.latLngBounds([customer, [
            data.driverLocation.latitude,
            data.driverLocation.longitude
          ]]);
          map.fitBounds(bounds, {padding: [40, 40], maxZoom: 15});
        }
      };

      window.ReactNativeWebView.postMessage(JSON.stringify({type:'map-ready'}));
    }
  </script>
</body>
</html>`;
}

export default function TrackingMap({
  customerLocation,
  driverLocation,
  routeCoordinates,
}: TrackingMapProps) {
  const mapRef = useRef<WebView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const html = useMemo(
    () => createMapHtml(customerLocation),
    [customerLocation.latitude, customerLocation.longitude],
  );

  useEffect(() => {
    if (!mapReady) return;
    const data = JSON.stringify({ customerLocation, driverLocation, routeCoordinates });
    mapRef.current?.injectJavaScript(`window.updateTrackingMap(${data}); true;`);
  }, [customerLocation, driverLocation, mapReady, routeCoordinates]);

  function handleMessage(event: WebViewMessageEvent) {
    const message = JSON.parse(event.nativeEvent.data) as { type?: string };
    if (message.type === "map-ready") {
      setMapReady(true);
      setMapError(false);
    } else if (message.type === "map-error") {
      setMapError(true);
    }
  }

  return (
    <View style={styles.card}>
      <WebView
        ref={mapRef}
        source={{ html }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        onMessage={handleMessage}
        onLoadStart={() => setMapReady(false)}
        onError={() => setMapError(true)}
      />
      {mapError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Không tải được bản đồ. Hãy kiểm tra kết nối internet.</Text>
        </View>
      )}
      <View style={styles.legend}>
        <Text style={styles.legendText}>🟢 A: Customer</Text>
        <Text style={styles.legendText}>🔵 B: Driver</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  map: { height: 350, width: "100%", backgroundColor: "#E2E8F0" },
  errorOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 44, justifyContent: "center", padding: 24, backgroundColor: "#E2E8F0" },
  errorText: { color: "#334155", fontSize: 14, textAlign: "center" },
  legend: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10 },
  legendText: { fontSize: 12, color: "#334155", fontWeight: "600" },
});
