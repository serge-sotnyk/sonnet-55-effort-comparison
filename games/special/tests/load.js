const fs=require('fs'),vm=require('vm');
let _seed=+(process.env.SEED||1);const M2=Object.create(Math);M2.random=()=>{_seed|=0;_seed=_seed+0x6D2B79F5|0;let t=Math.imul(_seed^_seed>>>15,1|_seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const ctx={console,Math:M2,Date,setTimeout,Uint8Array,Int16Array,Int32Array,Float32Array,Map,Set,Array,Object,JSON,Number,String,performance};
ctx.window=ctx;vm.createContext(ctx);
for(const f of ['data','map','game','ai'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),ctx,{filename:f});
module.exports=ctx;
