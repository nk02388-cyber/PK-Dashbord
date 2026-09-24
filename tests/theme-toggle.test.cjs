const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract=name=>html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const attrs=new Map(),buttonAttrs=new Map(),saved=[];
const ctx=vm.createContext({
  document:{documentElement:{setAttribute:(key,value)=>attrs.set(key,value),getAttribute:key=>attrs.get(key)}},
  btn:{textContent:'',setAttribute:(key,value)=>buttonAttrs.set(key,value)},
  localStorage:{setItem:(key,value)=>saved.push([key,value])}
});
vm.runInContext(extract('applyDashboardTheme'),ctx);
ctx.applyDashboardTheme('dark',true);
assert.equal(attrs.get('data-theme'),'dark');
assert.equal(buttonAttrs.get('aria-label'),'เปลี่ยนเป็นโหมดสว่าง');
assert.equal(buttonAttrs.get('title'),'เปลี่ยนเป็นโหมดสว่าง');
assert.equal(buttonAttrs.get('aria-pressed'),'true');
assert.deepEqual(saved,[['pk-dashboard-theme','dark']]);
ctx.applyDashboardTheme('light',true);
assert.equal(attrs.get('data-theme'),'light');
assert.equal(buttonAttrs.get('aria-label'),'เปลี่ยนเป็นโหมดมืด');
assert.equal(buttonAttrs.get('title'),'เปลี่ยนเป็นโหมดมืด');
assert.equal(buttonAttrs.get('aria-pressed'),'false');
assert.match(html,/localStorage\.getItem\('pk-dashboard-theme'\)/);
assert.match(html,/window\.addEventListener\('storage'/);
assert.match(html,/class="theme-option theme-option-sun"/);
assert.match(html,/class="theme-option theme-option-moon"/);
assert.doesNotMatch(html,/root\.removeAttribute\('data-theme'\)/);
console.log('PASS: explicit light/dark themes persist, update labels and never fall back to OS auto-dark');
