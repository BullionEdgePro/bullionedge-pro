import { NextResponse } from "next/server";
import { getViewer } from "@/lib/server/viewer";
import { loadThread, markRead, messagesSince } from "@/lib/server/marketplace/threads";

/**
 * Chat polling (every ~5 s from the open thread; no realtime provider yet).
 * Participants only. Returns messages newer than `after` and marks them read.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const convo = await loadThread(id, viewer.userId);
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const afterRaw = new URL(request.url).searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : undefined;
  const messages = await messagesSince(id, after && !Number.isNaN(after.getTime()) ? after : undefined, 100);
  if (messages.length) await markRead(id, viewer.userId);
  return NextResponse.json(
    { messages, blocked: convo.participants.some((p) => p.blockedAt) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
