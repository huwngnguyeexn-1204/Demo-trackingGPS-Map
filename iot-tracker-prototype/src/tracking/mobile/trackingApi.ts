import type { LocationUpdate } from "./types";

export async function sendTrackingLocation(apiUrl: string, location: LocationUpdate) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/tracking/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(location),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API returned ${response.status}: ${body.slice(0, 180)}`);
  }
}
