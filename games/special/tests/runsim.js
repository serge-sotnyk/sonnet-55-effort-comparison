const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const only=process.argv[2];
let code=fs.readFileSync(__dirname+'/simtests.js','utf8');
if(only)code=code.replace(/^TT\('([^']*)'/gm,(m,n)=>n.includes(only)?m:"T0('"+n+"'").replace("function TT(name,fn){","function T0(){}\nfunction TT(name,fn){");
const out=JSON.parse(vm.runInContext(code,c,{filename:'simtests'}));
for(const[n,p,d]of out)console.log((p?'PASS':'FAIL')+' | '+n+' | '+d);
