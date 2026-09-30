import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { emblemSvg } from "@/components/brand/logo-svg";
import { loadShowroom } from "@/lib/server/marketplace/showroom";
import { statsForOne } from "@/lib/server/marketplace/stats";

export const alt = "A Luxx4less seller showroom";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card for a showroom (Facebook, Messenger, Viber previews):
 * velvet, the gold emblem, the name and tagline, and two real numbers:
 * trust score and pieces on display.
 */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const data = await loadShowroom((await params).handle);
  const [cinzel, stats] = await Promise.all([
    readFile(join(process.cwd(), "scripts/fonts/Cinzel-600.ttf")),
    data ? statsForOne(data.profile.userId) : null,
  ]);
  const emblem = `data:image/svg+xml;base64,${Buffer.from(emblemSvg({ id: "og", detail: "full", frame: "foil" })).toString("base64")}`;
  const name = data?.profile.displayName ?? "Luxx4less";
  const tagline = data?.profile.showroomTagline ?? (data ? "Verified gold and jewellery on Luxx4less" : "Verified gold marketplace");
  const gold = "linear-gradient(90deg, #a8823f, #f0dba6 45%, #d6b26e 70%, #a8823f)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(90% 130% at 18% 0%, #3a2a4c 0%, #1b1326 55%, #120c19 100%)",
          color: "#f3eef6",
          padding: 64,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: 40, right: 40, top: 40, bottom: 40, border: "1px solid rgba(214,178,110,0.35)", borderRadius: 24, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
            <img src={emblem} width={88} height={88} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Cinzel", fontSize: 34, color: "#d6b26e", letterSpacing: 2 }}>Luxx4less</span>
              <span style={{ fontSize: 18, color: "#b8aec4", letterSpacing: 4, textTransform: "uppercase" }}>Seller showroom</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontFamily: "Cinzel", fontSize: name.length > 22 ? 64 : 80, lineHeight: 1.05, backgroundImage: gold, backgroundClip: "text", color: "transparent" }}>{name}</span>
            <span style={{ fontSize: 30, color: "#d9d0e2", maxWidth: 900 }}>{tagline.length > 110 ? `${tagline.slice(0, 107)}…` : tagline}</span>
          </div>
          <div style={{ display: "flex", gap: 48, alignItems: "flex-end" }}>
            {stats && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "Cinzel", fontSize: 56, color: "#f3eef6" }}>{stats.trust.score}</span>
                <span style={{ fontSize: 20, color: "#b8aec4" }}>Trust score · {stats.trust.label}</span>
              </div>
            )}
            {data && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "Cinzel", fontSize: 56, color: "#f3eef6" }}>{data.listingCount}</span>
                <span style={{ fontSize: 20, color: "#b8aec4" }}>{data.listingCount === 1 ? "Piece for sale" : "Pieces for sale"}</span>
              </div>
            )}
            <span style={{ marginLeft: "auto", fontSize: 20, color: "#d6b26e" }}>ID-verified traders · payment held until you confirm</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Cinzel", data: cinzel, style: "normal", weight: 600 }] },
  );
}
