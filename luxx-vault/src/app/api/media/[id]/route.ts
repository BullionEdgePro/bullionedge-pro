import { readMedia } from "@/lib/server/media";
import { getSession } from "@/lib/server/session";

/**
 * Serves a stored image. Public listing photos and covers are immutable
 * (a changed photo is a new id), so browsers and CDNs may keep them forever;
 * private ones (unattached drafts, dispute evidence) are never cached.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const res = await readMedia(id, session ? { userId: session.user.id, role: session.user.role ?? null } : null);
  if (res.status !== 200) {
    return new Response(res.status === 404 ? "Not found" : "Not allowed", { status: res.status, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(new Uint8Array(res.body), {
    headers: {
      "Content-Type": res.mime,
      "Cache-Control": res.cache,
      "Content-Length": String(res.body.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
