// Operator-only admin password reset. You type the new password in YOUR terminal (hidden); it is never
// passed as an argument or environment variable, never printed, and never stored in shell history.
//
//   node scripts/reset-admin-password.cjs --target local      --account you@example.com
//   node scripts/reset-admin-password.cjs --target production --account you@example.com
//   add --dry-run to check everything (account found, password rules) without changing anything
//
// local:      uses DATABASE_URL from .env and refuses anything that is not localhost.
// production: fetches the connection through the Netlify login stored on this machine (like db:backup)
//             and asks you to type RESET PRODUCTION before changing anything.
// Effect: sets a new scrypt hash (same format as the app's login), signs the account out everywhere
// (deletes its sessions) and writes a SystemAuditLog entry. No password is written to any log.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const target = flag('target');
const account = flag('account');
const dryRun = args.includes('--dry-run');
if (!['local', 'production'].includes(target) || !account) {
  console.error('Usage: node scripts/reset-admin-password.cjs --target local|production --account <email|phone> [--dry-run]');
  process.exit(2);
}

let lineReader; // piped input: one shared reader so no line is lost between prompts
async function ask(question, hidden) {
  const stdin = process.stdin;
  process.stdout.write(question);
  if (!stdin.isTTY) {
    lineReader = lineReader || readline.createInterface({ input: stdin })[Symbol.asyncIterator]();
    const { value } = await lineReader.next();
    return value === undefined ? '' : String(value).replace(/\r$/, '');
  }
  if (!hidden) {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: stdin, output: process.stdout });
      rl.question('', answer => { rl.close(); resolve(answer); });
    });
  }
  return new Promise(resolve => {
    let value = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onKey = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.off('data', onKey); stdin.pause(); process.stdout.write('\n'); return resolve(value); }
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1); else value += c;
      }
    };
    stdin.on('data', onKey);
  });
}

function netlifyToken() {
  const dir = process.platform === 'win32' ? path.join(process.env.APPDATA, 'netlify', 'Config') : path.join(os.homedir(), '.config', 'netlify');
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json')));
  const user = config.users[config.userId];
  return user.auth?.token || user.token;
}

async function connectionUrl() {
  if (target === 'local') {
    for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL="?(.*?)"?$/);
      if (m) { process.env.DATABASE_URL = m[1]; break; }
    }
    const url = new URL(process.env.DATABASE_URL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Target "local" refuses a non-local DATABASE_URL.');
    return url.toString();
  }
  const siteId = JSON.parse(fs.readFileSync('.netlify/state.json')).siteId;
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/database`, { headers: { Authorization: `Bearer ${netlifyToken()}` } });
  if (!res.ok) throw Error('Cannot read the production database connection: HTTP ' + res.status);
  const url = new URL((await res.json()).connection_string);
  if (['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Refusing: not a production host.');
  return url.toString();
}

(async () => {
  const url = await connectionUrl();
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const user = await prisma.user.findFirst({ where: { OR: [{ email: account }, { phone: account }] }, select: { id: true, name: true, role: true, isActive: true, email: true, phone: true } });
    if (!user) throw Error('Account not found in the ' + target + ' database.');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw Error('That account is not an administrator (role ' + user.role + '). Refusing.');
    console.log(`Target: ${target} | account: ${user.name} (${user.email || user.phone}) | role: ${user.role} | active: ${user.isActive}`);

    const first = await ask('New password (12-128 characters, hidden): ', true);
    const second = await ask('Repeat the password: ', true);
    if (first !== second) throw Error('The two passwords do not match. Nothing was changed.');
    if (first.length < 12 || first.length > 128) throw Error('The password must be 12 to 128 characters. Nothing was changed.');
    if (dryRun) { console.log('Dry run: account and password rules are fine. Nothing was changed.'); return; }
    if (target === 'production') {
      const confirm = await ask('This changes the LIVE site. Type RESET PRODUCTION to continue: ', false);
      if (confirm.trim() !== 'RESET PRODUCTION') throw Error('Not confirmed. Nothing was changed.');
    }

    const salt = randomBytes(16).toString('hex');
    const hash = (await promisify(scrypt)(first, salt, 64)).toString('hex');
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: `scrypt:${salt}:${hash}` } }),
      prisma.authSession.deleteMany({ where: { userId: user.id } }),
      prisma.systemAuditLog.create({ data: { actorId: 'LOCAL_OPERATOR', targetId: user.id, action: 'ADMIN_PASSWORD_RESET', details: { target } } }),
    ]);
    console.log('Password updated, previous sessions revoked, audit entry written. Sign in again with the new password.');
  } finally {
    await prisma.$disconnect();
  }
})().catch(e => { console.error(String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[redacted-url]')); process.exitCode = 1; });
