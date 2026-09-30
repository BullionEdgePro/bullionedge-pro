import { NextResponse } from "next/server";
import { z } from "zod";
import { ImageRejected, MEDIA_PURPOSES, storeUpload } from "@/lib/server/media";
import { rateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";

/**
 * Photo upload (multipart: `file`, `purpose`). A route handler rather than a
 * server action because photos can be up to 10 MB and server actions stop at
 * 1 MB. Same rules as an action: session, tier and rate limit checked here.
 */
const Purpose = z.enum(MEDIA_PURPOSES);

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 400 });
  }
  const purpose = Purpose.safeParse(form.get("purpose"));
  if (!purpose.success) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });

  if (purpose.data === "listing") {
    if (viewer.tier < 4) return NextResponse.json({ error: "Only verified sellers can upload listing photos." }, { status: 403 });
    if (!viewer.twoFactorEnabled) return NextResponse.json({ error: "Turn on two-step sign-in to sell." }, { status: 403 });
  }
  if (purpose.data === "dispute_evidence" && viewer.tier < 3) {
    return NextResponse.json({ error: "Verify your identity first." }, { status: 403 });
  }
  if (!(await rateLimit(`media:upload:${viewer.userId}`, 60, 60 * 60_000))) {
    return NextResponse.json({ error: "Too many uploads in the last hour. Please wait a little." }, { status: 429 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "That photo is larger than 10 MB." }, { status: 413 });

  try {
    const stored = await storeUpload(viewer.userId, purpose.data, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json(stored, { status: 201 });
  } catch (err) {
    if (err instanceof ImageRejected) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("media upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
