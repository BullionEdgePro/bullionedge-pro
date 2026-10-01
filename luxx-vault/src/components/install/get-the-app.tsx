import Link from "next/link";
import { Apple, Download, ShieldCheck, Smartphone } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ANDROID_APP } from "@/config/app-release";

const STEPS = [
  { title: "Download", body: "Tap the gold button. The file is small, about 1.4 MB." },
  { title: "Allow the install", body: "Android asks once to allow installs from your browser. Tap Settings, switch it on, then go back." },
  { title: "Install", body: "Tap Install. If Play Protect says it doesn't recognise the app yet, choose Install anyway: it's new, not unsafe." },
  { title: "Open Luxx4less", body: "It opens full screen with your account, alerts and prices, and updates itself with the site." },
];

/**
 * The two ways onto a phone: a real Android app file, and Add to Home Screen
 * for iPhone (Apple only allows apps through the App Store). Owner's choice,
 * 1 Oct 2026.
 */
export function GetTheApp() {
  const mb = (ANDROID_APP.sizeBytes / 1_048_576).toFixed(1);
  return (
    <section id="download" aria-labelledby="get-app" className="grid scroll-mt-44 gap-6">
      <h2 id="get-app" className="text-2xl sm:text-3xl">
        Get the app
      </h2>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Android */}
        <div className="relative overflow-hidden rounded-3xl border border-champagne/30 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(214_178_110/0.16),transparent_60%)] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-velvet shadow-[0_12px_30px_-14px_#A8823F] ring-1 ring-champagne/40">
              <Emblem title="" className="size-12" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-champagne">
                <Smartphone className="size-4" aria-hidden /> Android
              </p>
              <p className="mt-1 font-display text-2xl text-fg">Luxx4less for Android</p>
              <p className="mt-1 text-sm text-muted">
                Version {ANDROID_APP.version} · {mb} MB · {ANDROID_APP.minAndroid} or newer
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <a href={ANDROID_APP.href} download="Luxx4less.apk" type="application/vnd.android.package-archive">
                <Download aria-hidden /> Download for Android
              </a>
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="size-4 text-success" aria-hidden /> Signed by Luxx4less, only from this page
            </span>
          </div>

          <ol className="mt-7 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-champagne/50 font-display text-sm text-champagne tabular">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-sm text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <details className="mt-6 text-xs text-muted">
            <summary className="cursor-pointer font-semibold text-fg/80">Check the file is genuine</summary>
            <p className="mt-2">
              Only download the app from this page on luxx4less.vercel.app. Anyone sending you a Luxx4less app file by chat or email is not us. The
              file&apos;s SHA-256 fingerprint is:
            </p>
            <p className="mt-1 font-mono text-[0.7rem] break-all text-fg/80">{ANDROID_APP.sha256}</p>
          </details>
        </div>

        {/* iPhone */}
        <div className="grid content-start gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-champagne">
            <Apple className="size-4" aria-hidden /> iPhone and iPad
          </p>
          <p className="font-display text-2xl text-fg">Add it from Safari</p>
          <p className="text-sm text-muted">
            Apple only allows app downloads through the App Store, so on iPhone you add Luxx4less from Safari instead. It sits on your home screen
            and opens full screen, just like an app.
          </p>
          <ol className="grid gap-2 text-sm">
            <li>
              1. Open <span className="font-semibold">luxx4less.vercel.app</span> in Safari.
            </li>
            <li>
              2. Tap <span className="font-semibold">Share</span>, then <span className="font-semibold">Add to Home Screen</span>.
            </li>
            <li>
              3. Tap <span className="font-semibold">Add</span>.
            </li>
          </ol>
          <Link href="#how" className="text-sm font-semibold text-gold hover:text-champagne">
            See the steps with pictures
          </Link>
        </div>
      </div>
    </section>
  );
}
