import "server-only";
import { getRequestByTrackingToken, getLookups, getTechnicians } from "./db";
import { trackingPhase, type TrackingSnapshot } from "./technicianTracking";

// Everything the customer's /track-technician page shows, looked up by the
// secret token from their email. Null for an unknown/trashed token.
export async function getTrackingSnapshot(token: string): Promise<TrackingSnapshot | null> {
  const req = await getRequestByTrackingToken(token);
  if (!req) return null;
  const [lookups, technicians] = await Promise.all([getLookups(), getTechnicians()]);
  const phase = trackingPhase(lookups.find((l) => l.id === req.statusId)?.label);
  return {
    reference: req.reference,
    phase,
    technicianName: technicians.find((t) => t.id === req.assignedTechnicianId)?.name ?? "Your technician",
    customer: req.lat !== null && req.lng !== null ? { lat: req.lat, lng: req.lng } : null,
    // Only reveal the technician's position while they're actually en route.
    technician: phase === "on_the_way" && req.techLat !== null && req.techLng !== null ? { lat: req.techLat, lng: req.techLng } : null,
    technicianUpdatedAt: phase === "on_the_way" ? req.techLocationAt : null,
  };
}
