import type { Metadata } from "next";
import { DraftNotice } from "@/components/site/draft-notice";
import { brand } from "@/config/brand";
import { POLICY_VERSION } from "@/lib/server/policy";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  const main = brand.branches.find((b) => b.main);
  return (
    <article>
      <h1 className="text-4xl">Privacy Notice</h1>
      <p className="text-sm text-muted">Version {POLICY_VERSION}</p>
      <div className="mt-6"><DraftNotice /></div>

      <p>
        {brand.legalName} (&ldquo;Luxx4less&rdquo;, &ldquo;we&rdquo;) runs this website. We handle your personal information under the Data Privacy Act
        of 2012 (Republic Act No. 10173) and its implementing rules.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and password (stored only as a one-way Argon2id hash).</li>
        <li>Security records: when and from which device and network address you sign in, and the security settings you turn on.</li>
        <li>Your consents: what you agreed to, when, and from where.</li>
        <li>Later, when you choose to verify: your mobile number, government ID and a selfie check. ID images and face data are sensitive personal information and are asked for separately, with their own consent.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To create and protect your account, and to stop fraud and scams on the marketplace.</li>
        <li>To process orders, payments, deliveries and after-sales service.</li>
        <li>To meet legal duties, including record-keeping rules for dealers in precious metals and stones.</li>
        <li>To send you offers and price alerts, only if you said yes. You can stop these at any time.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only service providers who help us run Luxx4less (hosting, email delivery, payments, identity checks and couriers), under contracts that
        protect your data, and government authorities when the law requires it. We never sell your personal information.
      </p>

      <h2>How long we keep it</h2>
      <p>
        As long as your account is open, then only as long as the law requires (for example, transaction records for five years). Identity documents
        are deleted on a set schedule once they are no longer needed.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, download or delete your information, object to its use, or withdraw consent. You can also complain to the
        National Privacy Commission.
      </p>

      <h2>Contact our Data Protection Officer</h2>
      <p>
        Email: {brand.contact.email.value}
        {main ? ` · ${main.address}` : ""}
      </p>
    </article>
  );
}
