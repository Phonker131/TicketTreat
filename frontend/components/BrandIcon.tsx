import type {SVGProps} from "react";
export type BrandIconName="arr"|"back"|"arr-up"|"down"|"diag"|"plus"|"cross"|"chk"|"send"|"copy"|"trash"|"search"|"scan"|"warn"|"pin"|"clock"|"tix"|"lock"|"heart"|"user"|"globe"|"sun"|"moon";
export function BrandIcon({name,size=20,...props}:{name:BrandIconName;size?:16|20|24|28}&SVGProps<SVGSVGElement>){
 return <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true" focusable="false" {...props}>
  <use href={"/brand/icons.svg#"+name} />
 </svg>;
}
