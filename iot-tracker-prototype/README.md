# ConnectMyTask — Project B IoT Tracking Prototype

An Expo prototype for near-real-time driver tracking, similar to ride-hailing apps.

## Prototype features

- A map showing A (customer) and B (driver).
- Demo mode: simulates the driver's movement along a road route, using the device's current GPS location as the starting point. Optionally sends simulated locations to the backend for Socket.IO broadcasts.
- Driver mode: sends the first GPS location as soon as tracking starts, then sends the latest location to `POST /api/tracking/update` every 5 seconds. GPS samples may be collected more frequently, but each sample is not sent to the backend.
- Customer mode: receives `location:update` events through Socket.IO and updates the driver marker.
- Loads road-route geometry and an estimated ETA from the OSRM demo server. Origin and destination coordinates are sent to OSRM. The ETA does not account for traffic, and the public endpoint has no SLA.

## Code structure

- `src/tracking/*.js`: original Express/Prisma backend modules (routes, controller, service, repository, and validation). Keep these on the server side.
- `src/tracking/mobile/`: reusable app-side modules — `TrackingMap`, the `useDriverGps` hook, HTTP/Socket.IO clients, and shared types. Exports are collected in `src/tracking/mobile/index.ts`. These modules receive task/provider IDs and the customer's location from the calling screen; they do not define IDs or demo coordinates.
- `src/tracking/mobile/demo/`: prototype-only demo screen, sample customer location, `.env` demo configuration, route simulation, and OSRM integration.
- `app/index.tsx`: a thin Expo Router route that opens the demo screen. For the production app, create a separate screen/route and use modules from `src/tracking/mobile/`; do not copy the demo route or demo configuration.
- `backend-demo/`: a minimal Socket.IO server for testing, not a production backend.

## 1. Install

Node.js 20+ and npm are recommended. Open a terminal in this directory:

```bash
npm install
npx expo install --fix
```

If the disk reports `ENOSPC`, free up disk space before installing dependencies.

## 2. Run the demo without a backend

```bash
npx expo start --clear
```

Open the app in Expo Go on a phone or Android Emulator. Choose **Run demo without backend** to see the driver marker move.

`react-native-maps` works best in Expo Go on a physical device or Android emulator. Native maps are not fully supported on Web.

## 3. Run the Socket.IO demo backend and test with two devices

The demo backend is in `backend-demo/`; it does not require a database or the original ConnectMyTask backend. It receives locations, prints latitude/longitude and timestamps to the server terminal, and broadcasts them through Socket.IO. It does not store location history. The app also displays the latest coordinates in the information card below the map.

1. In a first terminal, install dependencies and start the server:
   ```bash
   cd backend-demo
   npm install
   npm start
   ```
2. Find the computer's IPv4 address with `ipconfig` (for example, `192.168.1.20`). The phone and computer must be on the same Wi-Fi network.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to `http://COMPUTER_IP:4000/api`. Any positive integer can be used for the task/provider IDs with this demo backend.
4. If Windows Firewall blocks the connection, allow Node.js or TCP port 4000 on a trusted Private network; do not disable the entire firewall. Check the server at `http://localhost:4000/api/health`.
5. In a second terminal at the prototype root, start Expo after editing `.env`:
   ```bash
   npx expo start --clear
   ```
6. On phone B, choose **B · Driver** and press **Enable GPS and send location**. Alternatively, choose **A · Customer** and press **Run demo and broadcast via Socket.IO**; the demo requests GPS permission and uses the device's location as its starting point.
7. On phone A, choose **A · Customer**. Both devices must use the same `taskId`; the driver marker updates when Socket.IO receives an event.

## Integrate tracking into the existing frontend-mobile app

The main project uses Expo Router in `frontend-mobile/src/app`. Copy `src/tracking/mobile/` to `frontend-mobile/src/tracking/mobile/`, then create an app screen that imports the modules from `../tracking/mobile`. Pass the real task/provider IDs and customer coordinates from the selected task data. Do not use `src/tracking/mobile/demo/` or the prototype's default IDs/locations. Install dependencies in `frontend-mobile`:

```bash
npx expo install react-native-maps expo-location
npm install socket.io-client
```

Example usage from a shared module in a new screen:

```tsx
import { useDriverGps, subscribeToTaskLocations } from "../tracking/mobile";

const gps = useDriverGps({ apiUrl, taskId, providerId });
useEffect(
  () => subscribeToTaskLocations(socketUrl, taskId, {
    onConnectionChange: setConnected,
    onConnectionError: setError,
    onLocation: (_update, point) => setDriverLocation(point),
  }),
  [socketUrl, taskId],
);
```

In production, call `sendTrackingLocation` through the app's authenticated API client (or add a token to the transport), and configure authentication/authorization on the backend. Then add a dedicated route and open it from the dashboard or through Expo Router navigation.

## Current backend and limitations

- The standalone demo backend provides `GET /api/health`, `POST /api/tracking/update`, and the Socket.IO event `location:update`.
- Current payload: `{ "taskId": 1, "providerId": 1, "lat": 10.77, "lng": 106.70, "timestamp": "2026-10-12T12:00:00.000Z" }`.
- The demo backend broadcasts `location:update` globally with `io.emit` and does not persist data. The app connects Socket.IO to the backend host (remove `/api` from the API URL) and filters by `taskId` on the client; this filter only affects the UI and **is not a security control**.
- `src/tracking/*.js` contains the original backend modules included in the source, while `backend-demo/` is a standalone server for quick testing without running the original backend.
- Before production use, add user authentication, verify that the provider is assigned to the task, restrict location visibility by task, use Socket.IO rooms, protect against GPS spoofing, handle retries/offline operation, and define a location-data retention policy.
- The prototype only uses foreground GPS; tracking is not guaranteed while the app is in the background or closed.
- Routes in the prototype use the OSRM demo server, not Google Maps Directions, and do not include traffic information. For production, choose an appropriate provider (for example, Google Maps Platform) and consider API costs/keys and location-data policies.
