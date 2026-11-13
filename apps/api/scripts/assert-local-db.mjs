// Refuses to go on unless DATABASE_URL points at this machine, so `db:reset`
// can never wipe a staging or production database.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (apps/api/.env)');
  process.exit(1);
}
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  console.error(`Refusing to reset a database on ${host}. db:reset is for local databases only.`);
  process.exit(1);
}
