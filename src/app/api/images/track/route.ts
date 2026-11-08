import { errorResponse, requireMember } from "@/lib/server/auth";

/** Unsplash API guideline: trigger the download endpoint when a photo is chosen. */
export async function POST(req: Request) {
  try {
    await requireMember(req);
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return Response.json({ ok: false }, { status: 501 });
    const { downloadLocation } = (await req.json()) as { downloadLocation?: string };
    if (!downloadLocation?.startsWith("https://api.unsplash.com/")) {
      return Response.json({ error: "Invalid download location" }, { status: 400 });
    }
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
