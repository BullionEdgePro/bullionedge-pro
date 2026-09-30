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
  /** As written on the logo. */
  logoTagline: "Golds and Diamonds Jewelries",
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
    // From the owner's Facebook cover (Sep 2026).
    fullAddress: { value: "B3 L3 Mt. Banahaw St., Grand Heights, Brgy. San Roque, Antipolo City, 1870", confirm: false },
  },
  /** Physical branches, from the owner's Facebook cover (Sep 2026). */
  branches: [
    {
      name: "Antipolo Branch",
      address: "B3 L3 Mt. Banahaw St., Grand Heights, Brgy. San Roque, Antipolo City, 1870",
      main: true,
    },
    {
      name: "Ongpin Branch",
      address: "MBI Building, Ace Jewelries, Brgy. 303 Zone 29, Sta. Cruz, Manila",
      main: false,
    },
  ],
  /** The storefront sign reads "LUXX4LESS.PH". Is that the planned web domain? */
  domain: { value: "luxx4less.ph", confirm: true },
  social: {
    facebookUrl: "https://www.facebook.com/luxx4less.phgoldsanddiamonds",
    // Followers as shown on the Facebook cover (Sep 2026).
    facebookFollowers: { value: 796_000, confirm: false },
    instagramHandle: "luxx4less.golds.and.diamonds",
    instagramFollowers: { value: 87_000, confirm: true },
    messengerBroadcastUrl: { value: "", confirm: true },
    lazadaStoreUrl: { value: "", confirm: true },
    /** Other official pages, from the Facebook cover (Sep 2026). URLs to confirm. */
    otherPages: [
      { name: "Luxx4Less Jewelry by Ongpin Branch", followers: 45_000, url: { value: "", confirm: true } },
      { name: "Venus Jewelry by Luxx4less Michiko", followers: 139_000, url: { value: "", confirm: true } },
      { name: "Earth Jewelry by Luxx4Less", followers: 4_900, url: { value: "", confirm: true } },
      { name: "Mercury Jewelry by Luxx4Less", followers: 3_200, url: { value: "", confirm: true } },
    ],
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
