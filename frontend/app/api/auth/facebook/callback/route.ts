/* TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
 * Browser-bound state and HttpOnly web session for Facebook OAuth.
 * Only a fixed configured origin may receive the post-login redirect.
 */
import {NextRequest,NextResponse} from "next/server";

export async function GET(req:NextRequest){
  const configured = process.env.FACEBOOK_REDIRECT_URI;
  if (!configured) return NextResponse.json({detail:"facebook_not_configured"},{status:503});
  let origin:string;
  try {
    const callback = new URL(configured);
    if (callback.pathname!=="/api/auth/facebook/callback" || callback.protocol!=="https:" ||
        callback.username || callback.password || callback.search || callback.hash)
      throw new Error("Invalid redirect URI");
    origin=callback.origin;
  } catch {return NextResponse.json({detail:"facebook_not_configured"},{status:503});}
  let result="failed";
  let token:string|undefined;
  let pendingToken:string|undefined;
  const code=req.nextUrl.searchParams.get("code");
  const state=req.nextUrl.searchParams.get("state");
  const proof=req.cookies.get("tt_facebook_flow")?.value;
  if (req.nextUrl.searchParams.has("error")) result="cancelled";
  else if (code && state && proof && code.length<=4096 &&
           /^[A-Za-z0-9_-]{40,128}$/.test(state) && /^[A-Za-z0-9_-]{40,128}$/.test(proof)){
    try {
      const backend=process.env.BACKEND_API_URL?.replace(/\/+$/,"");
      if (!backend) throw new Error("Backend missing");
      const upstream=await fetch(backend+"/api/v1/auth/facebook/finish",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        redirect:"error",signal:AbortSignal.timeout(30000),
        body:JSON.stringify({code,state,browser_token:proof}),
      });
      const data=await upstream.json();
      if (upstream.ok && typeof data.token==="string" && data.token.length>=30){
        token=data.token;result="success";
      } else if (upstream.status===202 && data.status==="email_verification_required" &&
                 typeof data.pending_token==="string" && /^[A-Za-z0-9_-]{40,128}$/.test(data.pending_token)){
        pendingToken=data.pending_token;result="verify";
      } else if (data.detail==="facebook_link_required") result="link_required";
      else if (data.detail==="facebook_email_required") result="email_required";
      else if (data.detail==="facebook_already_linked" || data.detail==="facebook_account_conflict") result="conflict";
      else if (data.detail==="facebook_exchange_failed" || data.detail==="facebook_verification_failed" ||
               data.detail==="invalid_facebook_identity") result="provider_failed";
    } catch { /* Never put code/token/provider messages in redirects or logs. */ }
  }
  const response=NextResponse.redirect(new URL(result==="verify"?"/auth/facebook/verify":"/profile?facebook="+result,origin),303);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  const secure=process.env.NODE_ENV==="production" || origin.startsWith("https:");
  response.cookies.set("tt_facebook_flow","",{
    httpOnly:true,sameSite:"lax",secure,path:"/api/auth/facebook",maxAge:0,
  });
  if (token)response.cookies.set("tt_web_session",token,{
    httpOnly:true,sameSite:"strict",secure,path:"/api/gateway",maxAge:7*24*3600,
  });
  if (pendingToken)response.cookies.set("tt_facebook_pending",pendingToken,{
    httpOnly:true,sameSite:"strict",secure,path:"/api/gateway",maxAge:600,
  });
  return response;
}
