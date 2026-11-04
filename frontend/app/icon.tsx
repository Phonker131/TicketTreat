import {readFileSync} from "node:fs";
import {join} from "node:path";

// Mirrors the official SVG favicon also used in the site's legal footer.
export const runtime="nodejs";
export const contentType="image/svg+xml";
export const size={width:192,height:192};

export default function Icon(): Response {
  return new Response(readFileSync(join(process.cwd(),"public","favicon.svg")),{
    headers:{"Content-Type":"image/svg+xml","Cache-Control":"public, max-age=3600"},
  });
}
