/**
 * Phase 0 — reference-site audit crawler.
 *
 * Renders a client-side SPA with Playwright, discovers internal routes, and for
 * every route saves full-page screenshots (1440px + 390px) plus a JSON inventory
 * of what is on the page (headings, buttons, links, forms, inputs, tables,
 * external data requests, basic accessibility gaps).
 *
 * Politeness: honours robots.txt (Disallow/Allow + Crawl-delay) for our user
 * agent and "*", and spaces page navigations at least 1 second apart.
 *
 * Usage:
 *   npm run audit:reference                      # crawls https://www.metalmarketph.com
 *   npm run audit:reference -- https://example.com --max-pages 40
 *
 * Output:
 *   audit/screenshots/<slug>-1440.png, <slug>-390.png
 *   audit/data/<slug>.json          per-route inventory
 *   audit/crawl-summary.json        sitemap + external hosts + errors
 *   audit/AUDIT-RAW.md              machine-generated notes to fold into AUDIT.md
 */
import { chromium, type Browser, type Page } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT = "Luxx4lessAuditBot/0.1 (+one-time design audit; 1 req/s)";
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, isMobile: false },
  { name: "390", width: 390, height: 844, isMobile: true },
] as const;

// Paths an SPA often hides behind buttons rather than <a href>. Each is only
// kept if it renders something different from a known-404 probe.
const SEED_PATHS = [
  "/", "/market-data", "/marketplace", "/listings", "/buy", "/sell", "/prices",
  "/calculator", "/tools", "/learn", "/education", "/resources", "/faq", "/about",
  "/contact", "/login", "/signin", "/sign-in", "/register", "/signup", "/sign-up",
  "/verify", "/verification", "/dashboard", "/account", "/profile", "/terms",
  "/privacy", "/privacy-policy", "/terms-of-service",
];
const NOT_FOUND_PROBE = "/__luxx-audit-probe-404__";

interface Args {
  base: URL;
  maxPages: number;
  outDir: string;
}

function parseArgs(argv: string[]): Args {
  let base = "https://www.metalmarketph.com";
  let maxPages = 60;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--max-pages") maxPages = Number(argv[++i] ?? maxPages);
    else if (!a.startsWith("--")) base = a;
  }
  return { base: new URL(base), maxPages, outDir: path.resolve("audit") };
}

// ---------------------------------------------------------------- robots.txt

interface RobotsRules {
  rules: { allow: boolean; path: string }[];
  crawlDelayMs: number;
}

/**
 * Fetch a plain-text file through the browser so it takes the same network
 * path (proxy, trust store) as the pages themselves.
 */
async function fetchText(browser: Browser, url: URL): Promise<{ status: number; text: string } | null> {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  try {
    const res = await context.newPage().then((p) => p.goto(url.toString(), { timeout: 30_000 }));
    return res ? { status: res.status(), text: await res.text() } : null;
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

/** RFC 9309: 4xx means no restrictions; unreachable or 5xx means don't crawl. */
async function loadRobots(browser: Browser, base: URL): Promise<RobotsRules> {
  const res = await fetchText(browser, new URL("/robots.txt", base));
  if (!res || res.status >= 500) throw new Error("robots.txt is unreachable, so the crawl is not allowed to proceed.");
  if (res.status >= 400) return { rules: [], crawlDelayMs: 0 };
  const text = res.text;
  const empty: RobotsRules = { rules: [], crawlDelayMs: 0 };

  // Group lines by user-agent; prefer a group naming us, else "*".
  const groups: { agents: string[]; lines: [string, string][] }[] = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], lines: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      current?.lines.push([key, value]);
      lastWasAgent = false;
    }
  }
  const ours = groups.find((g) => g.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().includes(a)));
  const group = ours ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return empty;

  const result: RobotsRules = { rules: [], crawlDelayMs: 0 };
  for (const [key, value] of group.lines) {
    if (key === "disallow" && value) result.rules.push({ allow: false, path: value });
    if (key === "allow" && value) result.rules.push({ allow: true, path: value });
    if (key === "crawl-delay") result.crawlDelayMs = Math.max(0, Number(value) * 1000 || 0);
  }
  return result;
}

function robotsPatternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** Longest matching rule wins; ties go to Allow (RFC 9309). */
function isAllowed(robots: RobotsRules, pathname: string): boolean {
  let best: { allow: boolean; len: number } | undefined;
  for (const r of robots.rules) {
    if (!robotsPatternToRegex(r.path).test(pathname)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}

// ---------------------------------------------------------------- helpers

function slugFor(pathname: string): string {
  const s = pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
  return s || "home";
}

function normalise(href: string, base: URL): string | undefined {
  try {
    const u = new URL(href, base);
    if (u.origin !== base.origin) return undefined;
    if (/\.(png|jpe?g|webp|avif|gif|svg|ico|pdf|zip|mp4|webm|json|xml|txt|css|js)$/i.test(u.pathname)) return undefined;
    const p = u.pathname.replace(/\/+$/, "") || "/";
    return p;
  } catch {
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Throttle {
  private last = 0;
  constructor(private readonly minGapMs: number) {}
  async wait(): Promise<void> {
    const gap = Date.now() - this.last;
    if (gap < this.minGapMs) await sleep(this.minGapMs - gap);
    this.last = Date.now();
  }
}

const CONSENT_BUTTON = /^\s*(i agree|agree|accept|accept all|got it|ok(ay)?|continue)\s*$/i;

/** Click through a blocking consent/disclaimer dialog so the page underneath can be captured. */
async function dismissConsent(page: Page): Promise<string | null> {
  const button = page.getByRole("button", { name: CONSENT_BUTTON }).first();
  if (!(await button.isVisible().catch(() => false))) return null;
  const label = (await button.textContent())?.trim() ?? "consent";
  await button.click().catch(() => {});
  await page.waitForTimeout(400);
  return label;
}

/**
 * Scroll-reveal libraries leave off-screen content at an inline
 * "opacity: 0; transform: ..." until it enters the viewport, which a
 * full-page screenshot never triggers. Show it as a visitor would see it.
 */
const REVEAL_OVERRIDE = `[style*="opacity: 0"][style*="transform"] { opacity: 1 !important; transform: none !important; }`;

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Trigger lazy-loaded sections, then return to the top for the screenshot.
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 250));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

// ---------------------------------------------------------------- inventory

interface Inventory {
  url: string;
  title: string;
  metaDescription: string | null;
  lang: string | null;
  headings: { level: number; text: string }[];
  buttons: string[];
  links: { text: string; href: string }[];
  forms: { fields: { tag: string; type: string | null; name: string | null; label: string | null; required: boolean }[]; submit: string | null }[];
  selects: { label: string | null; options: string[] }[];
  tables: { caption: string | null; headers: string[]; rows: number }[];
  images: { total: number; missingAlt: number };
  a11y: { unlabeledInputs: number; iconOnlyButtons: number; headingSkips: number; hasMainLandmark: boolean };
  textSample: string;
}

async function collectInventory(page: Page): Promise<Inventory> {
  return page.evaluate(() => {
    const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const labelFor = (el: Element): string | null => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return (
        el.getAttribute("aria-label") ||
        txt(byFor) ||
        txt(el.closest("label")) ||
        el.getAttribute("placeholder") ||
        null
      );
    };

    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
      level: Number(h.tagName[1]),
      text: txt(h).slice(0, 160),
    }));
    let headingSkips = 0;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i]!.level - headings[i - 1]!.level > 1) headingSkips++;
    }

    const buttonEls = [...document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')];
    const buttons = [...new Set(buttonEls.map((b) => txt(b) || b.getAttribute("aria-label") || (b as HTMLInputElement).value || "(icon)"))];

    const forms = [...document.querySelectorAll("form")].map((f) => ({
      fields: [...f.querySelectorAll("input, select, textarea")]
        .filter((i) => (i as HTMLInputElement).type !== "hidden")
        .map((i) => ({
          tag: i.tagName.toLowerCase(),
          type: i.getAttribute("type"),
          name: i.getAttribute("name"),
          label: labelFor(i),
          required: (i as HTMLInputElement).required,
        })),
      submit: txt(f.querySelector('button[type="submit"], input[type="submit"], button:not([type])')) || null,
    }));

    const inputs = [...document.querySelectorAll("input, select, textarea")].filter(
      (i) => (i as HTMLInputElement).type !== "hidden",
    );

    return {
      url: location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
      lang: document.documentElement.getAttribute("lang"),
      headings,
      buttons,
      links: [...document.querySelectorAll("a[href]")].map((a) => ({
        text: txt(a).slice(0, 80) || a.getAttribute("aria-label") || "(no text)",
        href: (a as HTMLAnchorElement).href,
      })),
      forms,
      selects: [...document.querySelectorAll("select")].map((s) => ({
        label: labelFor(s),
        options: [...s.querySelectorAll("option")].map((o) => txt(o)).slice(0, 30),
      })),
      tables: [...document.querySelectorAll("table")].map((t) => ({
        caption: txt(t.querySelector("caption")) || null,
        headers: [...t.querySelectorAll("th")].map((th) => txt(th)),
        rows: t.querySelectorAll("tbody tr").length,
      })),
      images: {
        total: document.images.length,
        missingAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
      },
      a11y: {
        unlabeledInputs: inputs.filter((i) => !labelFor(i)).length,
        iconOnlyButtons: buttonEls.filter((b) => !txt(b) && !b.getAttribute("aria-label")).length,
        headingSkips,
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
      },
      textSample: txt(document.body).slice(0, 4000),
    };
  });
}

// ---------------------------------------------------------------- crawl

class LoadError extends Error {
  constructor(readonly pathname: string) {
    super(`Could not load ${pathname}`);
  }
}

interface RouteResult {
  path: string;
  source: "start" | "link" | "seed" | "sitemap";
  status: number | null;
  slug: string;
  external: string[];
  dataRequests: string[];
  consoleErrors: string[];
  /** Label of the consent/disclaimer button clicked before capture, if any. */
  dismissedDialog: string | null;
  timings: { domContentLoadedMs: number | null; loadMs: number | null };
  inventory: Inventory;
}

async function visit(
  browser: Browser,
  base: URL,
  pathname: string,
  throttle: Throttle,
  outDir: string,
  screenshots: boolean,
): Promise<Omit<RouteResult, "source"> & { contentHash: string; discovered: string[] }> {
  const slug = slugFor(pathname);
  let result: (Omit<RouteResult, "source"> & { contentHash: string; discovered: string[] }) | undefined;

  for (const vp of screenshots ? VIEWPORTS : VIEWPORTS.slice(0, 1)) {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      deviceScaleFactor: 1,
      locale: "en-PH",
      timezoneId: "Asia/Manila",
      reducedMotion: "reduce",
    });
    // tsx/esbuild wraps named functions in __name(); functions passed to
    // page.evaluate run in the browser where that helper doesn't exist.
    await context.addInitScript("globalThis.__name = (fn) => fn;");
    const page = await context.newPage();
    const external = new Set<string>();
    const dataRequests = new Set<string>();
    const consoleErrors: string[] = [];
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (u.origin !== base.origin && u.protocol.startsWith("http")) external.add(u.host);
      if (["fetch", "xhr", "websocket", "eventsource"].includes(req.resourceType())) {
        dataRequests.add(`${req.method()} ${u.origin}${u.pathname}`);
      }
    });
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
    });

    await throttle.wait();
    const res = await page.goto(new URL(pathname, base).toString(), { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null);
    if (!res || page.url().startsWith("chrome-error://")) {
      await context.close();
      throw new LoadError(pathname);
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const dismissed = await dismissConsent(page);
    await settle(page);
    await page.addStyleTag({ content: REVEAL_OVERRIDE }).catch(() => {});
    await page.waitForTimeout(200);

    if (screenshots) {
      await page.screenshot({ path: path.join(outDir, "screenshots", `${slug}-${vp.name}.png`), fullPage: true });
    }

    if (!result) {
      const inventory = await collectInventory(page);
      const timings = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        return {
          domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadMs: nav ? Math.round(nav.loadEventEnd) : null,
        };
      });
      result = {
        path: pathname,
        status: res?.status() ?? null,
        slug,
        external: [],
        dataRequests: [],
        consoleErrors,
        dismissedDialog: dismissed,
        timings,
        inventory,
        // Digits are dropped so a live price ticker doesn't make identical pages look different.
        contentHash: createHash("sha1").update((inventory.title + inventory.textSample).replace(/[\d.,:]+/g, "")).digest("hex"),
        discovered: inventory.links.map((l) => normalise(l.href, base)).filter((p): p is string => !!p),
      };
    }
    result.external = [...new Set([...result.external, ...external])].sort();
    result.dataRequests = [...new Set([...result.dataRequests, ...dataRequests])].sort();
    await context.close();
  }
  return result!;
}

async function sitemapPaths(browser: Browser, base: URL): Promise<string[]> {
  const res = await fetchText(browser, new URL("/sitemap.xml", base));
  if (!res || res.status >= 400) return [];
  return [...res.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((m) => normalise(m[1]!, base))
    .filter((p): p is string => !!p);
}

async function main(): Promise<void> {
  const { base, maxPages, outDir } = parseArgs(process.argv.slice(2));
  await mkdir(path.join(outDir, "screenshots"), { recursive: true });
  await mkdir(path.join(outDir, "data"), { recursive: true });

  // CHROMIUM_PATH lets the script use a preinstalled browser instead of `npx playwright install`.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const skipped: { path: string; reason: string }[] = [];
  const results: RouteResult[] = [];
  try {
    const robots = await loadRobots(browser, base);
    const throttle = new Throttle(Math.max(1000, robots.crawlDelayMs));
    console.log(`Auditing ${base.origin} (max ${maxPages} routes, ${Math.max(1000, robots.crawlDelayMs)}ms between pages)`);
    await throttle.wait(); // counts the robots.txt request
    const probe = await visit(browser, base, NOT_FOUND_PROBE, throttle, outDir, false);
    const notFoundHash = probe.contentHash;

    const queue: { path: string; source: RouteResult["source"] }[] = [{ path: "/", source: "start" }];
    await throttle.wait();
    for (const p of await sitemapPaths(browser, base)) queue.push({ path: p, source: "sitemap" });
    for (const p of SEED_PATHS) queue.push({ path: p, source: "seed" });
    const seen = new Set<string>();
    const seenHashes = new Map<string, string>();

    while (queue.length && results.length < maxPages) {
      const next = queue.shift()!;
      if (seen.has(next.path)) continue;
      seen.add(next.path);
      if (!isAllowed(robots, next.path)) {
        skipped.push({ path: next.path, reason: "robots.txt" });
        continue;
      }

      console.log(`→ ${next.path}`);
      let r: Awaited<ReturnType<typeof visit>>;
      try {
        r = await visit(browser, base, next.path, throttle, outDir, true);
      } catch (err) {
        if (!(err instanceof LoadError)) throw err;
        // If the start page itself won't load, nothing after it will either.
        if (next.source === "start") throw err;
        skipped.push({ path: next.path, reason: "failed to load" });
        for (const vp of VIEWPORTS) await rm(path.join(outDir, "screenshots", `${slugFor(next.path)}-${vp.name}.png`), { force: true });
        continue;
      }
      const dupOf = seenHashes.get(r.contentHash);
      const reason =
        next.source !== "seed" ? undefined
        : r.contentHash === notFoundHash || r.status === 404 ? "renders the not-found page"
        : dupOf ? `same content as ${dupOf}`
        : undefined;
      if (reason) {
        skipped.push({ path: next.path, reason });
        for (const vp of VIEWPORTS) await rm(path.join(outDir, "screenshots", `${r.slug}-${vp.name}.png`), { force: true });
        continue;
      }
      seenHashes.set(r.contentHash, next.path);

      const { discovered, ...rest } = r;
      const route: Omit<typeof rest, "contentHash"> & { contentHash?: string } = { ...rest };
      delete route.contentHash;
      results.push({ ...route, source: next.source });
      await writeFile(path.join(outDir, "data", `${r.slug}.json`), JSON.stringify(route, null, 2));
      // Links found in the page jump ahead of the remaining seed guesses.
      const fresh = discovered.filter((p) => !seen.has(p)).map((p) => ({ path: p, source: "link" as const }));
      queue.unshift(...fresh);
    }
  } finally {
    await browser.close();
  }

  const externalHosts = [...new Set(results.flatMap((r) => r.external))].sort();
  const dataEndpoints = [...new Set(results.flatMap((r) => r.dataRequests))].sort();
  await writeFile(
    path.join(outDir, "crawl-summary.json"),
    JSON.stringify(
      {
        base: base.origin,
        crawledAt: new Date().toISOString(),
        routes: results.map((r) => ({ path: r.path, source: r.source, status: r.status, title: r.inventory.title })),
        skipped,
        externalHosts,
        dataEndpoints,
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(outDir, "AUDIT-RAW.md"), renderRaw(base, results, skipped, externalHosts, dataEndpoints));
  console.log(`Done: ${results.length} routes, ${skipped.length} skipped. See audit/AUDIT-RAW.md`);
}

function renderRaw(
  base: URL,
  results: RouteResult[],
  skipped: { path: string; reason: string }[],
  externalHosts: string[],
  dataEndpoints: string[],
): string {
  const out: string[] = [];
  out.push(`# Raw crawl notes — ${base.origin}`, "", `Crawled ${new Date().toISOString()}. Machine-generated; fold into AUDIT.md.`, "");
  out.push("## Routes", "", "| Path | Found via | Status | Title | DCL ms |", "|---|---|---|---|---|");
  for (const r of results) {
    out.push(`| \`${r.path}\` | ${r.source} | ${r.status ?? "?"} | ${r.inventory.title.replace(/\|/g, "/")} | ${r.timings.domContentLoadedMs ?? "?"} |`);
  }
  if (skipped.length) {
    out.push("", "### Skipped", "");
    for (const s of skipped) out.push(`- \`${s.path}\`: ${s.reason}`);
  }
  out.push("", "## Data sources", "", "External hosts contacted:", "");
  for (const h of externalHosts) out.push(`- ${h}`);
  out.push("", "Fetch/XHR endpoints:", "");
  for (const d of dataEndpoints) out.push(`- \`${d}\``);
  for (const r of results) {
    const inv = r.inventory;
    out.push("", `## \`${r.path}\` — ${inv.title}`, "");
    out.push(`Screenshots: \`screenshots/${r.slug}-1440.png\`, \`screenshots/${r.slug}-390.png\``, "");
    if (r.dismissedDialog) out.push(`Blocking dialog on load, dismissed with “${r.dismissedDialog}” before capture.`, "");
    if (inv.headings.length) {
      out.push("Headings:", "");
      for (const h of inv.headings) out.push(`${"  ".repeat(Math.max(0, h.level - 1))}- h${h.level}: ${h.text}`);
      out.push("");
    }
    if (inv.buttons.length) out.push(`Buttons: ${inv.buttons.map((b) => `“${b}”`).join(", ")}`, "");
    inv.forms.forEach((f, i) => {
      out.push(`Form ${i + 1} (submit: ${f.submit ?? "none"}):`, "");
      for (const fl of f.fields) out.push(`- ${fl.tag}${fl.type ? `[${fl.type}]` : ""} ${fl.label ?? fl.name ?? "(unlabelled)"}${fl.required ? " *" : ""}`);
      out.push("");
    });
    for (const s of inv.selects) out.push(`Select “${s.label ?? "?"}”: ${s.options.join(" / ")}`, "");
    for (const t of inv.tables) out.push(`Table ${t.caption ? `“${t.caption}” ` : ""}(${t.rows} rows): ${t.headers.join(" | ")}`, "");
    const a = inv.a11y;
    out.push(
      `A11y: ${inv.images.missingAlt}/${inv.images.total} images without alt · ${a.unlabeledInputs} unlabelled inputs · ${a.iconOnlyButtons} icon-only buttons without a name · ${a.headingSkips} heading-level skips · main landmark: ${a.hasMainLandmark ? "yes" : "no"} · lang: ${inv.lang ?? "missing"}`,
    );
    if (r.consoleErrors.length) out.push("", `Console errors: ${r.consoleErrors.length} (first: ${r.consoleErrors[0]})`);
  }
  return out.join("\n") + "\n";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
