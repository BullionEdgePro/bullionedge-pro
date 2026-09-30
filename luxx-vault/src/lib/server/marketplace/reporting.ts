/** Report reasons, shared by the report dialog (client) and the server action. Pure. */
export const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud attempt" },
  { value: "fake_item", label: "Fake or misdescribed item" },
  { value: "stolen_photos", label: "Stolen or copied photos" },
  { value: "off_platform", label: "Asked to pay or talk outside Luxx4less" },
  { value: "impersonation", label: "Pretending to be Luxx4less or someone else" },
  { value: "prohibited", label: "Prohibited item" },
  { value: "abuse", label: "Harassment or abuse" },
  { value: "other", label: "Something else" },
] as const;

export const REPORT_TARGET_LABEL: Record<string, string> = {
  user: "Person",
  listing: "Listing",
  buy_request: "Wanted post",
  message: "Message",
  outside_number: "Outside phone number",
};
