/**
 * Legacy Mongo seed — demo @nmp.gov.ph accounts removed.
 * Use Laravel: php artisan nmp:seed (purges non-PAMANA demos; PAMANA/org logins only).
 */
async function seed() {
  console.log("Demo account seeding is disabled.");
  console.log("Sign in with museum org/PAMANA usernames via the Laravel API.");
  console.log("Run: cd laravel && php artisan nmp:seed");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
