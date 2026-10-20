# ConnectMyTask — Driver Tracking Demo

An Expo prototype for sharing a driver's live location using GPS and Socket.IO. The map uses Leaflet and OpenStreetMap; no Google Maps API key is required.

## Run the app

Requires Node.js 20+ and npm. Open two PowerShell windows in the project directory.

**Window 1 — start the backend:**

```powershell
cd backend-demo
npm install
npm start
```

The backend receives and broadcasts locations over Socket.IO and fetches OSRM routes for the app. It does not store location history.

**Window 2 — start Expo:**

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npx expo start --lan --clear
```

In `.env`, set `EXPO_PUBLIC_API_URL` to your laptop's IPv4 address, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api
```

Replace the example IP with the address shown by `ipconfig`. Your iPhone and laptop must be on the same Wi-Fi network. If prompted, allow Node.js through Windows Firewall on a trusted Private network. Check the backend at `http://localhost:4000/api/health` on the laptop.

## Test with two devices

1. Open the app in Expo Go on the iPhone. From the Expo terminal, press `a` to open the Android Emulator.
2. On the **iPhone (B · Driver)**, select **B · Driver**, grant location permission, and tap **Enable GPS and send location**.
3. On the **Android Emulator (A · Customer)**, select **A · Customer**. Do not tap **Run demo** when you want to follow the iPhone's live GPS.
4. On Android, check for `Socket.IO: Connected` and updated `Driver coordinates`. The backend prints received coordinates in Window 1.

To set a simulated location for the Android Emulator, open **Extended controls (`…`) → Location**, choose a location, and send it.

## Run the simulation

On one device, select **A · Customer** and tap **Run demo without backend** to simulate a driver moving from that device's GPS location. **Run demo and broadcast via Socket.IO** also sends simulated locations to other devices. If OSRM is unavailable, the demo follows a straight line and does not show a road ETA.

## Notes

- Internet access is required to load Leaflet and OpenStreetMap tiles. Keep the OpenStreetMap attribution visible. The public tile service has no production SLA.
- GPS tracking works only while the app is open. This prototype has no authentication, task-level access control, or location history.
- For production integration, use only the reusable modules in `src/tracking/mobile/` and pass real task/provider IDs and customer coordinates from the host app. See the [integration guide](./integration-patch/README.md); do not use the demo screen or demo configuration in production.
