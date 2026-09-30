import { Badge } from "@/components/ui/badge";
import { KYC_FLAGS, flagLabel } from "@/config/kyc";

/** Flags as badges, most serious first. */
export function FlagList({ flags, empty = "No flags" }: { flags: string[]; empty?: string }) {
  if (!flags.length) return <span className="text-xs text-muted">{empty}</span>;
  const order = { high: 0, medium: 1, info: 2 } as const;
  const sorted = [...flags].sort((a, b) => order[KYC_FLAGS[a]?.severity ?? "medium"] - order[KYC_FLAGS[b]?.severity ?? "medium"]);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sorted.map((f) => {
        const sev = KYC_FLAGS[f]?.severity ?? "medium";
        return (
          <li key={f}>
            <Badge tone={sev === "high" ? "danger" : sev === "medium" ? "warning" : "neutral"}>{flagLabel(f)}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
