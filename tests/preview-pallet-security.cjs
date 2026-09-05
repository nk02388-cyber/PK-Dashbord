// Local-only browser fixture. Both production clients are disabled before page execution.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
http.createServer((req,res)=>{
 let html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/const (SUPABASE_URL|STOCK_SUPABASE_URL) = '[^']*';/g,"const $1 = ''; ");
 html=html.replace('const SLOT_ITEMS = (STOCK && STOCK.slot_items) || {};',`const SLOT_ITEMS = {F:{'F-18':[{code:'DEMO',name:'ทดสอบสิทธิ์พาเลต',qty:10,remainingQty:10,unit:'pcs',lotNo:'TEST',receiveDate:'2026-09-05'}]}};`);
 html=html.replace('</body>',`<script>
 let fixtureMode='ok',fixtureEditor=true;
 palletDataReady=true;
 supabaseClient={auth:{async getSession(){return {data:{session:fixtureEditor?{user:{email:'test@example.invalid'}}:null}}},async signOut(){fixtureEditor=false;return {}},async signInWithOtp(){return {error:{message:'Test email disabled'}}}},
 async rpc(name,args){if(name==='can_edit_pallets')return {data:fixtureEditor};
 if(!fixtureEditor)return {error:{code:'42501'}};
 if(fixtureMode==='conflict')return {error:{code:'40001'}};
 if(fixtureMode==='network')return {error:{message:'Test network failure'}};
 return {data:{slots:args.p_slots.map(r=>({...r,version:r.expected_version+1})),dates:args.p_dates.map(r=>({...r,version:r.expected_version+1}))}}}};
 for(const mode of ['conflict','network','ok']){
 const b=document.createElement('button');b.textContent='Test '+mode;
 b.style.cssText='position:relative;z-index:999999';
 b.onclick=()=>{fixtureMode=mode};document.body.appendChild(b);
 }
 </script></body>`);
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);
}).listen(8768,'127.0.0.1',()=>console.log('Security preview http://localhost:8768'));
