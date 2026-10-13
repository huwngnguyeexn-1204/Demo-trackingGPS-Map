const { z } = require('zod');

// Validate the identifiers, coordinates, and timestamp accepted by the tracking endpoint.
const trackingUpdateSchema = z.object({
  taskId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  lat: z.number(),
  lng: z.number(),
  timestamp: z.union([z.string().datetime(), z.number()]),
});

module.exports = {
  trackingUpdateSchema,
};
