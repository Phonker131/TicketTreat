import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  // Fixed configured public origin; never derive redirects from forwarded Host.
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (!configured) return NextResponse.json({detail:"google_not_configured"},{status:503});
  const origin = new URL(configured).origin;
  let result = "failed";
  let token: string | undefined;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const browserToken = req.cookies.get("tt_google_flow")?.value;
  if (req.nextUrl.searchParams.has("error")) result = "cancelled";
  else if (code && state && browserToken && code.length <= 4096 && state.length <= 128) {
    try {
      const base = process.env.BACKEND_API_URL?.replace(/\/+$/, "");
      if (!base) throw new Error("Missing backend");
      const upstream = await fetch(base+"/api/v1/auth/google/finish", {
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        redirect:"error",signal:AbortSignal.timeout(30000),
        body:JSON.stringify({code,state,browser_token:browserToken}),
      });
      const data = await upstream.json();
      if (upstream.ok && typeof data.token === "string" && data.token.length >= 30) {
        token = data.token;
        result = "success";
      } else if (data.detail === "google_link_required") result = "link_required";
      else if (data.detail === "google_exchange_failed" ||
               data.detail === "google_verification_failed" ||
               data.detail === "invalid_google_identity") result = "provider_failed";
      else if (data.detail === "google_already_linked" || data.detail === "google_account_conflict") result = "conflict";
    } catch { /* Keep provider details and credentials out of redirects/logs. */ }
  }
  const response = NextResponse.redirect(new URL("/profile?google="+result, origin),303);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  const secure = process.env.NODE_ENV === "production" || origin.startsWith("https:");
  response.cookies.set("tt_google_flow","",{httpOnly:true,sameSite:"lax",secure,path:"/api/auth/google",maxAge:0});
  if (token) response.cookies.set("tt_web_session",token,{
    httpOnly:true,sameSite:"strict",secure,path:"/api/gateway",maxAge:7*24*3600,
  });
  return response;
}
