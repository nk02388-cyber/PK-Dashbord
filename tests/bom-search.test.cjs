const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['normalizeSearchText', 'getFgSearchResults', 'highlightSearchMatch'];
const source = names.map(name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0]).join('\n');
const items = [
  {fg: '21-0001-08', fg_name: 'แจ๊บส์ เซนซิทีฟ เซราไมด์'},
  {fg: '21-0001-07', fg_name: 'JABS BODY LOTION'},
  {fg: 'FG-ABC', fg_name: 'Test <script> product'},
];
const before = JSON.stringify(items);
const ctx = vm.createContext({ BOMPK: {fg_list: items},
  escapeHtml: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') });
vm.runInContext(source, ctx);
assert.equal(ctx.getFgSearchResults('').length, 0);
assert.equal(ctx.getFgSearchResults('   ').length, 0);
assert.equal(ctx.getFgSearchResults('unknown').length, 0);
assert.equal(ctx.getFgSearchResults('21-0001').length, 2);
assert.equal(ctx.getFgSearchResults('0001-08')[0].fg, '21-0001-08');
assert.equal(ctx.getFgSearchResults(' เซราไมด์ ')[0].fg, '21-0001-08');
assert.equal(ctx.getFgSearchResults('body lotion')[0].fg, '21-0001-07');
assert.equal(ctx.getFgSearchResults('fg-abc')[0].fg, 'FG-ABC');
assert.equal(ctx.getFgSearchResults('แจบส์')[0].fg, '21-0001-08');
assert.equal(JSON.stringify(items), before, 'Searching must not alter BOM data');
assert.equal(ctx.highlightSearchMatch('<script>', 'script'), '&lt;<mark>script</mark>>');
assert.match(html, /class="floorplan-search" id="fgBomSearchBar"/);
assert.match(html, /id="fgBomSearch"[^>]*role="combobox"[^>]*aria-controls="fgBomSuggestions"/);
assert.doesNotMatch(html, /id="fgBomSearch"[^>]*list="fgCodeList"/);
assert.match(html, /fgBomSearch\.addEventListener\('input', \(\) => \{\s*fgBomSearchMsg.hidden = true;\s*renderFgBom\(''\);\s*renderFgSuggestions\(\);/);
assert.match(html, /if \(e\.isComposing\) return;/);
assert.match(html, /e\.key === 'Escape' \|\| e\.key === 'Tab'/);
console.log('PASS: BOM partial code/name search, Thai/case normalization, safe highlighting, shared search styles and keyboard hooks');
