/* Brand photography: real night-out photos printed in the riso halftone of the palette.
   Files live in /brand/posters as {name}-480 and {name}-720, AVIF with a WebP fallback. */
export type PhotoName="hero"|"cta"|"night"|"quiz"|"mic"|"sd"|"studios";

export function BrandPhoto({name,sizes,priority=false,className=""}:{name:PhotoName;sizes:string;priority?:boolean;className?:string}){
 const base="/brand/posters/"+name;
 return <picture className={className}>
  <source type="image/avif" srcSet={base+"-480.avif 480w, "+base+"-720.avif 720w"} sizes={sizes}/>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={base+"-480.webp"} srcSet={base+"-480.webp 480w, "+base+"-720.webp 720w"} sizes={sizes} alt=""
   loading={priority?"eager":"lazy"} decoding="async" {...(priority?{fetchPriority:"high" as const}:{})}/>
 </picture>;
}
