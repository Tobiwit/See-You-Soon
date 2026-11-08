import { describe, errorResponse, requireMember } from "@/lib/server/auth";

/** Who am I? Maps the signed-in Firebase user to Alex or Toby (emails live in server env only). */
export async function GET(req: Request) {
  try {
    const caller = await requireMember(req);
    return Response.json({ key: caller.key, ...describe(caller.key) });
  } catch (e) {
    return errorResponse(e);
  }
}
