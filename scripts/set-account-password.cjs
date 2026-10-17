// Operator-only account recovery; no public endpoint can claim existing accounts.
// ACCOUNT_IDENTIFIER=... ACCOUNT_PASSWORD=... node --env-file=.env scripts/set-account-password.cjs
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const prisma = new PrismaClient();
(async () => {
  const identifier = process.env.ACCOUNT_IDENTIFIER;
  const password = process.env.ACCOUNT_PASSWORD;
  if (!identifier || !password || password.length < 12 || password.length > 128) throw Error('Set ACCOUNT_IDENTIFIER and ACCOUNT_PASSWORD (12–128 characters).');
  const user = await prisma.user.findFirst({ where: { OR: [{ phone: identifier }, { email: identifier }] } });
  if (!user) throw Error('Existing account not found.');
  const salt = randomBytes(16).toString('hex');
  const hash = (await promisify(scrypt)(password, salt, 64)).toString('hex');
  await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash: `scrypt:${salt}:${hash}` } }), prisma.authSession.deleteMany({ where: { userId: user.id } })]);
  console.log('Password updated and previous sessions revoked.');
})().catch(e => { console.error(e.code || 'Account password update failed. Check input and database connectivity.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
