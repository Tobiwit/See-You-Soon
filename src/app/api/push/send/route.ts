import { sendNotification, setVapidDetails } from "web-push";
import { PEOPLE, SPACE_ID, partnerOf } from "@/config/app";
import { errorResponse, requireMember } from "@/lib/server/auth";

/**
 * Sends a Web Push notification to the *other* person.
 * The partner's subscription is read from Firestore using the caller's own ID
 * token, so security rules still apply and no service-account key is needed.
 * Notification text is built here from the event type — clients cannot push
 * arbitrary text.
 */

type Kind =
  | "postcard_created"
  | "thinking_of_you"
  | "feeling_down"
  | "call_me"
  | "wishlist_item_added"
  | "mood_updated"
  | "moment_added"
  | "location_updated";

function compose(kind: Kind, name: string, label: string) {
  const l = label.slice(0, 80);
  switch (kind) {
    case "postcard_created":
      return { title: `A postcard from ${name}.`, body: l || "Open it in Memories." };
    case "thinking_of_you":
      return { title: `${name} is thinking of you.`, body: "" };
    case "feeling_down":
      return { title: `${name} is feeling down.`, body: "Maybe send something sweet." };
    case "call_me":
      return { title: `${name} would love a call.`, body: "Whenever you have a moment." };
    case "wishlist_item_added":
      return { title: `${name} added somewhere to go.`, body: l };
    case "mood_updated":
      return { title: `${name}'s horniness increased.`, body: "" };
    case "moment_added":
      return { title: `${name} saved a moment.`, body: l };
    case "location_updated":
      return { title: `${name} is now in ${l || "a new place"}.`, body: "" };
  }
}

interface FsValue {
  stringValue?: string;
  mapValue?: { fields?: Record<string, FsValue> };
}

export async function POST(req: Request) {
  try {
    const caller = await requireMember(req);
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return Response.json({ sent: false, reason: "push-not-configured" });

    const body = (await req.json()) as { type?: Kind; label?: string; refId?: string };
    const kinds: Kind[] = [
      "postcard_created",
      "thinking_of_you",
      "feeling_down",
      "call_me",
      "wishlist_item_added",
      "mood_updated",
      "moment_added",
      "location_updated",
    ];
    if (!body.type || !kinds.includes(body.type)) {
      return Response.json({ error: "Unknown event type" }, { status: 400 });
    }

    const partner = partnerOf(caller.key);
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/spaces/${SPACE_ID}/members/${partner}`;
    const docRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${caller.idToken}` }, cache: "no-store" });
    if (docRes.status === 404) return Response.json({ sent: false, reason: "partner-not-subscribed" });
    if (!docRes.ok) return Response.json({ sent: false, reason: "lookup-failed" }, { status: 502 });

    const doc = (await docRes.json()) as { fields?: Record<string, FsValue> };
    const push = doc.fields?.push?.mapValue?.fields;
    const endpoint = push?.endpoint?.stringValue;
    const keys = push?.keys?.mapValue?.fields;
    const p256dh = keys?.p256dh?.stringValue;
    const auth = keys?.auth?.stringValue;
    if (!endpoint || !p256dh || !auth) return Response.json({ sent: false, reason: "partner-not-subscribed" });

    setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@example.com", pub, priv);
    const text = compose(body.type, PEOPLE[caller.key].name, body.label ?? "");
    const refId = (body.refId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    const payload = JSON.stringify({ ...text, url: refId ? `/?open=${body.type}:${refId}` : "/" });

    try {
      await sendNotification({ endpoint, keys: { p256dh, auth } }, payload, { TTL: 60 * 60 * 24 });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return Response.json({ sent: false, reason: "subscription-expired" });
      throw err;
    }
    return Response.json({ sent: true });
  } catch (e) {
    return errorResponse(e);
  }
}
