/** Event gallery photos are shrunk in the browser before upload.
 * Phone photos are usually 3-8 MB and the server takes up to 2 MB, so every picture
 * is redrawn at most 2000 px on the long side as JPEG (about 300-700 KB).
 */
const MAX_SIDE=2000;
const MAX_DATA_URL=2_700_000; // about 2 MB of image bytes once base64 is decoded

async function decode(file:File):Promise<CanvasImageSource&{width:number;height:number}>{
  if("createImageBitmap" in window){
    try{return await createImageBitmap(file,{imageOrientation:"from-image"});}catch{/* fall back to <img> */}
  }
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.decoding="async";img.src=url;
    await img.decode();
    return img;
  }finally{URL.revokeObjectURL(url);}
}

export class GalleryPhotoError extends Error {}

export async function prepareGalleryPhoto(file:File):Promise<string>{
  if(file.type&&!file.type.startsWith("image/"))throw new GalleryPhotoError("not_an_image");
  let source;
  try{source=await decode(file);}catch{throw new GalleryPhotoError("unreadable_image");}
  const scale=Math.min(1,MAX_SIDE/Math.max(source.width,source.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(source.width*scale));
  canvas.height=Math.max(1,Math.round(source.height*scale));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new GalleryPhotoError("unreadable_image");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  if("close" in source&&typeof source.close==="function")source.close();
  for(const quality of [.86,.78,.68,.56]){
    const url=canvas.toDataURL("image/jpeg",quality);
    if(url.length<=MAX_DATA_URL)return url;
  }
  throw new GalleryPhotoError("too_large");
}
