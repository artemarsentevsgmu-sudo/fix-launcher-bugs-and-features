const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const H={ accept:"application/json","user-agent":UA };
const ids=[80536084112235,93268663480179,104721285196865,90800276252312,138245820555439,137015104066420,83885503995386,138863068689465];
const pool=[...ids,...ids,...ids,...ids,...ids]; // 40 запросов
for(const CONC of [10,20]){
  let ok=0,fail=0; const t0=Date.now();
  for(let i=0;i<pool.length;i+=CONC){
    await Promise.all(pool.slice(i,i+CONC).map(async id=>{
      try{
        const r=await fetch(`https://economy.roproxy.com/v2/assets/${id}/details`,{headers:H});
        r.status===200?ok++:fail++;
      }catch{fail++;}
    }));
  }
  console.log(`conc=${CONC} ok=${ok} fail=${fail} time=${((Date.now()-t0)/1000).toFixed(1)}s`);
  await new Promise(x=>setTimeout(x,1500));
}
// favorites throughput
let ok=0,fail=0; const t0=Date.now();
for(let i=0;i<pool.length;i+=15){
  await Promise.all(pool.slice(i,i+15).map(async id=>{
    try{const r=await fetch(`https://catalog.roproxy.com/v1/favorites/assets/${id}/count`,{headers:H});r.status===200?ok++:fail++;}catch{fail++;}
  }));
}
console.log(`favorites conc=15 ok=${ok} fail=${fail} time=${((Date.now()-t0)/1000).toFixed(1)}s`);
