
import {readFileSync} from "node:fs";
import {join} from "node:path";
// Use the exact approved TicketTreat favicon vector rather than the legacy TT mark.
export const runtime="nodejs";
export const contentType="image/svg+xml";
export const size={width:128,height:128};
export default function Icon(): Response {
  const svg=readFileSync(join(process.cwd(),"public","favicon.svg"),"utf8");
  return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Cache-Control":"public, max-age=3600"}});
}
