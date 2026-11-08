import { errorResponse, requireMember } from "@/lib/server/auth";
import { reverseGeocode } from "@/lib/server/photon";

export async function GET(req: Request) {
  try {
    await requireMember(req);
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    const place = await reverseGeocode(lat, lon);
    return Response.json({ place });
  } catch (e) {
    return errorResponse(e);
  }
}
