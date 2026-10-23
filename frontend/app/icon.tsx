import {readFileSync} from "node:fs";
import {join} from "node:path";

export const runtime="nodejs";
export const contentType="image/png";
export const size={width:48,height:48};

export default function Icon(): Response {
  return new Response(readFileSync(join(process.cwd(),"public","favicon-48.png")),
    {headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=3600"}});
}
