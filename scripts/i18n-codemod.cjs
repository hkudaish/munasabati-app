// Wraps the Arabic text that a page DISPLAYS in t('...') so it can be translated.
//   node scripts/i18n-codemod.cjs --extract <files...>   lists what would change and what needs a hand (writes scripts/.i18n-report.json)
//   node scripts/i18n-codemod.cjs --apply   <files...>   rewrites the files
// Options: --only=Name1,Name2 limits the change to those components.
// Safe by construction: only text nodes, display attributes, branches of conditionals and the right side of && / || inside JSX, and a few
// message setters are rewritten. Comparisons, keys, object keys, regular expressions and data values are never touched; every other Arabic
// string is reported with its line number for a decision by hand.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const args = process.argv.slice(2);
const mode = args.includes('--apply') ? 'apply' : 'extract';
const only = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const files = args.filter(a => !a.startsWith('--'));
const ARABIC = /[؀-ۿ]/;
const DISPLAY_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'aria-description', 'aria-roledescription']);
const MESSAGE_SETTERS = new Set(['setNotice', 'setMessage', 'setError', 'setErr', 'setStatus', 'setSaveStatus', 'setToast', 'notify']);
const report = { files: {}, manual: [] };

const norm = s => s.replace(/\s+/g, ' ').trim();
const quote = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ') + "'";

function processFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const isClient = /^\s*(['"])use client\1/.test(source);
  // names already bound in the file, so the translator never shadows (or is shadowed by) an existing variable
  const bound = new Set();
  (function scan(n) {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) bound.add(n.name.text);
    ts.forEachChild(n, scan);
  })(sf);
  const fn = ['t', 'tr', '$t'].find(c => !bound.has(c)) || '$t';
  const edits = [];                 // { start, end, text }
  const keys = [];
  const needHook = new Set();       // component function nodes that need `const t = useT()`
  const manual = [];
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  /** Nearest enclosing component function (name starts with a capital, or default export), or null at module level. */
  function component(node) {
    for (let p = node.parent; p; p = p.parent) {
      if (!(ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p))) continue;
      let name = p.name && p.name.text;
      if (!name && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) name = p.parent.name.text;
      if (!name && p.parent && ts.isCallExpression(p.parent) && p.parent.parent && ts.isVariableDeclaration(p.parent.parent) && ts.isIdentifier(p.parent.parent.name)) name = p.parent.parent.name.text; // forwardRef/memo
      const isDefault = ts.isFunctionDeclaration(p) && p.modifiers && p.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
      if ((name && /^[A-Z]/.test(name)) || isDefault) return { node: p, name: name || 'default' };
    }
    return null;
  }
  const allowed = comp => !only.length || only.includes(comp.name);

  function wrapLiteral(node, text) {
    const comp = component(node);
    if (!comp) return false;
    if (!allowed(comp)) return 'skipped';
    const key = norm(text);
    keys.push(key);
    needHook.add(comp.node);
    edits.push({ start: node.getStart(), end: node.getEnd(), text: `${fn}(${quote(key)})` });
    return true;
  }
  function wrapTemplate(node) {
    const comp = component(node);
    if (!comp) return false;
    if (!allowed(comp)) return 'skipped';
    let key = node.head.text, used = new Set(), vars = [];
    node.templateSpans.forEach((span, i) => {
      const expr = span.expression;
      let name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : 'p' + (i + 1);
      while (used.has(name)) name += '_';
      used.add(name);
      vars.push(`${name}: ${expr.getText()}`);
      key += `{${name}}` + span.literal.text;
    });
    key = norm(key);
    keys.push(key);
    needHook.add(comp.node);
    edits.push({ start: node.getStart(), end: node.getEnd(), text: `${fn}(${quote(key)}, { ${vars.join(', ')} })` });
    return true;
  }
  /** A display expression: only the shapes whose value is shown as it is. */
  function expression(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { if (ARABIC.test(node.text)) return wrapLiteral(node, node.text); return false; }
    if (ts.isTemplateExpression(node)) { const text = node.head.text + node.templateSpans.map(s => s.literal.text).join(''); if (ARABIC.test(text)) return wrapTemplate(node); return false; }
    if (ts.isParenthesizedExpression(node)) return expression(node.expression);
    if (ts.isConditionalExpression(node)) { expression(node.whenTrue); expression(node.whenFalse); return false; }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) { expression(node.right); return false; }
    return false;
  }
  const handled = new Set();
  function visit(node) {
    if (ts.isJsxText(node) && ARABIC.test(node.text)) {
      const raw = node.text, lead = raw.match(/^\s*/)[0].length, trail = raw.match(/\s*$/)[0].length;
      const core = raw.slice(lead, raw.length - trail);
      if (/&\w+;/.test(core)) manual.push({ line: line(node), why: 'entity in text', text: core.slice(0, 60) });
      else {
        const comp = component(node);
        if (comp && allowed(comp)) { const key = norm(core); keys.push(key); needHook.add(comp.node); edits.push({ start: node.pos + lead, end: node.pos + raw.length - trail, text: `{${fn}(${quote(key)})}` }); /* node.pos includes the leading whitespace that getStart() skips */ handled.add(node); }
        else if (!comp) manual.push({ line: line(node), why: 'outside a component', text: core.slice(0, 60) });
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && DISPLAY_ATTRS.has(node.name.getText())) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && ARABIC.test(init.text)) {
        const comp = component(node);
        if (comp && allowed(comp)) { const key = norm(init.text); keys.push(key); needHook.add(comp.node); edits.push({ start: init.getStart(), end: init.getEnd(), text: `{${fn}(${quote(key)})}` }); handled.add(init); }
      } else if (ts.isJsxExpression(init) && init.expression) expression(init.expression);
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      expression(node.expression);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && MESSAGE_SETTERS.has(callee.text)) node.arguments.forEach(a => expression(a));
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'join' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && /^[،؛]\s?$/.test(node.arguments[0].text)) {
        const comp = component(node);
        if (comp && allowed(comp)) { const key = node.arguments[0].text; keys.push(key); needHook.add(comp.node); edits.push({ start: node.arguments[0].getStart(), end: node.arguments[0].getEnd(), text: `${fn}(${quote(key)})` }); }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  // Arabic text that was not handled above
  (function leftovers(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ARABIC.test(node.text) && !edits.some(e => e.start <= node.getStart() && e.end >= node.getEnd()) && !(node.parent && ts.isImportDeclaration(node.parent))) {
      const comp = component(node);
      if (!comp || allowed(comp)) manual.push({ line: line(node), why: ts.isPropertyAssignment(node.parent) || ts.isArrayLiteralExpression(node.parent) ? 'data / label table' : node.parent && ts.isBinaryExpression(node.parent) ? 'comparison / expression' : 'other', text: node.text.slice(0, 70) });
    } else if (ts.isTemplateExpression(node) && ARABIC.test(node.head.text + node.templateSpans.map(s => s.literal.text).join('')) && !edits.some(e => e.start <= node.getStart() && e.end >= node.getEnd())) {
      const comp = component(node);
      if (!comp || allowed(comp)) manual.push({ line: line(node), why: 'template', text: node.head.text.slice(0, 70) });
    }
    ts.forEachChild(node, leftovers);
  })(sf);

  // hooks: `const t = useT();` (client) / `const t = getT();` (server) as the first statement of each component
  for (const comp of needHook) {
    if (!comp.body || !ts.isBlock(comp.body)) { manual.push({ line: sf.getLineAndCharacterOfPosition(comp.getStart()).line + 1, why: 'component with an expression body needs a block to hold the translator', text: '' }); edits.length = 0; break; }
    const first = comp.body.statements[0];
    const at = comp.body.getStart() + 1;
    edits.push({ start: at, end: at, text: `\n  const ${fn} = ${isClient ? 'useT' : 'getT'}();` });
    void first;
  }
  const result = { keys: Array.from(new Set(keys)), edits: edits.length, manual, translator: fn };
  report.files[file] = result;
  if (mode === 'apply' && edits.length) {
    let out = source;
    edits.sort((a, b) => b.start - a.start || b.end - a.end).forEach(e => { out = out.slice(0, e.start) + e.text + out.slice(e.end); });
    const importLine = isClient ? "import { useT } from '@/components/i18n/LocaleProvider';" : "import { getT } from '@/lib/i18n/server';";
    if (!out.includes(importLine)) {
      // after the last import declaration of the ORIGINAL file (every edit lies below the imports, so the offset is unchanged)
      const imports = sf.statements.filter(ts.isImportDeclaration), end = imports.length ? imports[imports.length - 1].getEnd() : 0;
      out = out.slice(0, end) + (end ? '\n' : '') + importLine + (end ? '' : '\n') + out.slice(end);
    }
    fs.writeFileSync(file, out);
  }
}
for (const f of files) processFile(path.resolve(f));
fs.writeFileSync(path.join(__dirname, '.i18n-report.json'), JSON.stringify(report, null, 1));
let total = 0;
for (const [f, r] of Object.entries(report.files)) { total += r.keys.length; console.log(`${path.relative(process.cwd(), f).padEnd(58)} ${String(r.keys.length).padStart(4)} texts  ${String(r.manual.length).padStart(3)} by hand  (translator: ${r.translator})`); }
console.log('total distinct texts per file summed:', total, '| mode:', mode);
