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

/** Keep supported originals when they fit; resize large phone images for upload. */
export async function prepareUploadImage(file:File,maxBytes=4*1024*1024):Promise<string>{
  if(file.size>32*1024*1024)throw new Error("poster_too_large");
  if(file.type&&!file.type.startsWith("image/"))throw new Error("invalid_poster_type");
  if(["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size>0&&file.size<=maxBytes){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(new Error("poster_read_failed"));reader.readAsDataURL(file);
    });
  }
  let source;
  try{source=await decode(file);}catch{throw new Error("poster_read_failed");}
  try{
    for(const side of [2000,1400,1000,700]){
      const scale=Math.min(1,side/Math.max(source.width,source.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("poster_read_failed");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
      for(const quality of [.88,.76,.62]){
        const result=canvas.toDataURL("image/jpeg",quality);
        if(result.startsWith("data:image/jpeg;")&&result.split(",")[1].length*3/4<=maxBytes)return result;
      }
    }
    throw new Error("poster_too_large");
  }finally{if("close" in source&&typeof source.close==="function")source.close();}
}
