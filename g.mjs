const c=process.env.RC;
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const H={cookie:`.ROBLOSECURITY=${c}`,accept:"application/json","user-agent":UA};
let cur=null,n=0,pages=0,oldest=null,retries=0;
const t0=Date.now();
while(pages<40 && (Date.now()-t0)<70000){
  const u=new URL("https://economy.roblox.com/v2/groups/33406605/transactions");
  u.searchParams.set("limit","100");u.searchParams.set("sortOrder","Desc");u.searchParams.set("transactionType","Sale");
  if(cur)u.searchParams.set("cursor",cur);
  const r=await fetch(u,{headers:H});
  if(r.status===429){retries++;await new Promise(x=>setTimeout(x,4000));continue;}
  if(r.status!==200){console.log("stop HTTP",r.status);break;}
  const j=await r.json(); const rows=j.data||[];
  n+=rows.length;pages++;
  if(rows.length)oldest=rows[rows.length-1].created;
  if(!j.nextPageCursor){console.log("нет курсора");break;}
  cur=j.nextPageCursor;
  await new Promise(x=>setTimeout(x,700));
}
console.log("страниц:",pages,"| транзакций:",n,"| ретраев(429):",retries);
console.log("самая старая:",oldest,"| время:",((Date.now()-t0)/1000).toFixed(1)+"s");
