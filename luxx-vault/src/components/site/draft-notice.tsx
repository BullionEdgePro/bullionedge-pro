import { FormAlert } from "@/components/ui/field";

export function DraftNotice() {
  return (
    <FormAlert tone="info">
      Draft for review. This text summarises how Luxx4less works and is pending review by the company&apos;s lawyer before launch.
    </FormAlert>
  );
}
