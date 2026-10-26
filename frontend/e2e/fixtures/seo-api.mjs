// Loopback-only disposable API. Started AFTER next build by playwright.seo.config.ts.
import {createServer} from "node:http";
const future = new Date(Date.now() + 7 * 86400000).toISOString();
const past = new Date(Date.now() - 7 * 86400000).toISOString();
const event = {
  id: 910001, title: "SEO fixture event", organizer: "SEO fixture organizer",
  location: "Prague", city: "Prague", country_code: "CZ", description: "SEO fixture description",
  starts_at: future, is_cancelled: false, price: "0", currency: "CZK", languages: ["en"],
  max_participants: 20, registered_count: 0, spots_left: 20, image_url: null,
  publication: {status: "published", visible: true, publish_at: null},
};
const events = [event,
  {...event, id: 910002, starts_at: past},
  {...event, id: 910003, is_cancelled: true},
  {...event, id: 910004, publication: {status: "draft", visible: false, publish_at: null}},
  {...event, id: 910005, starts_at: null},
  {...event, id: 910006, starts_at: "invalid-date"},
  {...event, id: 910007, title: " "},
];
const organizer = {
  slug: "seo-fixture", display_name: "SEO fixture organizer", bio: "SEO fixture bio", city: "Prague",
  website_url: "", instagram: "", logo_url: null, cover_url: null,
};
let eventsAvailable=true,organizersAvailable=true;
const routes = new Map([
  ["/health", {ok: true}], ["/events", events], ["/events/910001", event],
  ["/demo/public/organizers", [organizer]],
  ["/demo/public/organizers/seo-fixture", {...organizer, upcoming_events: [event], past_events: [], upcoming_count: 1, past_count: 0}],
]);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if(path==="/_fixture/fail-events"){eventsAvailable=false;res.writeHead(200);res.end("ok");return;}
  if(path==="/_fixture/recover-events"){eventsAvailable=true;res.writeHead(200);res.end("ok");return;}
  if(path==="/_fixture/fail-organizers"){organizersAvailable=false;res.writeHead(200);res.end("ok");return;}
  if(path==="/_fixture/recover-organizers"){organizersAvailable=true;res.writeHead(200);res.end("ok");return;}
  if((path==="/events"&&!eventsAvailable)||(path==="/demo/public/organizers"&&!organizersAvailable)){
    res.writeHead(503,{"Content-Type":"application/json"});res.end('{"detail":"fixture unavailable"}');return;
  }
  res.writeHead(routes.has(path) ? 200 : 404, {"Content-Type": "application/json", "Cache-Control": "no-store"});
  res.end(JSON.stringify(routes.get(path) ?? {detail: "Not found"}));
});
server.listen(8100, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
