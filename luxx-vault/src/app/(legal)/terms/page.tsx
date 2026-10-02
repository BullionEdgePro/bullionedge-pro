import type { Metadata } from "next";
import { DraftNotice } from "@/components/site/draft-notice";
import { brand } from "@/config/brand";
import { POLICY_VERSION } from "@/lib/server/policy";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-4xl">Terms</h1>
      <p className="text-sm text-muted">Version {POLICY_VERSION}</p>
      <div className="mt-6"><DraftNotice /></div>

      <p>These terms apply when you use the Luxx4less website, operated by {brand.legalName}.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older and give true information about yourself.</li>
        <li>Keep your password and one-time codes private. Luxx4less will never ask for them.</li>
        <li>One person, one account. Accounts found to be duplicated, shared or used for fraud may be suspended.</li>
      </ul>

      <h2>Buying from Luxx4less</h2>
      <p>Prices for gold follow the live market and are confirmed at checkout. Product weights, karats and certificates are stated on each item.</p>

      <h2>The marketplace</h2>
      <p>
        Buying and selling between members is open only to identity-verified accounts. Listings must be honest about metal, purity and weight, and
        payment must stay on the platform. Scams, stolen goods and fake items are banned and reported to the authorities.
      </p>
      <p>
        Listing is free. When a sale between members completes on Luxx4less, the seller pays Luxx4less a fee on the sale price, at the rate shown when listing
        and on the trade page, within the days stated there. While a fee is past due, the seller can&rsquo;t list, renew or make offers; trades already under way
        carry on. Finishing a deal outside the platform to avoid the fee breaks these terms.
      </p>

      <h2>Changes</h2>
      <p>If these terms change, we&apos;ll tell you before the new version applies to you.</p>
    </article>
  );
}
