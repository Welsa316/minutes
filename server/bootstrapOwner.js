import { query } from './db/index.js';

// Migrate the legacy single-user setup into the users table on startup.
// The old login is one env account (ADMIN_USERNAME + ADMIN_PASSWORD_HASH);
// this creates a real user row for it and assigns all pre-existing data to it,
// so nothing is orphaned and the owner keeps logging in with the same creds.
// Idempotent — safe to run on every boot.
export async function bootstrapOwner() {
  const adminUser = process.env.ADMIN_USERNAME;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminUser || !adminHash) return; // fresh install with no legacy owner

  const existing = await query('SELECT id FROM users WHERE email = $1', [adminUser]);
  let ownerId;
  if (existing.rows[0]) {
    ownerId = existing.rows[0].id;
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [adminHash, ownerId]);
  } else {
    ownerId = (await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      [adminUser, adminHash, adminUser],
    )).rows[0].id;
  }

  // Claim any unowned rows for the legacy owner.
  await query('UPDATE workspaces  SET user_id = $1 WHERE user_id IS NULL', [ownerId]);
  await query('UPDATE todos       SET user_id = $1 WHERE user_id IS NULL', [ownerId]);
  await query('UPDATE attachments SET user_id = $1 WHERE user_id IS NULL', [ownerId]);
}
