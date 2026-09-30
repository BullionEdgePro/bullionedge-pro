import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * What each role may do through Better Auth's user/session admin endpoints.
 * Least privilege: only super_admin can impersonate, delete accounts or set
 * passwords. Shared by the auth server and client. Feature permissions
 * (listings, KYC review, payouts) are enforced separately with requireRole().
 */
export const ac = createAccessControl(defaultStatements);

const none = ac.newRole({ user: [], session: [] });

export const roleAccess = {
  buyer: none,
  seller: none,
  reseller: none,
  support: ac.newRole({ user: ["list", "get"], session: ["list", "revoke"] }),
  kyc_reviewer: ac.newRole({ user: ["list", "get"], session: [] }),
  admin: ac.newRole({ user: ["create", "list", "get", "update", "set-role", "ban"], session: ["list", "revoke", "delete"] }),
  super_admin: ac.newRole({ ...defaultStatements }),
};
