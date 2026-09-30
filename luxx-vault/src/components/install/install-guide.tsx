"use client";

import { CheckCircle2, Download, ExternalLink, Laptop, MoreVertical, Share, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Emblem } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BROWSER_NAMES, detectInstall, type Detection, type InstallPath } from "./platform";

/** Chrome's install event (not in the DOM typings). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Tab = "iphone" | "android" | "computer";
const TABS: { value: Tab; label: string; icon: typeof Smartphone }[] = [
  { value: "iphone", label: "iPhone & iPad", icon: Tablet },
  { value: "android", label: "Android", icon: Smartphone },
  { value: "computer", label: "Computer", icon: Laptop },
];

function tabFor(path: InstallPath, os: Detection["os"]): Tab {
  if (path.startsWith("ios") || os === "ios") return "iphone";
  if (path.startsWith("android") || os === "android") return "android";
  return "computer";
}

export function InstallGuide() {
  const [detected, setDetected] = useState<Detection | null>(null);
  const [tab, setTab] = useState<Tab>("iphone");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const d = detectInstall({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone });
    // Detection needs the browser; set once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetected(d);
    setTab(tabFor(d.path, d.os));
    setInstalled(d.path === "installed");

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own gold button
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  const here = detected && tab === tabFor(detected.path, detected.os);

  return (
    <div className="grid gap-6">
      {installed ? (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success-tint px-5 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          <p className="text-sm">
            <strong className="font-semibold">Luxx4less is installed on this device.</strong> Open it from your home screen or app list.
          </p>
        </div>
      ) : detected?.path === "in-app" ? (
        <InAppNotice os={detected.os} />
      ) : (
        promptEvent && (
          <div className="grid gap-3 rounded-2xl border border-gold-large/40 bg-[linear-gradient(120deg,rgb(214_178_110/0.14),transparent_65%)] p-5 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm">
              <strong className="block font-display text-lg tracking-wide">Ready to install</strong>
              Your browser can add Luxx4less in one tap.
            </p>
            <Button size="lg" onClick={install} className="w-full sm:w-auto">
              <Download aria-hidden /> Install Luxx4less
            </Button>
          </div>
        )
      )}

      <div role="tablist" aria-label="Your device" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface-sunk p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            id={`tab-${t.value}`}
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => setTab(t.value)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors duration-300",
              tab === t.value ? "bg-gold-tint text-champagne shadow-[0_0_0_1px_rgb(214_178_110/0.4)]" : "text-muted hover:text-fg",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            <span className="max-sm:text-xs">{t.label}</span>
          </button>
        ))}
      </div>

      {detected && here && detected.path !== "installed" && (
        <p className="text-sm text-muted">
          Looks like you&apos;re using <strong className="text-fg">{BROWSER_NAMES[detected.browser]}</strong>
          {detected.os === "ios" ? " on an iPhone or iPad" : detected.os === "android" ? " on Android" : " on a computer"}.
        </p>
      )}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "iphone" && <IosSteps otherBrowser={Boolean(here && detected?.path === "ios-other")} />}
        {tab === "android" && <AndroidSteps canPrompt={Boolean(promptEvent)} onInstall={install} firefox={Boolean(here && detected?.path === "android-firefox")} />}
        {tab === "computer" && <DesktopSteps path={here ? detected?.path : undefined} canPrompt={Boolean(promptEvent)} onInstall={install} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step sets

function IosSteps({ otherBrowser }: { otherBrowser: boolean }) {
  return (
    <Steps
      intro={
        otherBrowser
          ? "In Chrome or another browser on iOS 16.4 or later, the Share menu has the same option. If you don't see it, open this page in Safari."
          : "In Safari, three taps:"
      }
      steps={[
        { title: "Tap Share", body: "The square with an arrow, at the bottom of Safari (top right on iPad).", art: <IosShareBar /> },
        { title: "Choose “Add to Home Screen”", body: "Scroll down the list if you don't see it straight away.", art: <IosShareSheet /> },
        { title: "Tap Add", body: "The Luxx4less emblem appears on your home screen.", art: <IosAddDialog /> },
      ]}
    />
  );
}

function AndroidSteps({ canPrompt, onInstall, firefox }: { canPrompt: boolean; onInstall: () => void; firefox: boolean }) {
  return (
    <div className="grid gap-5">
      {canPrompt && (
        <Button size="lg" onClick={onInstall} className="w-full sm:w-auto">
          <Download aria-hidden /> Install Luxx4less
        </Button>
      )}
      <Steps
        intro={canPrompt ? "Or from the browser menu:" : "In Chrome, Samsung Internet or Edge:"}
        steps={[
          { title: "Open the menu", body: firefox ? "Tap ⋮ in Firefox." : "Tap ⋮ at the top right (≡ at the bottom in Samsung Internet).", art: <AndroidMenuButton /> },
          { title: "Tap “Install app”", body: "Some phones call it “Add to Home screen”.", art: <AndroidMenu /> },
          { title: "Confirm Install", body: "Luxx4less opens like an app, without the browser bars.", art: <AndroidDialog /> },
        ]}
      />
    </div>
  );
}

function DesktopSteps({ path, canPrompt, onInstall }: { path?: InstallPath; canPrompt: boolean; onInstall: () => void }) {
  if (path === "desktop-safari") {
    return (
      <Steps
        intro="In Safari 17 or later on a Mac:"
        steps={[
          { title: "Open the File menu", body: "In the menu bar at the top of the screen.", art: <MacMenu /> },
          { title: "Choose “Add to Dock”", body: "Then click Add. Luxx4less opens in its own window from the Dock.", art: <DesktopDialog label="Add to Dock" /> },
        ]}
      />
    );
  }
  return (
    <div className="grid gap-5">
      {canPrompt && (
        <Button size="lg" onClick={onInstall} className="w-full sm:w-auto">
          <Download aria-hidden /> Install Luxx4less
        </Button>
      )}
      {path === "unsupported" && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          This browser can&apos;t install web apps. Open this page in Chrome or Edge (or Safari on a Mac) and follow the steps below.
        </p>
      )}
      <Steps
        intro="In Chrome or Edge:"
        steps={[
          { title: "Click the install icon", body: "At the right end of the address bar: a screen with a down arrow (Edge says “App available”).", art: <AddressBar /> },
          { title: "Click Install", body: "Luxx4less opens in its own window and joins your apps.", art: <DesktopDialog label="Install" /> },
        ]}
      />
    </div>
  );
}

function InAppNotice({ os }: { os: Detection["os"] }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-warning/35 bg-warning-tint p-5">
      <p className="flex items-center gap-2 font-semibold">
        <ExternalLink className="size-4 text-warning" aria-hidden /> Open this page in your browser first
      </p>
      <p className="text-sm leading-6">
        You&apos;re inside Facebook, Messenger, Instagram or another app, and apps can&apos;t install websites. Tap <strong>⋯</strong> (or ⋮) and
        choose <strong>{os === "ios" ? "Open in Safari" : "Open in Chrome"}</strong> or “Open in browser”, then come back to this page.
      </p>
    </div>
  );
}

function Steps({ intro, steps }: { intro: string; steps: { title: string; body: string; art: ReactNode }[] }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">{intro}</p>
      <ol className={cn("grid gap-4", steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {steps.map((s, i) => (
          <li key={s.title} className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="grid h-48 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_30%,#2b2138,#120c19_80%)]" aria-hidden>
              {s.art}
            </div>
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-gold-large/50 font-display text-sm text-champagne tabular">{i + 1}</span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ illustrations (CSS + inline SVG only)

/** A soft gold halo marking the thing to tap. */
function Target({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <span className="absolute -inset-2 animate-ping rounded-full bg-champagne/25 motion-reduce:animate-none" />
      <span className="absolute -inset-1.5 rounded-full ring-2 ring-champagne" />
      {children}
    </span>
  );
}

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative h-56 w-32 translate-y-8 rounded-[1.6rem] border border-white/15 bg-[#0f0a15] p-1.5 shadow-[0_20px_40px_-20px_black]", className)}>
      <div className="relative size-full overflow-hidden rounded-[1.25rem] bg-[#1b1424]">
        <div className="absolute top-1.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-black/80" />
        {children}
      </div>
    </div>
  );
}

function PageLines() {
  return (
    <div className="grid gap-1.5 px-3 pt-8">
      <div className="h-2 w-12 rounded bg-champagne/60" />
      <div className="h-6 w-20 rounded bg-white/10" />
      <div className="h-1.5 w-full rounded bg-white/10" />
      <div className="h-1.5 w-4/5 rounded bg-white/10" />
    </div>
  );
}

function IosShareBar() {
  return (
    <Phone>
      <PageLines />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-white/10 bg-[#241b2e] px-2 py-2.5 text-white/50">
        <span className="text-[10px]">‹</span>
        <span className="text-[10px]">›</span>
        <Target>
          <Share className="size-3.5 text-champagne" />
        </Target>
        <span className="size-2.5 rounded-sm border border-white/40" />
      </div>
    </Phone>
  );
}

function IosShareSheet() {
  return (
    <Phone>
      <div className="absolute inset-x-0 bottom-0 grid gap-1 rounded-t-xl bg-[#2a2134] p-2 text-[8px] text-white/70">
        {["Copy", "Add to Reading List", "Add Bookmark"].map((l) => (
          <div key={l} className="rounded bg-white/5 px-2 py-1.5">
            {l}
          </div>
        ))}
        <div className="flex items-center justify-between rounded bg-gold-tint px-2 py-1.5 font-semibold text-champagne ring-1 ring-champagne">
          Add to Home Screen <span className="size-2.5 rounded-sm border border-champagne" />
        </div>
        <div className="rounded bg-white/5 px-2 py-1.5">Markup</div>
      </div>
    </Phone>
  );
}

function IosAddDialog() {
  return (
    <Phone>
      <div className="absolute inset-x-0 top-5 flex items-center justify-between px-2 text-[8px] text-white/60">
        <span>Cancel</span>
        <span className="font-semibold text-white/80">Add to Home</span>
        <Target>
          <span className="px-0.5 font-bold text-champagne">Add</span>
        </Target>
      </div>
      <div className="absolute inset-x-2 top-12 flex items-center gap-2 rounded-lg bg-white/5 p-2">
        <Emblem detail="simple" title="" className="size-7" />
        <span className="text-[9px] text-white/80">Luxx4less</span>
      </div>
    </Phone>
  );
}

function AndroidMenuButton() {
  return (
    <Phone>
      <div className="absolute inset-x-0 top-4 flex items-center gap-1.5 px-2">
        <div className="h-4 flex-1 rounded-full bg-white/10 px-1.5 text-[7px] leading-4 text-white/50">luxx4less…</div>
        <Target>
          <MoreVertical className="size-3.5 text-champagne" />
        </Target>
      </div>
      <div className="pt-4">
        <PageLines />
      </div>
    </Phone>
  );
}

function AndroidMenu() {
  return (
    <Phone>
      <div className="absolute top-4 right-1.5 grid w-24 gap-0.5 rounded-lg bg-[#2d2438] p-1 text-[8px] text-white/70 shadow-lg">
        {["New tab", "History", "Downloads"].map((l) => (
          <div key={l} className="px-1.5 py-1">
            {l}
          </div>
        ))}
        <div className="rounded bg-gold-tint px-1.5 py-1 font-semibold text-champagne ring-1 ring-champagne">Install app</div>
        <div className="px-1.5 py-1">Settings</div>
      </div>
    </Phone>
  );
}

function AndroidDialog() {
  return (
    <Phone>
      <div className="absolute inset-x-2 top-1/3 grid gap-2 rounded-xl bg-[#2d2438] p-2.5 text-[8px] text-white/75">
        <p className="font-semibold text-white/90">Install app?</p>
        <div className="flex items-center gap-1.5">
          <Emblem detail="simple" title="" className="size-5" />
          Luxx4less
        </div>
        <div className="flex justify-end gap-2">
          <span>Cancel</span>
          <Target>
            <span className="px-0.5 font-bold text-champagne">Install</span>
          </Target>
        </div>
      </div>
    </Phone>
  );
}

function Window({ children }: { children: ReactNode }) {
  return (
    <div className="w-56 overflow-hidden rounded-lg border border-white/15 bg-[#1b1424] shadow-[0_20px_40px_-20px_black]">
      <div className="flex items-center gap-1 border-b border-white/10 bg-[#241b2e] px-2 py-1.5">
        {["#ee8078", "#e9b55a", "#6cc79a"].map((c) => (
          <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      {children}
    </div>
  );
}

function AddressBar() {
  return (
    <Window>
      <div className="flex items-center gap-1.5 p-2">
        <div className="flex h-5 flex-1 items-center rounded-full bg-white/10 px-2 text-[8px] text-white/50">luxx4less.ph</div>
        <Target>
          <svg viewBox="0 0 16 16" className="size-3.5 text-champagne" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
            <path d="M8 5v4M6.2 7.4 8 9.2l1.8-1.8M5 14h6" />
          </svg>
        </Target>
      </div>
      <PageLines />
      <div className="h-6" />
    </Window>
  );
}

function DesktopDialog({ label }: { label: string }) {
  return (
    <Window>
      <div className="grid gap-2 p-3 text-[9px] text-white/75">
        <p className="font-semibold text-white/90">{label === "Install" ? "Install app?" : "Add to Dock"}</p>
        <div className="flex items-center gap-2">
          <Emblem detail="simple" title="" className="size-6" />
          Luxx4less
        </div>
        <div className="flex justify-end gap-3">
          <span>Cancel</span>
          <Target>
            <span className="px-0.5 font-bold text-champagne">{label === "Install" ? "Install" : "Add"}</span>
          </Target>
        </div>
      </div>
    </Window>
  );
}

function MacMenu() {
  return (
    <Window>
      <div className="flex gap-3 border-b border-white/10 px-2 py-1 text-[8px] text-white/60">
        <span className="font-semibold text-white/80">Safari</span>
        <span className="rounded bg-gold-tint px-1 text-champagne ring-1 ring-champagne">File</span>
        <span>Edit</span>
        <span>View</span>
      </div>
      <div className="ml-10 grid w-28 gap-0.5 rounded-b-md bg-[#2d2438] p-1 text-[8px] text-white/70">
        <div className="px-1.5 py-0.5">New Window</div>
        <div className="px-1.5 py-0.5">Share</div>
        <div className="rounded bg-gold-tint px-1.5 py-0.5 font-semibold text-champagne">Add to Dock…</div>
      </div>
      <div className="h-10" />
    </Window>
  );
}
