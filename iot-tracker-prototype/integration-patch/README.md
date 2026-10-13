# Add reusable tracking to the existing mobile app

The old single-file demo screen has been replaced by shared tracking modules and a separate demo screen. The original backend remains in `src/tracking/*.js`; mobile code is separated under `src/tracking/mobile/`. For the real app, copy the reusable modules from `src/tracking/mobile/` into the matching `frontend-mobile/src/tracking/mobile/` path, excluding its `demo/` subfolder. Do not copy `app/index.tsx`.

1. In the original repository, install the dependencies:
   ```bash
   cd frontend-mobile
   npx expo install react-native-maps expo-location
   npm install socket.io-client
   ```
2. Create a tracking screen in `frontend-mobile/src/app/` that imports `TrackingMap`, `useDriverGps`, `sendTrackingLocation`, and `subscribeToTaskLocations` from `../tracking/mobile/`.
3. Pass the selected task's real customer coordinates, task ID, and provider ID into those modules. Resolve the API and Socket.IO URLs from the host app's existing config/authenticated API client.
4. Add a button/link to the new route from a suitable dashboard or task page.

The existing app's auth guard in `src/app/_layout.tsx` remains in effect, so a user must sign in before opening the route. The shared transport is a prototype baseline: connect it to the app's authenticated API/socket configuration and enforce task-level access on the backend before production use.
