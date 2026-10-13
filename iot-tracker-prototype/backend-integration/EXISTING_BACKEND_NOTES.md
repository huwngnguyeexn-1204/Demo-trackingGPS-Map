# Backend inspection notes from the uploaded ConnectMyTask project

- `src/modules/tracking/routes.js` exposes `POST /tracking/update`; app mounting makes the client path `/api/tracking/update`.
- `src/modules/tracking/validation.js` expects positive integer `taskId`, positive integer `providerId`, numeric `lat` and `lng`, and a string datetime or numeric `timestamp`.
- `src/modules/tracking/controller.js` saves the update then emits Socket.IO `location:update` with `taskId`, `providerId`, `lat`, `lng`, `timestamp`.
- `src/modules/tracking/repository.js` writes to Prisma `TrackingLog`.
- Existing mobile `frontend-mobile/src/app/task-tracking.tsx` is an activity timeline, not a live map.
- Existing mobile API URL resolution is in `frontend-mobile/src/services/api.ts`.

Prototype compatibility note: it uses the route and event already present in the repository. It does not silently change the production backend.
