import "server-only";
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { PEOPLE, TRAVELLER, partnerOf, type PersonKey } from "@/config/app";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface Caller {
  uid: string;
  email: string;
  key: PersonKey;
  idToken: string;
}

function memberKeyFor(email: string): PersonKey | null {
  const e = email.trim().toLowerCase();
  if (e && e === (process.env.ALEX_EMAIL ?? "").trim().toLowerCase()) return "alex";
  if (e && e === (process.env.TOBY_EMAIL ?? "").trim().toLowerCase()) return "toby";
  return null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Verify a Firebase ID token (no service account needed) and map it to Alex or Toby. */
export async function requireMember(req: Request): Promise<Caller> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError(500, "Server is missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Not signed in");
  let payload: JWTPayload;
  // Local emulator tokens are unsigned. Never accepted in production builds.
  if (process.env.NODE_ENV !== "production" && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    payload = decodeJwt(token);
  } else {
    try {
      ({ payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      }));
    } catch {
      throw new HttpError(401, "Session expired — please sign in again");
    }
  }
  const email = typeof payload.email === "string" ? payload.email : "";
  const key = memberKeyFor(email);
  if (!key || !payload.sub) throw new HttpError(403, "This space is private");
  return { uid: payload.sub, email, key, idToken: token };
}

export function describe(key: PersonKey) {
  return {
    me: { ...PEOPLE[key], traveller: key === TRAVELLER },
    partner: { ...PEOPLE[partnerOf(key)], traveller: partnerOf(key) === TRAVELLER },
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
