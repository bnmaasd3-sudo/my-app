import "server-only";
import type { createServiceClient } from "./admin";

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * Returns the sign-in account for an email, creating it if needed. Readers
 * only use email codes, so an account that already existed gets a random
 * password: someone who signed up with the buyer's email first cannot use it.
 */
export async function findOrCreateAccount(service: ServiceClient, email: string): Promise<string> {
  const created = await service.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      const reset = await service.auth.admin.updateUserById(user.id, {
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
      });
      if (reset.error) throw reset.error;
      return user.id;
    }
    if (data.users.length < 1000) break;
  }
  throw created.error ?? new Error("Could not create the sign-in account");
}
