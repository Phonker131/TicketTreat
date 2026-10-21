import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin backend gateway. Browser users never receive web bearer tokens.
 * The HttpOnly cookie is scoped to this gateway, and the gateway forwards
 * the token only to a configured, trusted backend origin.
 */
const COOKIE = "tt_web_session";
const MARKER = "browser-session";
const base = (process.env.BACKEND_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000")).replace(/\/+$/, "");
if (!base || !/^https?:\/\//.test(base)) {
  throw new Error("BACKEND_API_URL must be explicitly configured");
}
const sessionPaths = new Set(["/demo/auth/login", "/demo/auth/signup", "/demo/auth/change-password", "/demo/auth/magic/confirm"]);
const logoutPaths = new Set(["/demo/auth/logout", "/demo/auth/logout-all"]);
const supported = new Set(["GET","POST","PATCH","PUT","DELETE"]);

async function gateway(req: NextRequest, context:{params:Promise<{path:string[]}>}){
  const method = req.method;
  if (!supported.has(method)) return NextResponse.json({detail:"method_not_allowed"},{status:405});
  const {path} = await context.params;
  const relative = "/" + path.map(encodeURIComponent).join("/");
  if (relative === "/demo/auth/google/finish") return NextResponse.json({detail:"path_not_allowed"},{status:404});
  if (!relative.startsWith("/demo/") && relative !== "/events" && !/^\/events\/\d+$/.test(relative) && relative !== "/") {
    return NextResponse.json({detail:"path_not_allowed"},{status:404});
  }
  if (req.nextUrl.search.length > 2048) return NextResponse.json({detail:"query_too_long"},{status:400});
  if (!["GET"].includes(method)){
    const origin = req.headers.get("origin");
    const fetchSite = req.headers.get("sec-fetch-site");
    // A trusted edge proxy may forward HTTPS as internal HTTP. Validate the
    // origin against the externally requested host, not the proxy's scheme.
    let validOrigin = false;
    try {
      const parsed = new URL(origin || "");
      validOrigin = parsed.host === req.headers.get("host") &&
        (process.env.NODE_ENV !== "production" || parsed.protocol === "https:");
    } catch { /* Missing or malformed Origin is rejected. */ }
    if (!validOrigin || (fetchSite && fetchSite !== "same-origin")) {
      return NextResponse.json({detail:"cross_origin_denied"},{status:403});
    }
    // Prefer the TicketTreat header; accept the legacy header for already-open clients.
    if (req.headers.get("x-tickettreat-client") !== "1" && req.headers.get("x-crowdly-client") !== "1") return NextResponse.json({detail:"client_header_required"},{status:403});
  }
  const headers = new Headers();
  headers.set("Accept","application/json");
  const contentType = req.headers.get("content-type");
  if (contentType)headers.set("Content-Type",contentType);
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase() === "bearer "+MARKER){
    const token = req.cookies.get(COOKIE)?.value;
    if (!token)return NextResponse.json({detail:"login_required"},{status:401});
    headers.set("Authorization","Bearer "+token);
  }else if(auth && !auth.startsWith("Bearer ")){
    return NextResponse.json({detail:"authorization_not_supported"},{status:400});
  }else if(auth){
    // Legacy website sessions may not be forwarded: they must log in again.
    return NextResponse.json({detail:"please_login_again"},{status:401});
  }
  const signedLaunch = req.headers.get("x-telegram-init-data");
  if (signedLaunch && signedLaunch.length <= 8192) {
    headers.set("X-Telegram-Init-Data", signedLaunch);
  }
  // Legacy browser-wide administration keys never transit the public BFF.
  // Organizers use /demo/manage/* with scoped, revocable web sessions.
  if (relative.startsWith("/demo/admin/")) {
    return NextResponse.json({detail:"legacy_admin_endpoint_disabled"},{status:403});
  }
  const raw=method==="GET"?undefined:await req.arrayBuffer();
  if(raw && raw.byteLength>6_000_000)return NextResponse.json({detail:"request_too_large"},{status:413});
  let upstream:Response;
  try{
    upstream=await fetch(base+relative+req.nextUrl.search,{method,headers,body:raw,cache:"no-store",redirect:"manual"});
  }catch{
    return NextResponse.json({detail:"backend_unavailable"},{status:502});
  }
  const outType=upstream.headers.get("content-type")||"application/json";
  const init:ResponseInit={status:upstream.status,headers:{"Content-Type":outType,"Cache-Control":"private, no-store"}};
  // Never forward Set-Cookie or upstream redirections.
  if(upstream.status>=300&&upstream.status<400)return NextResponse.json({detail:"redirect_denied"},{status:502});
  if (relative === "/demo/auth/google/start" && upstream.ok) {
    const data = await upstream.json().catch(() => null);
    if (!data || typeof data.browser_token !== "string" || typeof data.url !== "string")
      return NextResponse.json({detail:"malformed_google_response"},{status:502});
    const response = NextResponse.json({url:data.url},{headers:{"Cache-Control":"no-store"}});
    response.cookies.set("tt_google_flow",data.browser_token,{httpOnly:true,sameSite:"lax",
      secure:process.env.NODE_ENV==="production" || req.nextUrl.protocol==="https:",
      path:"/api/auth/google",maxAge:600});
    return response;
  }
  const shouldSave=sessionPaths.has(relative) && upstream.ok;
  const shouldClear=logoutPaths.has(relative) && upstream.ok;
  if(shouldSave){
    const data=await upstream.json().catch(()=>null);
    if(!data || typeof data.token!=="string" || data.token.length<30)
      return NextResponse.json({detail:"malformed_session_response"},{status:502});
    const token=data.token;
    const response=NextResponse.json({...data,token:MARKER},{status:upstream.status,headers:{"Cache-Control":"private, no-store"}});
    response.cookies.set(COOKIE,token,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production" || req.nextUrl.protocol==="https:",path:"/api/gateway",maxAge:7*24*3600});
    return response;
  }
  const bytes=await upstream.arrayBuffer();
  const response=new NextResponse(bytes,init);
  if(shouldClear)response.cookies.set(COOKIE,"",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production" || req.nextUrl.protocol==="https:",path:"/api/gateway",maxAge:0});
  return response;
}
export {gateway as GET,gateway as POST,gateway as PATCH,gateway as PUT,gateway as DELETE};
