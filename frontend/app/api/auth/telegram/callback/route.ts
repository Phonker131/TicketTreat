/* TicketTreat: official Telegram OIDC callback. OAuth credentials and bearer
 * sessions never enter JavaScript, query strings or client-side storage. */
import {NextRequest,NextResponse} from "next/server";

export async function GET(req:NextRequest) {
  const origin=process.env.NODE_ENV==="production"?"https://tickettreat.eu":req.nextUrl.origin;
  const code=req.nextUrl.searchParams.get("code");
  const state=req.nextUrl.searchParams.get("state");
  const verifier=req.cookies.get("tt_telegram_flow")?.value;
  let token:string|undefined;
  let result="failed";
  if(req.nextUrl.searchParams.has("error")) result="cancelled";
  else if(code && state && verifier &&
          code.length<=4096 && state.length<=128 &&
          verifier.length>=20 && verifier.length<=128) {
    try {
      const base=process.env.BACKEND_API_URL?.replace(/\/+$/,"");
      if(!base || !/^https?:\/\//.test(base))throw new Error("missing_backend");
      const upstream=await fetch(base+"/api/v1/auth/telegram/finish",{
        method:"POST",cache:"no-store",redirect:"error",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({code,state,browser_token:verifier}),
        signal:AbortSignal.timeout(30000),
      });
      const data=await upstream.json().catch(()=>null);
      if(upstream.ok && typeof data?.token==="string" && data.token.length>=30) {
        token=data.token;
        result="success";
      } else if(["telegram_already_linked_to_another_account",
                 "duplicate_event_ticket_requires_manual_resolution",
                 "duplicate_paid_reservation_requires_manual_resolution",
                 "website_account_has_another_telegram",
                 "telegram_link_conflict"].includes(data?.detail)) result="conflict";
      else if(data?.detail==="telegram_login_not_configured")result="unavailable";
      else result="failed";
    }catch{/* Never disclose provider tokens, keys or error bodies. */}
  }
  const response=NextResponse.redirect(new URL("/profile?telegram="+result,origin),303);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  const secure=process.env.NODE_ENV==="production" || origin.startsWith("https:");
  response.cookies.set("tt_telegram_flow","",{
    httpOnly:true,sameSite:"lax",secure,path:"/api/auth/telegram",maxAge:0
  });
  if(token) response.cookies.set("tt_web_session",token,{
    httpOnly:true,sameSite:"strict",secure,path:"/api/gateway",maxAge:7*24*3600
  });
  return response;
}
