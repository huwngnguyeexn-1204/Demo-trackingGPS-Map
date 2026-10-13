import type { Point } from "../types";

export const DEMO_CUSTOMER: Point = { latitude: 10.7769, longitude: 106.7009 };
export const DEMO_API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.10:4000/api"
).replace(/\/$/, "");
export const DEMO_SOCKET_URL = DEMO_API_URL.replace(/\/api$/, "");
export const DEMO_TASK_ID = Number(process.env.EXPO_PUBLIC_DEMO_TASK_ID || 1);
export const DEMO_PROVIDER_ID = Number(process.env.EXPO_PUBLIC_DEMO_PROVIDER_ID || 1);
