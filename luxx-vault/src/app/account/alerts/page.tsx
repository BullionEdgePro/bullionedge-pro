import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, BellRing, Pause, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import type { Metal } from "@/config/catalog";
import type { Market } from "@/lib/market";
import { formatPeso } from "@/lib/pricing";
import { ALERT_COOLDOWN_MS, ALERT_KARATS, MAX_ALERTS_PER_USER, alertLabel, distanceToTarget, isOnTargetSide, priceAtPurity, type AlertDirection } from "@/lib/server/alerts/logic";
// Safety net: make sure the checker is hooked onto the price engine in this server's module graph too.
import "@/lib/server/alerts/register";
import { channelStatuses } from "@/lib/server/channels/link";
import { MESSENGER_WINDOW_MS, withinMessengerWindow } from "@/lib/server/channels/signature";
import { db } from "@/lib/server/db";
import { getMarket } from "@/lib/server/prices/engine";
import { requireViewer } from "@/lib/server/viewer";
import { deleteAlert, setAlertActive } from "./actions";
import { AlertForm } from "./alert-form";
import { ChannelsPanel, type ChannelView } from "./channels-panel";

export const metadata: Metadata = { title: "Price alerts", robots: { index: false, follow: false } };

const CHANNEL_NAMES: Record<string, string> = { in_app: "Bell", email: "Email", viber: "Viber", messenger: "Messenger" };
const fmtTime = (d: Date) => d.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export default async function AlertsPage() {
  const viewer = await requireViewer("/account/alerts");
  const [market, alerts, statuses] = await Promise.all([
    getMarket().catch((): Market | null => null),
    db.priceAlert.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" } }),
    channelStatuses(viewer.userId),
  ]);

  const pure = (m: Metal) => market?.metals[m]?.phpPerGram ?? null;
  const prices = { gold: pure("gold"), silver: pure("silver"), platinum: pure("platinum"), palladium: pure("palladium") };
  const channels: ChannelView[] = statuses.map((s) => ({
    kind: s.kind,
    mode: s.mode,
    linked: s.linked,
    linkedAt: s.linkedAt?.toISOString() ?? null,
    windowOpenUntil:
      s.kind === "messenger" && withinMessengerWindow(s.lastInboundAt) ? new Date(s.lastInboundAt!.getTime() + MESSENGER_WINDOW_MS).toISOString() : null,
  }));
  const linked = { viber: statuses.some((s) => s.kind === "viber" && s.linked), messenger: statuses.some((s) => s.kind === "messenger" && s.linked) };

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="text-sm font-semibold text-champagne">Your instruments</p>
        <h1 className="text-3xl sm:text-4xl">Price alerts</h1>
        <p className="measure text-muted">
          Name a price per gram and we&apos;ll tell you the moment the market crosses it. One message per crossing, and never more than once every twelve
          hours per alert.
        </p>
        {market?.delayed && (
          <p className="text-sm text-warning">Prices are delayed right now; alerts check again as soon as fresh prices arrive.</p>
        )}
      </header>

      <Card>
        <CardBody className="grid gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl">New alert</h2>
            <span className="text-sm text-muted tabular">
              {alerts.length} of {MAX_ALERTS_PER_USER}
            </span>
          </div>
          <AlertForm prices={prices} karats={ALERT_KARATS} linked={linked} remaining={MAX_ALERTS_PER_USER - alerts.length} />
        </CardBody>
      </Card>

      <section aria-labelledby="yours" className="grid gap-4">
        <h2 id="yours" className="text-xl">
          Your alerts
        </h2>
        {alerts.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <BellRing className="size-8 text-champagne" aria-hidden />
              <p className="font-semibold">No alerts yet</p>
              <p className="measure text-sm text-muted">
                Try one for the karat you usually buy: &ldquo;tell me when 18K falls below&nbsp;…&rdquo;. See today&apos;s board on the{" "}
                <Link href="/prices" className="text-gold underline-offset-4 hover:underline">
                  live prices
                </Link>{" "}
                page.
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {alerts.map((a) => {
              const direction = a.direction as AlertDirection;
              const target = Number(a.targetPhpPerGram);
              const base = prices[a.metal as Metal];
              const now = base != null ? priceAtPurity(base, a.metal, a.karat) : null;
              const met = now != null && isOnTargetSide(direction, now, target);
              const resting = isResting(a.lastTriggeredAt);
              return (
                <li key={a.id}>
                  <Card className={a.active ? undefined : "opacity-70"}>
                    <CardBody className="grid gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-lg tracking-wide">
                            {alertLabel(a.metal, a.karat)}
                            <span className="text-muted"> · {direction === "above" ? "rises above" : "falls below"} </span>
                            <span className="font-sans font-semibold tracking-normal text-champagne tabular">{formatPeso(target, true)}</span>
                            <span className="font-sans text-sm tracking-normal text-muted">/g</span>
                          </p>
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                            <span>Via {a.channels.map((c) => CHANNEL_NAMES[c] ?? c).join(", ")}</span>
                            {a.lastTriggeredAt && <span>Last sent {fmtTime(a.lastTriggeredAt)}</span>}
                          </p>
                        </div>
                        <StatusBadge active={a.active} met={met} resting={Boolean(resting)} />
                      </div>

                      {now != null && <DistanceScale now={now} target={target} direction={direction} />}

                      <div className="flex flex-wrap gap-2">
                        <form action={setAlertActive}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                          <Button type="submit" variant="secondary" size="sm">
                            {a.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                            {a.active ? "Pause" : "Resume"}
                          </Button>
                        </form>
                        <form action={deleteAlert}>
                          <input type="hidden" name="id" value={a.id} />
                          <Button type="submit" variant="ghost" size="sm" aria-label={`Delete alert: ${alertLabel(a.metal, a.karat)} ${direction} ${formatPeso(target, true)}`}>
                            <Trash2 aria-hidden /> Delete
                          </Button>
                        </form>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="where" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="where" className="text-xl">
            Where alerts reach you
          </h2>
          <p className="text-sm text-muted">Every alert lands in the bell on Luxx4less. Add email, Viber or Messenger for when you&apos;re away.</p>
        </div>
        <ChannelsPanel email={viewer.email} channels={channels} />
      </section>
    </div>
  );
}

/** Fired within the last 12 hours, so it won't fire again yet. */
function isResting(lastTriggeredAt: Date | null): boolean {
  return Boolean(lastTriggeredAt && Date.now() - lastTriggeredAt.getTime() < ALERT_COOLDOWN_MS);
}

function StatusBadge({ active, met, resting }: { active: boolean; met: boolean; resting: boolean }) {
  if (!active)
    return (
      <Badge icon={<BellOff aria-hidden />} tone="neutral">
        Paused
      </Badge>
    );
  if (resting) return <Badge tone="gold">Sent · resting 12 h</Badge>;
  if (met) return <Badge tone="ice" title="The price is already past your target. The alert fires when it moves back and crosses again.">Past target</Badge>;
  return <Badge tone="success">Watching</Badge>;
}

/**
 * A loupe on the distance to go: the track spans a little either side of the
 * current price and the target; the gold tick is the target, the pearl dot is
 * today's price, and the band between them is the move still needed.
 */
function DistanceScale({ now, target, direction }: { now: number; target: number; direction: AlertDirection }) {
  const lo = Math.min(now, target);
  const hi = Math.max(now, target);
  const pad = Math.max((hi - lo) * 0.25, hi * 0.005);
  const min = lo - pad;
  const span = hi + pad - min;
  const pos = (v: number) => `${(((v - min) / span) * 100).toFixed(2)}%`;
  const d = distanceToTarget(now, target);
  const met = isOnTargetSide(direction, now, target);
  const toGo = met ? "Past your target" : `${formatPeso(Math.abs(d.php), true)} (${Math.abs(d.pct).toFixed(2)}%) to go`;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">
          Now <span className="font-semibold text-fg tabular">{formatPeso(now, true)}</span>/g
        </span>
        <span className={met ? "text-ice" : "text-champagne"}>{toGo}</span>
      </div>
      <div className="relative h-6" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        {/* hairline graduations, like the scale on a balance */}
        <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 justify-between">
          {Array.from({ length: 21 }, (_, i) => (
            <span key={i} className={i % 5 === 0 ? "h-2 w-px bg-line" : "mt-0.5 h-1 w-px bg-line/70"} />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgb(214_178_110/0.15),rgb(214_178_110/0.55))]"
          style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }}
        />
        <div className="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full bg-champagne shadow-[0_0_8px_rgb(214_178_110/0.8)]" style={{ left: pos(target) }} />
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-velvet bg-pearl shadow-[0_0_0_3px_rgb(238_240_243/0.15)]" style={{ left: pos(now) }} />
      </div>
      <p className="sr-only">
        Current price {formatPeso(now, true)} per gram; target {formatPeso(target, true)}. {toGo}.
      </p>
    </div>
  );
}
