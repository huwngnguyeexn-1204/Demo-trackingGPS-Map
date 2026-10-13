import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import type { Point } from "./types";

type TrackingMapProps = {
  customerLocation: Point;
  driverLocation: Point | null;
  routeCoordinates?: Point[];
  showUserLocation?: boolean;
};

export default function TrackingMap({
  customerLocation,
  driverLocation,
  routeCoordinates,
  showUserLocation = false,
}: TrackingMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasFittedRouteRef = useRef(false);
  const initialRegion: Region = {
    latitude: customerLocation.latitude,
    longitude: customerLocation.longitude,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  useEffect(() => {
    if (!mapReady || !routeCoordinates?.length || hasFittedRouteRef.current) return;
    mapRef.current?.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: 60, right: 50, bottom: 60, left: 50 },
      animated: true,
    });
    hasFittedRouteRef.current = true;
  }, [mapReady, routeCoordinates]);

  return (
    <View style={styles.card}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton
        onMapReady={() => setMapReady(true)}
      >
        <Marker
          coordinate={customerLocation}
          title="A · Customer"
          description="Customer pickup location"
          pinColor="#16A34A"
        />
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="B · Driver"
            description="Live driver location"
            pinColor="#2563EB"
          />
        )}
        {routeCoordinates && (
          <Polyline coordinates={routeCoordinates} strokeColor="#2563EB" strokeWidth={5} />
        )}
      </MapView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>🟢 A: Customer</Text>
        <Text style={styles.legendText}>🔵 B: Driver</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  map: { height: 350, width: "100%" },
  legend: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10 },
  legendText: { fontSize: 12, color: "#334155", fontWeight: "600" },
});
