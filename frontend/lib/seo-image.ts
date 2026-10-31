/** Normalize public event/organizer images for search and social previews.
 * A path is rooted at our own origin. Absolute third-party URLs must be HTTPS.
 * Do not turn an untrusted scheme, protocol-relative URL or credential URL into metadata.
 */
const origin="https://tickettreat.eu";
export function seoImageUrl(value:string|null|undefined):string|undefined {
  if(!value||value.length>2048||value!==value.trim()||/[\\\u0000-\u001f\u007f]/.test(value))return undefined;
  if(value.startsWith("/")&&!value.startsWith("//")){
    try {
      const resolved=new URL(value,origin);
      return resolved.origin===origin?resolved.href:undefined;
    }catch{return undefined;}
  }
  try{
    const resolved=new URL(value);
    return resolved.protocol==="https:"&&!resolved.username&&!resolved.password
      ?resolved.href:undefined;
  }catch{return undefined;}
}
