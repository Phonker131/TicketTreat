import {spawn,type ChildProcess} from "node:child_process";
import {createServer,type Server} from "node:http";
import {once} from "node:events";
import {resolve} from "node:path";

async function freePort():Promise<number>{
  const probe=createServer();
  probe.listen(0,"127.0.0.1");
  await once(probe,"listening");
  const address=probe.address();
  if(!address || typeof address==="string")throw new Error("Unable to reserve test port");
  const port=address.port;
  probe.close();
  await once(probe,"close");
  return port;
}

/**
 * Keep SSR test fixtures isolated from CI's real FastAPI server on port 8000.
 * Browser request routing cannot mock a Next.js server-side event fetch.
 */
export async function isolatedEventServer(event:{id:number}):Promise<{origin:string;close:()=>Promise<void>}>{
  const api:Server=createServer((req,res)=>{
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(req.url===`/events/${event.id}`?event:[]));
  });
  api.listen(0,"127.0.0.1");
  await once(api,"listening");
  const address=api.address();
  if(!address || typeof address==="string")throw new Error("Mock API failed to bind");
  const port=await freePort();
  const origin=`http://127.0.0.1:${port}`;
  const next:ChildProcess=spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),"start","-H","127.0.0.1","-p",String(port)],{
    cwd:process.cwd(),env:{...process.env,BACKEND_API_URL:`http://127.0.0.1:${address.port}`},stdio:"ignore",
  });
  try{
    let ready=false;
    for(let attempt=0;attempt<100;attempt++){
      if(next.exitCode!==null)throw new Error(`Isolated Next server stopped (${next.exitCode})`);
      try{
        const response=await fetch(`${origin}/events/${event.id}`,{signal:AbortSignal.timeout(2000)});
        if(response.ok){ready=true;break;}
      }catch{/* Still starting. */}
      await new Promise<void>(done=>setTimeout(done,250));
    }
    if(!ready)throw new Error("Isolated Next server did not start");
  }catch(error){
    next.kill("SIGTERM");
    api.closeAllConnections();api.close();
    throw error;
  }
  return {origin,close:async()=>{
    next.kill("SIGTERM");
    if(next.exitCode===null)await Promise.race([once(next,"exit"),new Promise<void>(done=>setTimeout(done,5000))]);
    api.closeAllConnections();
    await new Promise<void>(done=>api.close(()=>done()));
  }};
}
