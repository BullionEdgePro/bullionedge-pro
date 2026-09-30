/**
 * Single source of truth for business facts. Anything marked `confirm: true`
 * must be checked by the owner before launch (see TODO.md).
 *
 * Never put bank account numbers here or anywhere in the UI.
 */

type Confirmable<T> = { value: T; confirm: boolean };

export const brand = {
  legalName: "LUXX4LESS GOLDS AND DIAMONDS OPC",
  publicName: "Luxx4less Golds and Diamonds",
  platformName: { value: "Luxx Vault", confirm: true },
  platformFullName: { value: "Luxx Vault by Luxx4less", confirm: true },
  tagline: {
    en: "Legit gold since 2019.",
    fil: "Tunay na ginto. Verified na tao.",
  },
  established: 2019,
  location: {
    city: "Antipolo City",
    province: "Rizal",
    country: "Philippines",
    fullAddress: { value: "", confirm: true },
  },
  social: {
    facebookUrl: "https://www.facebook.com/luxx4less.phgoldsanddiamonds",
    facebookLikes: { value: 722_000, confirm: true },
    instagramHandle: "luxx4less.golds.and.diamonds",
    instagramFollowers: { value: 87_000, confirm: true },
    messengerBroadcastUrl: { value: "", confirm: true },
    lazadaStoreUrl: { value: "", confirm: true },
  },
  contact: {
    email: { value: "luxx4less.ph@gmail.com", confirm: true },
    phones: {
      admin: { value: "0917 192 5982", confirm: true },
      finance: { value: "0917 192 8792", confirm: true },
      dispatch: { value: "0917 882 9694", confirm: true },
    },
  },
} as const satisfies Record<string, unknown>;

export type { Confirmable };
