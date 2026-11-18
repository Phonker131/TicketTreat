import {test,expect} from "@playwright/test";
for(const width of [600,768,820,1024,1180]){
test("tablet toolbar "+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto("/tickets?lang=en");
 const nav=page.locator("#tt-primary-nav");
 await expect(nav).toBeHidden();
 const menu=page.getByRole("button",{name:"Open menu",exact:true});
 await expect(menu).toBeVisible();
 await menu.click();
 await expect(nav).toBeVisible();
 const box=await nav.boundingBox();
 expect(box!.x).toBeGreaterThanOrEqual(0);
 expect(box!.x+box!.width).toBeLessThanOrEqual(width);
 expect(await nav.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2);
 await page.keyboard.press("Escape");
 await expect(nav).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
}
