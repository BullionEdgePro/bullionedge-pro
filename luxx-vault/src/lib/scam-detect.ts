/**
 * Anti-scam detector for marketplace chat (brief §9). Pure and synchronous so
 * it can run on the server when a message is stored and in tests.
 *
 * It detects, it does not block: a flagged message is still delivered, and
 * both people see a calm warning under it explaining the risk. The patterns
 * cover English and the Filipino/Taglish phrasing scammers actually use
 * ("padala", "bayad muna", "send sa GCash"), but every word shown to people
 * stays English.
 */

export const SCAM_FLAGS = ["phone_number", "bank_account", "off_platform_payment", "external_link", "pressure"] as const;
export type ScamFlag = (typeof SCAM_FLAGS)[number];

export type ScamMatch = { flag: ScamFlag; text: string };
export type ScamResult = { flags: ScamFlag[]; matches: ScamMatch[] };

/** What each flag means, for the warning under a message. */
export const SCAM_FLAG_COPY: Record<ScamFlag, { title: string; body: string }> = {
  phone_number: {
    title: "A phone number was shared",
    body: "Keep the conversation here. Scammers move people to text or calls, where there is no record and no protection.",
  },
  bank_account: {
    title: "Bank or e-wallet details were shared",
    body: "Never send money to a personal GCash, Maya or bank account. Pay only through the protected hold on the trade page.",
  },
  off_platform_payment: {
    title: "Payment outside Luxx4less was suggested",
    body: "Deposits, reservation fees and direct transfers are the most common gold scam. Money paid outside the platform cannot be recovered.",
  },
  external_link: {
    title: "A link or outside contact was shared",
    body: "Be careful with links and with moving the chat to Messenger, WhatsApp, Telegram or Viber. Luxx4less cannot see or protect those chats.",
  },
  pressure: {
    title: "Pressure to decide quickly",
    body: "“Today only” and “many buyers waiting” are pressure tactics. A genuine seller will give you time to check the item.",
  },
};

// ------------------------------------------------------------------ helpers

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

/** Lowercase, and turn spelled-out digits ("zero nine one seven…") into digits so they are caught too. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => NUMBER_WORDS[w] ?? w);
}

/** Runs of digits that may be broken up by spaces, dots, dashes, slashes or brackets. */
const DIGIT_RUN = /\+?\(?\d(?:[\s.\-/()]{0,3}\d){6,22}/g;

type DigitRun = { raw: string; digits: string; index: number };

function digitRuns(text: string): DigitRun[] {
  const out: DigitRun[] = [];
  for (const m of text.matchAll(DIGIT_RUN)) {
    out.push({ raw: m[0], digits: m[0].replace(/\D/g, ""), index: m.index ?? 0 });
  }
  return out;
}

/** Philippine mobile: 09XX XXX XXXX, +63 9XX XXX XXXX, 63 9XX…, or 9XX XXX XXXX. */
function isPhMobile(digits: string): boolean {
  return /^(?:0|63)?9\d{9}$/.test(digits);
}

const BANK_WORDS =
  /\b(g-?cash|gcash|maya|paymaya|gotyme|go tyme|seabank|shopeepay|grabpay|coins\.ph|bdo|bpi|metrobank|metro bank|eastwest|east west|landbank|land bank|pnb|security ?bank|union ?bank|rcbc|china ?bank|psbank|ps bank|ucpb|aub|robinsons bank|cimb|tonik|ing|account|acct|acc(?:t)? ?(?:no|num|number|#)|a\/c|savings|checking|card ?(?:no|number)|debit|credit card|iban|swift)\b/;

function nearBankWord(text: string, index: number, length: number): boolean {
  const from = Math.max(0, index - 48);
  const to = Math.min(text.length, index + length + 48);
  return BANK_WORDS.test(text.slice(from, to));
}

// ------------------------------------------------------------------ phrase patterns

const OFF_PLATFORM_PAYMENT: RegExp[] = [
  // "pay outside", "pay me directly", "pay off the platform", "outside the app"
  /\bpay(?:ment)?\s+(?:me\s+)?(?:outside|directly|direct|off[\s-]?(?:the\s+)?(?:platform|site|app))\b/,
  /\b(?:outside|off)\s+(?:of\s+)?(?:the\s+)?(?:platform|site|app|luxx4less|escrow)\b/,
  // "send to my GCash", "send the payment via BDO", "transfer to my bank"
  /\b(?:send|transfer|wire|deposit|remit)\s+(?:it\s+|the\s+(?:payment|money|amount|balance)\s+|(?:the\s+)?(?:payment|money|pera)\s+|mo\s+|na\s+|lang\s+)*(?:to|thru|through|via|sa|into|in)\s+(?:my\s+|our\s+|aking\s+|ko\s+)?(?:g-?cash|maya|paymaya|bank|account|bdo|bpi|metrobank|eastwest|landbank|pnb|unionbank|rcbc|palawan|cebuana|western union|m\s?lhuillier)/,
  /\b(?:g-?cash|maya|paymaya)\s+(?:mo|ko|me|na\s+lang|lang|muna|first)\b/,
  // deposits and advance payments
  /\b(?:deposit|down\s?payment|dp|reservation\s+fee|reserve\s+fee|advance\s+payment|partial\s+payment)\s+(?:first|muna|before|to\s+reserve|para\s+ma-?reserve)\b/,
  /\bpay\s+(?:first|in\s+advance|upfront|up\s+front|before\s+(?:shipping|i\s+ship|meet))\b/,
  /\b(?:advance|upfront)\s+payment\b/,
  /\bbayad\s+muna\b/,
  /\bbayaran\s+(?:mo\s+)?(?:na\s+)?muna\b/,
  /\bhulog\s+(?:mo\s+)?(?:na\s+)?(?:lang|muna)\b/,
  /\b(?:padala|ipadala|magpadala)\s+(?:mo\s+|na\s+|lang\s+|muna\s+|ka\s+)*(?:ng\s+|ang\s+)?(?:pera|bayad|payment|pambayad|downpayment|deposit|sa\s+(?:g-?cash|maya|bank|account))\b/,
  /\bpadala\s+muna\b/,
  /\bpera\s+padala\b/,
  /\b(?:palawan\s+(?:express|pera\s+padala)|cebuana(?:\s+lhuillier)?|m\s?lhuillier|western\s+union|lbc\s+(?:padala|remit))\b/,
  // skipping the protection
  /\b(?:skip|avoid|bypass|no\s+need\s+for|don'?t\s+use|wag\s+na(?:\s+ang)?|huwag\s+na)\s+(?:the\s+)?(?:escrow|hold|protected\s+hold|platform|fees?|site|app)\b/,
  /\b(?:diretso|direct)\s+(?:na\s+lang\s+)?(?:sa\s+akin|sakin|deal|transaction|payment)\b/,
  /\b(?:usdt|bitcoin|btc|crypto)\s+(?:payment|transfer|only)\b/,
];

const EXTERNAL_LINK: RegExp[] = [
  /\bhttps?:\/\/\S+/,
  /\bwww\.\S+/,
  /\b(?:m\.me|wa\.me|t\.me|fb\.me|fb\.com|facebook\.com|messenger\.com|instagram\.com|telegram\.me|viber\.com|bit\.ly|tinyurl\.com|linktr\.ee|shp\.ee)\/?\S*/,
  /\bviber:\/\//,
  // bare domains: something.com / .ph / .net …
  /\b[a-z0-9-]{2,}\.(?:com|net|org|ph|com\.ph|io|co|xyz|shop|store|link|online|site)\b/,
  // moving the chat elsewhere
  /\b(?:add|message|msg|pm|dm|chat|contact|text|call|reach|find|hmu|search)\s+(?:me|us|mo\s+ako|ako|kami)?\s*(?:on|sa|at|via|thru|through|in)\s+(?:my\s+)?(?:fb|facebook|messenger|whats\s?app|telegram|viber|we\s?chat|ig|instagram|insta|signal|line|tiktok)\b/,
  /\b(?:my|aking)\s+(?:fb|facebook|messenger|whats\s?app|telegram|viber|we\s?chat|ig|instagram|signal)\s*(?:is|number|no\.?|account|acct|:|name)/,
  /\b(?:whats\s?app|telegram|viber|we\s?chat|signal)\s+(?:me|ako|mo\s+ako|na\s+lang|tayo)\b/,
  /\b(?:text|call|txt|tawag|tawagan)\s+(?:mo\s+)?(?:na\s+lang\s+)?(?:me|ako|kita)\b/,
  /\b(?:pm|dm)\s+(?:mo\s+)?(?:na\s+lang\s+)?(?:ako|me)\b/,
];

const PRESSURE: RegExp[] = [
  /\btoday\s+only\b/,
  /\bngayon\s+na\b/,
  /\b(?:many|lots\s+of|a\s+lot\s+of|several|other|maraming|madaming|ibang|iba\s+pang)\s+(?:other\s+)?(?:buyers?|bidders?|interested|nag-?(?:i)?inquire|nag-?aabang|may\s+gusto|nagtatanong)\b/,
  /\b(?:someone|somebody|another\s+buyer|another\s+person|may\s+iba)\s+(?:else\s+)?(?:is\s+)?(?:also\s+)?(?:interested|waiting|wants|asking|nag-?aabang|kukuha)\b/,
  /\b(?:buyers?|bidders?)\s+(?:are\s+)?(?:waiting|lined\s+up|in\s+line)\b/,
  /\blast\s+(?:piece|one|stock|chance|slot)\b/,
  /\bfirst\s+come,?\s+first\s+serve(?:d)?\b/,
  /\b(?:price|offer|deal|discount)\s+(?:is\s+)?(?:only\s+)?(?:valid|good)\s+(?:only\s+)?(?:today|until|for\s+(?:today|\d+\s+(?:hours?|mins?|minutes?)))\b/,
  /\blimited\s+time\b/,
  /\b(?:going|selling)\s+fast\b/,
  /\bmauubusan\b|\bmauunahan\b|\bubos\s+na\b/,
  /(?<!\bno\s)(?<!\bwalang\s)(?<!\bdon'?t\s)\b(?:hurry|bilisan|dalian)\b/,
  /\b(?:decide|pay|confirm)\s+(?:now|right\s+now|immediately|within\s+(?:the\s+)?(?:hour|\d+\s+(?:mins?|minutes?)))\b/,
];

function firstMatch(patterns: RegExp[], text: string): string | null {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[0];
  }
  return null;
}

/** Links to our own site are expected (a listing shared in chat) and are not flagged. */
function stripOwnLinks(text: string): string {
  return text.replace(/\b(?:https?:\/\/)?(?:www\.)?luxx4less\.(?:ph|com)(?:\/\S*)?/g, " ");
}

/**
 * Scan one chat message. Returns the distinct flags (in a stable order) and
 * the text that triggered each one, for staff review.
 */
export function detectScam(input: string): ScamResult {
  const text = stripOwnLinks(normalise(input ?? ""));
  const matches: ScamMatch[] = [];
  const add = (flag: ScamFlag, t: string) => {
    if (!matches.some((m) => m.flag === flag)) matches.push({ flag, text: t.trim() });
  };

  for (const run of digitRuns(text)) {
    const phone = isPhMobile(run.digits);
    if (phone) add("phone_number", run.raw);
    const bankish = nearBankWord(text, run.index, run.raw.length);
    // A GCash or Maya number is a phone number; next to a wallet or bank word it is also a payment account.
    if (bankish && (phone || (run.digits.length >= 10 && run.digits.length <= 19))) add("bank_account", run.raw);
  }

  const payment = firstMatch(OFF_PLATFORM_PAYMENT, text);
  if (payment) add("off_platform_payment", payment);
  const link = firstMatch(EXTERNAL_LINK, text);
  if (link) add("external_link", link);
  const pressure = firstMatch(PRESSURE, text);
  if (pressure) add("pressure", pressure);

  const flags = SCAM_FLAGS.filter((f) => matches.some((m) => m.flag === f));
  return { flags, matches: flags.map((f) => matches.find((m) => m.flag === f)!) };
}

/** Narrow unknown stored strings back to known flags (the column is a plain text array). */
export function knownFlags(values: readonly string[]): ScamFlag[] {
  return SCAM_FLAGS.filter((f) => values.includes(f));
}
