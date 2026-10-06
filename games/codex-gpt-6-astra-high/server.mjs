import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf'};
http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const p=path.join(root,name==='/'?'index.html':name);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});}).listen(4173,'0.0.0.0',()=>console.log('Crown & Covenant: http://localhost:4173'));
