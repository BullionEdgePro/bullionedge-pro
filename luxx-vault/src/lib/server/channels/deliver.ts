import "server-only";
import type { NotifyInput } from "../notify";

/**
 * External delivery (email, Viber, Messenger) for notifications.
 * PLACEHOLDER: the alerts track replaces this with real adapters. Returns the
 * channels that actually delivered.
 */
export async function deliverExternal(
  _userId: string,
  _input: NotifyInput,
  _channels: ("email" | "viber" | "messenger")[],
): Promise<string[]> {
  return [];
}
