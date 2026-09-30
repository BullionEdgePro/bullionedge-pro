"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roleAccess } from "@/config/access";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Password was right and 2FA is on: continue on the code step.
      onTwoFactorRedirect: () => {
        // Runs outside React (no router here); a full navigation is intended.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/sign-in/two-factor";
      },
    }),
    passkeyClient(),
    adminClient({ ac, roles: roleAccess }),
  ],
});
