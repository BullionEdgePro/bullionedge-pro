"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert, Input, Select } from "@/components/ui/field";
import { banCustomer, setStaffRole, unbanCustomer, type StaffActionState } from "./actions";

function Result({ state }: { state: StaffActionState }) {
  if (!state) return null;
  return state.ok ? <FormAlert tone="success">{state.message ?? "Done."}</FormAlert> : <FormAlert>{state.error}</FormAlert>;
}

export function BanForm({ userId, banned }: { userId: string; banned: boolean }) {
  const [banState, ban, banning] = useActionState(banCustomer, null);
  const [unbanState, unban, unbanning] = useActionState(unbanCustomer, null);
  if (banned) {
    return (
      <form action={unban} className="grid gap-3">
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" variant="secondary" size="sm" disabled={unbanning} className="justify-self-start">
          {unbanning ? "Lifting…" : "Lift the ban"}
        </Button>
        <Result state={unbanState} />
      </form>
    );
  }
  return (
    <form action={ban} className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <Input name="reason" required minLength={10} maxLength={500} placeholder="Reason (kept in the audit log)" aria-label="Reason for the ban" />
      <div className="flex flex-wrap items-center gap-3">
        <Select name="days" defaultValue="0" aria-label="Ban length" className="h-10 w-auto text-sm">
          <option value="0">Until lifted</option>
          <option value="1">1 day</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </Select>
        <Button type="submit" variant="danger" size="sm" disabled={banning}>
          {banning ? "Banning…" : "Ban and sign out"}
        </Button>
      </div>
      <Result state={banState} />
    </form>
  );
}

const STAFF = [
  { role: "support", label: "Support", note: "Reports, disputes, listings" },
  { role: "kyc_reviewer", label: "Verification reviewer", note: "ID and seller checks" },
  { role: "admin", label: "Admin", note: "Everything except other admins (super admin only)" },
] as const;

export function StaffRoles({ userId, roles }: { userId: string; roles: readonly string[] }) {
  const [state, action, pending] = useActionState(setStaffRole, null);
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {STAFF.map((s) => {
          const has = roles.includes(s.role);
          return (
            <li key={s.role} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.note}</span>
              </span>
              <form action={action}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="role" value={s.role} />
                <input type="hidden" name="grant" value={has ? "false" : "true"} />
                <Button type="submit" size="sm" variant={has ? "ghost" : "secondary"} disabled={pending}>
                  {has ? "Remove" : "Grant"}
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
      <Result state={state} />
    </div>
  );
}
