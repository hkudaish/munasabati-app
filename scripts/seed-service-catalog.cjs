const fs = require('node:fs'), ts = require('typescript'), path = require('node:path');
async function seedServiceCatalog(prisma) {
  const module = { exports: {} };
  new Function('exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/catalog/defaults.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module.exports);
  const { CATALOG_CATEGORIES, CATALOG_SUBCATEGORIES, CATALOG_ARTISTS } = module.exports;
  await prisma.serviceCategory.createMany({ data: CATALOG_CATEGORIES, skipDuplicates: true });
  await prisma.serviceSubcategory.createMany({ data: CATALOG_SUBCATEGORIES, skipDuplicates: true });
  await prisma.catalogArtist.createMany({ data: CATALOG_ARTISTS, skipDuplicates: true });
}
module.exports = { seedServiceCatalog };
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
  seedServiceCatalog(prisma).then(() => console.log('Catalog taxonomy seeded without changing existing names or activation settings.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
