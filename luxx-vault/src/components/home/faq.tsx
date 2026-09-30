import { JsonLd } from "@/components/tools/tool-page";

/** Original answers about buying gold safely. Kept general: no claims about prices or the shop's service levels. */
export const HOME_FAQ = [
  {
    q: "How can I tell if gold is real before I pay?",
    a: "Weigh it, look for a karat or fineness stamp, and then have it tested, because stamps are easy to fake. An XRF reading, an acid test or an electronic gold tester at a shop you trust will tell you what the metal really is. Pay only after it passes.",
  },
  {
    q: "Why is a very cheap price a warning sign?",
    a: "Real gold is always worth at least its melt value, the price of the metal alone. Nobody honest sells it for much less. Gold offered well under melt value is usually plated, filled or a lower karat than stamped. Our offer checker flags these prices for you.",
  },
  {
    q: "What do 18K, 21K and 750 mean?",
    a: "They describe purity. Karats count parts of gold in 24, so 18K is 18 parts gold in 24, or 75%. The three-digit stamp gives the same thing in parts per thousand: 750 is 75% gold, 916 is 22K and 999 is pure gold.",
  },
  {
    q: "Why is jewellery priced above the gold price per gram?",
    a: "The per-gram price is the value of the metal alone. A finished piece also carries the cost of making it and the seller's margin, so it sells above melt value. When you sell, shops pay below melt value for the same reasons in reverse.",
  },
  {
    q: "Is it safe to buy from a seller I found online?",
    a: "Keep the conversation and the payment where the seller can be identified, never send money to a number someone gives you in a chat, and meet somewhere the piece can be tested. On the Luxx4less marketplace, everyone who buys or sells has verified a government ID and a live selfie first.",
  },
] as const;

export function HomeFaq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="divide-y divide-line border-y border-line">
        {HOME_FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg text-fg marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="font-display">{f.q}</span>
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-champagne transition-transform duration-300 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="measure mt-3 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
