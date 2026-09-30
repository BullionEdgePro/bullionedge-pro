/**
 * Copy for the "Behind the counter" page. All original writing.
 *
 * Nothing here is invented about the business: names, dates and titles are
 * left blank until the owner supplies them (see TODO.md). Placeholders read
 * as deliberate, never as fake detail.
 */

/** The line that opens the page, under the storefront photo. */
export const HOUSE_INTRO = {
  eyebrow: "Behind the counter",
  headline: "Gold you can hold. People you can name.",
  body:
    "Anyone can photograph a gold bar. Fewer will show you the hands that weighed it. " +
    "This is the house behind Luxx4less: one storefront in Antipolo, one in Ongpin, " +
    "and a team that has to look every customer in the eye the next morning.",
  filipino: "Totoong tao. Totoong ginto.",
} as const;

/** Section 2 — the founder. */
export const FOUNDER = {
  eyebrow: "The founder",
  headline: "Real gold, with a name behind it.",
  /** Confirmed by the owner, 30 Sep 2026. */
  name: { value: "Lovely Joy Serrano", confirm: false },
  role: { value: "Founder", confirm: false },
  /** Only what is known: founded 2019, two open branches, on air at DZAR. No invented history. */
  body: [
    "Lovely Joy Serrano founded Luxx4less in 2019, in Antipolo. The promise has not changed since: " +
      "real gold, sold by people you can put a name to.",
    "Today there is a second counter in Ongpin, and the questions come from radio studios as well " +
      "as from customers.",
  ],
  pullQuote: {
    /** Left empty on purpose — a quote must be hers, not ours. */
    text: { value: "", confirm: true },
    attribution: { value: "", confirm: true },
  },
} as const;

/** Section 3 — the team. */
export const TEAM = {
  eyebrow: "The team",
  headline: "The people who weigh it.",
  body:
    "Appraisers, sellers and the live-selling crew. They are the ones who open the case, " +
    "set the piece on the scale and read the number out loud.",
  filipino: "Sila ang tumitimbang. Sila ang mananagot.",
  /** Each photo gets its own line, so the gallery reads as a story, not a grid. */
  frames: [
    {
      id: "team/team-portrait",
      alt: "The Luxx4less team in black, photographed together in the studio",
      caption: "The full floor, one evening in the studio.",
    },
    {
      id: "team/team-candid",
      alt: "The Luxx4less team laughing together during the studio session",
      caption: "Between takes. This is the shop most days.",
    },
    {
      id: "team/team-formal",
      alt: "Six members of the Luxx4less team in formal black",
      caption: "Appraisal, sales and live selling.",
    },
  ],
} as const;

/**
 * Section 4 — recognition. Only what is visible in the owner's own photos:
 * a radio interview and an awards night. No claim is made about winning.
 */
export const RECOGNITION = {
  eyebrow: "On the record",
  headline: "Asked to explain gold, in public.",
  body:
    "Trust in this trade is built in the open. These are rooms where the questions " +
    "came from someone else's microphone.",
  items: [
    {
      id: "owner/owner-radio-dzar-interview",
      alt: "The founder being interviewed in the DZAR Sonshine Radio studio, jewellery trays on the desk",
      title: "DZAR Sonshine Radio 1026 Manila",
      note: "Invited on air with the trays open — Pa-Talk.",
    },
    {
      id: "owner/owner-radio-dzar-hosts",
      alt: "The founder with the two DZAR Sonshine Radio hosts in the studio",
      title: "In studio",
      note: "With the programme's hosts after the interview.",
    },
    {
      id: "owner/owner-awards-night",
      alt: "The founder on the red carpet at the Maharlikang Filipino Awards",
      title: "Maharlikang Filipino Awards",
      note: "On the carpet, representing the shop.",
    },
  ],
} as const;

/** Section 5 — guests. Every face here needs that person's permission first. */
export const VISITS = {
  /**
   * Off until each guest has agreed to be shown (owner, 30 Sep 2026). Turn on
   * only after written permission from every identifiable person on the wall.
   */
  published: false,
  eyebrow: "Through our doors",
  headline: "Creators and regulars, at the counter.",
  body:
    "Vloggers and long-time customers who came to the counter, picked something up " +
    "and let us take the photo.",
} as const;

/** The closing invitation. */
export const HOUSE_OUTRO = {
  headline: "Come and weigh it yourself.",
  body: "Both branches are open to walk-ins. Bring a piece to appraise, or just come and look.",
} as const;
