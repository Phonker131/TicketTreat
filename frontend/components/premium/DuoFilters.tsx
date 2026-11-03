/** Shared SVG duotone filters: any event photo is printed in two brand inks (Midnight to Electric Blue or Cantaloupe, with paper highlights). */
export function DuoFilters(){
 const dark=(r:number,g:number,b:number)=>[r,g,b];
 const stops={
  blue:[dark(2,7,10),dark(2,151,222),dark(240,235,225)],
  orange:[dark(2,7,10),dark(252,115,77),dark(240,235,225)]
 };
 const row="0.41 0.74 0.14 0 -0.1";
 return <svg width="0" height="0" style={{position:"absolute"}} aria-hidden="true" focusable="false"><defs>
  {(Object.keys(stops) as (keyof typeof stops)[]).map(k=>{
   const s=stops[k],t=(i:number)=>s.map(c=>(c[i]/255).toFixed(4)).join(" ");
   return <filter key={k} id={"tp-duo-"+k} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
    <feColorMatrix type="matrix" values={`${row} ${row} ${row} 0 0 0 1 0`}/>
    <feComponentTransfer><feFuncR type="table" tableValues={t(0)}/><feFuncG type="table" tableValues={t(1)}/><feFuncB type="table" tableValues={t(2)}/></feComponentTransfer>
   </filter>;
  })}
 </defs></svg>;
}
