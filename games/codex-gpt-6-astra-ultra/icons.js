const wrap=(body,view='0 0 24 24')=>`<svg viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const line=(d)=>`<path d="${d}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const icons={
 crown:wrap('<path d="m3 6 5 5 4-8 4 8 5-5-3 13H6L3 6Z" stroke="currentColor" stroke-width="1.2"/><path d="M6 16h12M7 21h10" stroke="currentColor" stroke-width="1.2"/><path d="m12 10 2 3-2 3-2-3 2-3Z" fill="currentColor"/>'),
 food:wrap('<path d="M12 6c-5-5-11 2-8 8s5 7 8 5c3 2 5 1 8-5S17 1 12 6Z" fill="currentColor" opacity=".7"/>'+line('M12 7V4m0 1c0-3 3-4 5-3-1 3-3 4-5 3M6 10c-1 2 0 4 1 5')),
 wood:wrap('<path d="m12 1 6 8h-3l5 6h-6v7h-4v-7H4l5-6H6l6-8Z" fill="currentColor" opacity=".8"/>'+line('m12 6 0 11m0-6 3-2m-3 5-4-3')),
 gold:wrap('<path d="m6 5 9-2 5 6-8 3-6-7Zm-2 8 8-1 4 7-10 2-2-8Z" fill="currentColor" opacity=".75"/><path d="m12 12 8-3 2 9-6 1M6 5l-4 6 2 2" stroke="currentColor" stroke-width="1.5"/><path d="m8 7 4 3m-5 5 3 4" stroke="#fff" opacity=".35"/>'),
 stone:wrap('<path d="m4 8 6-5 7 1 5 11-5 6-12-2L2 13l2-5Z" fill="currentColor" opacity=".7"/><path d="m4 8 8 3 5-7m-5 7-2 9m2-9 10 4" stroke="currentColor" stroke-width="1.3"/>'),
 people:wrap('<circle cx="9" cy="6" r="3" fill="currentColor"/><circle cx="17" cy="8" r="2.5" fill="currentColor" opacity=".7"/><path d="M2 20v-5a7 7 0 0 1 14 0v5H2Zm15 0v-6l-1-2c4-1 6 2 6 4v4h-5Z" fill="currentColor" opacity=".8"/>'),
 settings:wrap(line('m10 2-1 3-2 1-3-1-2 4 3 2v2l-3 2 2 4 3-1 2 1 1 3h4l1-3 2-1 3 1 2-4-3-2v-2l3-2-2-4-3 1-2-1-1-3h-4Z')+'<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>'),
 flag:wrap(line('M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0')),
 swords:wrap(line('m3 3 5 1 12 14-3 3L4 8 3 3Zm18 0-5 1-5 6m10-7-1 5-5 5m-5 3-4 5-3-3 5-5M2 17l5 5m10-20 5 5M15 20l5-5')),
 shield:wrap('<path d="M4 3h16v10c0 5-8 9-8 9s-8-4-8-9V3Z" fill="currentColor" opacity=".15"/>'+line('M4 3h16v10c0 5-8 9-8 9s-8-4-8-9V3Zm8 2v14m-6-9h12')),
 hammer:wrap(line('m3 21 9-10m-2-7 4-2 7 7-2 4-9-9Zm-1 4 4 4-9 10-3-3L9 8Z')),
 compass:wrap('<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2"/><path d="m15 7-2 6-6 4 4-7 4-3Z" fill="currentColor"/><path d="M12 1v3m11 8h-3m-8 11v-3M1 12h3" stroke="currentColor"/>'),
 home:wrap(line('m2 11 10-9 10 9M5 9v13h14V9M9 22v-9h6v9')),
 help:wrap('<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>'+line('M9 9c0-4 7-4 7 0 0 3-4 2-4 5m0 3v.1')),
 pause:wrap('<path d="M6 4h4v16H6zm8 0h4v16h-4z" fill="currentColor"/>'),
 play:wrap('<path d="m7 3 14 9-14 9V3Z" fill="currentColor"/>'),
 'volume-off':wrap(line('m11 3-6 5H2v8h3l6 5V3Zm5 6 6 6m0-6-6 6')),
 volume:wrap(line('m11 3-6 5H2v8h3l6 5V3Zm5 4c3 2 3 8 0 10m3-13c5 4 5 12 0 16')),
 rally:wrap(line('M5 22V3m0 0h14l-3 5 3 5H5')+'<ellipse cx="5" cy="21" rx="4" ry="2" stroke="currentColor"/>'),
 stop:wrap('<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor"/>'),
 upgrade:wrap(line('m4 14 8-10 8 10h-5v7H9v-7H4Z')),
 arrow:wrap(line('M3 12h18m-7-7 7 7-7 7')),
};
export function icon(name){return icons[name]||icons.shield;}
const team='#789fb1',edge='#243d3b',roof='#886247',roof2='#a27a52',wall='#d2c5a0',darkwall='#9d9476';
export function art(type){
 let b='';
 if(['tree','gold','stone','berries'].includes(type))return icon({tree:'wood',gold:'gold',stone:'stone',berries:'food'}[type]);
 if(['villager','militia','archer','knight'].includes(type)){
 const vill=type==='villager',arch=type==='archer',knight=type==='knight';
 b=`<ellipse cx="38" cy="65" rx="22" ry="5" fill="#132219" opacity=".3"/>`;
 if(knight)b+='<path d="m16 46 9-11 27 4 9 9-7 10H26l-10-12Z" fill="#b7b7a8"/><path d="m21 48-4 17m14-15-3 15m21-14 4 14m-2-18 11 18" stroke="#888d84" stroke-width="5"/><path d="m51 44-3-21 8-7 7 6-1 7-8 2 9 12" fill="#c0c0ae"/><path d="m52 21-2-8 6 4 7-1-2 8" fill="#777f78"/>';
 b+=`<path d="m30 ${knight?43:52}-3 ${knight?9:14}m14-14 5 14" stroke="${vill?'#6f5f3d':'#555f55'}" stroke-width="5"/><path d="M27 31h18l3 22H25l2-22Z" fill="${vill?'#b8ab80':team}"/><path d="m28 34-8 13m23-13 10 10" stroke="${wall}" stroke-width="4"/><circle cx="36" cy="22" r="8" fill="#c6ac80"/><path d="m27 22 2-9 12-1 5 10H27Z" fill="${vill?'#d7c28a':'#bfc5bb'}"/><path d="M27 23h18" stroke="${edge}" stroke-width="2"/><path d="m29 35 11 0-2 16h-9" fill="#5d8399"/>`;
 if(vill)b+='<path d="m48 50 12-26m-6 0 11 5" stroke="#665a3c" stroke-width="3"/><path d="m56 20 9 3-4 10-7-4" fill="#aab3a5"/>';
 else if(arch)b+='<path d="M54 23q19 20 0 37l1-37" fill="none" stroke="#c6ad72" stroke-width="2"/><path d="m45 41 21-2" stroke="#d5c394" stroke-width="1.5"/>';
 else b+='<path d="m53 45 3-28 3 5-3 25" fill="#d9dfd0"/><path d="m50 42 11 1" stroke="#b6a574" stroke-width="3"/><path d="M18 38h13v14l-6 7-7-8V38Z" fill="#577c97" stroke="#adc2c5"/><path d="M24 40v14m-4-9h9" stroke="#d4d5b5"/>';
 }else if(type==='ram'){
 b='<ellipse cx="40" cy="62" rx="27" ry="7" fill="#14251a" opacity=".3"/><path d="m13 38 24-16 29 13-23 17-30-14Z" fill="#a78a58"/><path d="m13 38 30 14v13L13 51V38Z" fill="#79613b"/><path d="m43 52 23-17v14L43 65V52Z" fill="#5f5638"/><path d="m10 27 34 15 27-18" stroke="#a0a79a" stroke-width="6"/><circle cx="23" cy="58" r="7" fill="#443f2b" stroke="#b6a37a"/><circle cx="56" cy="58" r="7" fill="#443f2b" stroke="#b6a37a"/>';
 }else if(['age','upgrade'].includes(type)){
 b='<path d="m14 54 26-37 26 37H50v13H30V54H14Z" fill="#d1b274" stroke="#e0cc97"/><path d="m24 28 16-17 16 17M29 16 40 5l11 11" stroke="#cdb274" stroke-width="2" fill="none"/>';
 }else if(type==='rally'){
 b='<ellipse cx="37" cy="66" rx="24" ry="5" stroke="#a5b58a"/><path d="M31 65V9" stroke="#cab58a" stroke-width="3"/><path d="M33 10h31l-7 12 7 10H33" fill="#6f9ab4" stroke="#b6c6b8"/><path d="M34 11v20" stroke="#d6c9a6"/>';
 }else if(type==='farm'){
 b='<path d="m7 43 31-20 36 21-31 21-36-22Z" fill="#826647" stroke="#baa275"/>';
 for(let i=0;i<6;i++)b+=`<path d="m${13+i*5} ${44+i*3} 26-17" stroke="#b2a369" stroke-width="2"/>`;
 for(let i=0;i<5;i++)for(let j=0;j<4;j++)b+=`<path d="m${22+i*5+j*4} ${44+i*3-j*3} 0-9m-2 2 2 3 3-5" stroke="${i%2?'#d5c687':'#b5bd78'}" stroke-width="1.4"/>`;
 }else{
 const castle=type==='castle',tower=type==='tower',tc=type==='towncenter';
 b='<ellipse cx="41" cy="64" rx="31" ry="9" fill="#14221a" opacity=".3"/>';
 if(tower||castle){
 b+=`<path d="M23 23v37l18 10 19-12V22L40 33 23 23Z" fill="${wall}"/><path d="M41 33v37l19-12V22L41 33Z" fill="${darkwall}"/><path d="m19 21 21-12 24 12-24 14-21-14Z" fill="#b8b494"/><path d="M19 21v8l21 13 24-14v-8L40 34 19 21Z" fill="#c5c1a5"/><path d="M20 20v-7l6 4v7m4 2v-7l6 3v8m7-1v-7l6-3v7m6-10v7l7-4v-7" stroke="#d8d0b1" stroke-width="5"/><path d="M31 60V48q5-6 10 0v17" fill="#495648"/><path d="M48 40v7m7-12v7" stroke="#48574c" stroke-width="3"/>`;
 if(castle)b+='<path d="M9 40v18l13 8V46L9 40Zm52-2v24l12-8V32L61 38Z" fill="#b4b196"/><path d="m6 40 14-12 9 17-10 6-13-11Zm51-2 9-18 12 13-14 10-7-5Z" fill="#5d7890"/>';
 }else{
 b+=`<path d="m13 40 27-16 27 16v20L40 75 13 60V40Z" fill="${wall}"/><path d="M40 49v26l27-15V40L40 49Z" fill="${darkwall}"/><path d="m8 41 29-28 34 27-30 16L8 41Z" fill="${roof}"/><path d="m8 41 29-28 7 22-3 21L8 41Z" fill="${roof2}"/><path d="m8 41 33 15 30-16" stroke="#695438" stroke-width="2"/><path d="M20 49v12m11-8v13m20-14v8m9-13v8" stroke="#596458" stroke-width="3"/><path d="m15 58 23 12m8-8 19-9" stroke="#8a7955" stroke-width="2"/>`;
 if(tc)b+='<path d="M32 22V8l11-6 12 7v16L44 32 32 22Z" fill="#d6cdb1"/><path d="m28 9 14-9 17 9-15 10-16-10Z" fill="#667f8f"/><path d="M44 20v8m7-12v8" stroke="#536355" stroke-width="3"/><path d="M42 1v-8h13l-4 5h-9" fill="#81abc5"/>';
 if(type==='barracks')b+='<path d="m24 39 13 16m0-16L24 55" stroke="#d1d2bd" stroke-width="3"/><path d="m23 53 4 4m7-4 4 4" stroke="#c6ad68" stroke-width="3"/>';
 if(type==='archery')b+='<circle cx="28" cy="53" r="9" fill="#ddc9a0"/><circle cx="28" cy="53" r="6" fill="#9d694f"/><circle cx="28" cy="53" r="3" fill="#d4c592"/>';
 if(type==='stable')b+='<path d="M24 59V46q7-9 14 0v19" fill="#4b503a"/><path d="m29 57 1-10 5-3 3 4-2 3h-3v8" fill="#c0ac80"/>';
 }
 b+='<path d="M62 31V8" stroke="#9f9366" stroke-width="1.5"/><path d="M63 8h12l-3 5 3 5H63V8Z" fill="#78a4be"/>';
 }
 return wrap(b,'0 0 80 80');
}
