import { errorResponse, requireMember } from "@/lib/server/auth";

/** Optional licensed image search (Unsplash). The access key never leaves the server. */
export async function GET(req: Request) {
  try {
    await requireMember(req);
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return Response.json({ error: "Image search is not configured" }, { status: 501 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    if (q.length < 2) return Response.json({ results: [] });
    const params = new URLSearchParams({ query: q, per_page: "12", content_filter: "high" });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ error: "Image search failed" }, { status: 502 });
    const json = (await res.json()) as {
      results: Array<{
        id: string;
        width: number;
        height: number;
        alt_description: string | null;
        urls: { regular: string; small: string };
        links: { download_location: string };
        user: { name: string; links: { html: string } };
      }>;
    };
    const utm = "utm_source=see_you_soon&utm_medium=referral";
    const results = json.results.map((r) => ({
      id: r.id,
      url: r.urls.regular,
      thumb: r.urls.small,
      w: r.width,
      h: r.height,
      alt: r.alt_description ?? "",
      downloadLocation: r.links.download_location,
      credit: { name: r.user.name, link: `${r.user.links.html}?${utm}` },
    }));
    return Response.json({ results });
  } catch (e) {
    return errorResponse(e);
  }
}
