export type Point = { latitude: number; longitude: number };

export type RoadRoute = {
  coordinates: Point[];
  distanceKm: number;
  durationMinutes: number;
};

export type LocationUpdate = {
  taskId: number;
  providerId: number;
  lat: number;
  lng: number;
  timestamp: string | number;
};
