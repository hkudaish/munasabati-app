// Lists the translation keys used (t('…')) and the Arabic text still outside t() in the given files.
//   node scripts/i18n-scan.cjs <files...>   -> writes scripts/.i18n-scan.json { keys: {file: [..]}, left: {file: [{line,text,kind}]} }
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ARABIC = /[؀-ۿ]/;
const FN = new Set(['t', 'tr', '$t']);
const out = { keys: {}, left: {} };
for (const file of process.argv.slice(2)) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const keys = new Set(), left = [];
  const inT = n => { for (let p = n.parent; p; p = p.parent) if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && FN.has(p.expression.text) && p.arguments[0] && p.arguments[0].pos <= n.pos && p.arguments[0].end >= n.end) return true; return false; };
  (function visit(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && FN.has(n.expression.text) && n.arguments[0]) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) keys.add(a.text);
    }
    let text = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateExpression(n)) text = n.head.text + n.templateSpans.map(s => '{}' + s.literal.text).join('');
    else if (ts.isJsxText(n)) text = n.text;
    if (text !== null && ARABIC.test(text) && !inT(n) && !(n.parent && ts.isImportDeclaration(n.parent))) {
      left.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, text: text.replace(/\s+/g, ' ').trim().slice(0, 90), kind: ts.SyntaxKind[n.parent.kind] });
    }
    ts.forEachChild(n, visit);
  })(sf);
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  out.keys[rel] = [...keys]; out.left[rel] = left;
}
fs.writeFileSync(path.join(__dirname, '.i18n-scan.json'), JSON.stringify(out, null, 1));
let k = new Set(); Object.values(out.keys).forEach(a => a.forEach(x => k.add(x)));
console.log('distinct keys:', k.size);
for (const [f, l] of Object.entries(out.left)) if (l.length) console.log(f, 'left:', l.length);
