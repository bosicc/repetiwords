import 'server-only';
import { requireSuperAdmin } from './auth';
import { getPostgresPool } from './postgres';
import { readAdminOverview } from './admin-overview';
import { readAdminUsers } from './admin-users';

export async function getAdminOverview() {
  const user = await requireSuperAdmin();
  return readAdminOverview(getPostgresPool(), user);
}

export async function getAdminUsers(options) {
  const user = await requireSuperAdmin();
  return readAdminUsers(getPostgresPool(), user, options);
}
