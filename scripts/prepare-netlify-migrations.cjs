// Stage migrations for Netlify's deploy publisher, including build environments
// where the optional automatic database preparation step is not enabled.
const fs = require('node:fs');
const path = require('node:path');
if (process.env.NETLIFY === 'true') {
  const source = path.resolve('netlify/database/migrations');
  const output = path.resolve('.netlify/internal/db/migrations');
  fs.rmSync(output, { recursive: true, force: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const name = entry.isDirectory() ? entry.name : entry.name.replace(/\.sql$/, '');
    if (!/^\d+_[a-z0-9_-]+$/.test(name)) throw Error('Invalid database migration name');
    const input = entry.isDirectory() ? path.join(source, name, 'migration.sql') : path.join(source, entry.name);
    if (!entry.isDirectory() && !entry.name.endsWith('.sql')) throw Error('Unexpected database migration file');
    const target = path.join(output, name);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(input, path.join(target, 'migration.sql'));
    console.log('Prepared Netlify database migration:', name);
  }
}
