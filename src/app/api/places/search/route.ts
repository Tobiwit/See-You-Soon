import { errorResponse, requireMember } from "@/lib/server/auth";
import { searchPlaces } from "@/lib/server/photon";

export async function GET(req: Request) {
  try {
    await requireMember(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    if (q.length < 2) return Response.json({ results: [] });
    // Bias results towards Vietnam unless the caller passes another point.
    const lat = Number(url.searchParams.get("lat") ?? 16.0);
    const lon = Number(url.searchParams.get("lon") ?? 106.5);
    const results = await searchPlaces(q, Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined);
    return Response.json({ results });
  } catch (e) {
    return errorResponse(e);
  }
}
