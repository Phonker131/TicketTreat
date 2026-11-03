import {test,expect} from "@playwright/test";

function luminance(value:string){
  const m=value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if(!m)throw new Error("Unexpected color "+value);
  const a=[m[1],m[2],m[3]].map(x=>{const n=Number(x)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});
  return a[0]*.2126+a[1]*.7152+a[2]*.0722;
}
function contrast(text:string,bg:string){
  const a=luminance(text),b=luminance(bg);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
test("dark organizer heading and badge have readable text; hover creates no ghost plate",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>localStorage.setItem("tt4-theme","dark"));
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
  await page.evaluate(()=>{
    document.querySelector(".app-shell")?.insertAdjacentHTML("beforeend",`
      <main class="page">
        <div class="admin-heading" data-admin-dark-regression>
          <div><span class="status status-demo">Global administrator</span>
            <h1>All TicketTreat events</h1><p>Full access, organizer assignments and moderation.</p></div>
          <div class="admin-event-actions">
            <a class="button button-outline" href="#panel">Organizer profile</a>
            <a class="button button-primary" href="#panel">Analytics</a>
          </div>
        </div>
      </main>`);
  });
  const target=page.locator("[data-admin-dark-regression]");
  const result=await target.evaluate(el=>{
    const title=el.querySelector("h1")!,p=el.querySelector("p")!,badge=el.querySelector(".status")!;
    const bg=getComputedStyle(document.querySelector(".app-shell")!).backgroundColor;
    return {bg,items:[title,p,badge].map(x=>({
      text:getComputedStyle(x).color,
      background:getComputedStyle(x).backgroundColor,
      rect:x.getBoundingClientRect().toJSON()
    }))};
  });
  for(let i=0;i<2;i++)expect(contrast(result.items[i].text,result.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(result.items[2].text,result.items[2].background)).toBeGreaterThanOrEqual(4.5);
  await target.locator(".button-outline").hover();
  const hover=await target.locator(".button-outline").evaluate(x=>({
    foreground:getComputedStyle(x).color,background:getComputedStyle(x).backgroundColor,
    shadow:getComputedStyle(x).boxShadow}));
  expect(contrast(hover.foreground,hover.background)).toBeGreaterThanOrEqual(4.5);
  expect(hover.shadow).toBe("none");
  expect(await target.locator(".status").count()).toBe(1);
});

test("short pages keep footer below content with no trailing blank body",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".topbar")).toBeVisible();
  const geometry=await page.evaluate(()=>{
    const body=getComputedStyle(document.body);
    const footer=document.querySelector("footer.tt-legal-footer")!;
    return {display:body.display,direction:body.flexDirection,footerBottom:footer.getBoundingClientRect().bottom,scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  expect(geometry.display).toBe("flex");
  expect(geometry.direction).toBe("column");
  expect(geometry.overflow).toBe(false);
  // Once fully scrolled to the bottom, the footer is the final in-flow element.
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await expect.poll(async()=>page.evaluate(()=>{
    const r=document.querySelector("footer.tt-legal-footer")!.getBoundingClientRect();
    return Math.abs(innerHeight-r.bottom)<80;
  })).toBe(true);
});
