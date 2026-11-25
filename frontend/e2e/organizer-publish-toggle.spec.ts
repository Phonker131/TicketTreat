import {expect,test} from "@playwright/test";

const profile={
  slug:"sample-organizer",display_name:"Sample Organizer",bio:"",
  city:"",website_url:"",instagram:"",logo_url:null,cover_url:null,published:false,
};

for(const width of [320,375,390,430,768]){
  test(`organizer publish checkbox has a readable label at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:812});
    await page.route("**/api/gateway/api/v1/manage/organizer-profile",route=>route.fulfill({
      status:200,contentType:"application/json",body:JSON.stringify(profile),
    }));
    await page.goto("/admin/organizer-profile?lang=en");

    const toggle=page.locator(".organizer-publish-toggle");
    const checkbox=toggle.getByRole("checkbox",{name:"Publish profile"});
    await expect(checkbox).toBeVisible();
    await expect(toggle.locator("span")).toHaveText("Publish profile");

    const dimensions=await toggle.evaluate(label=>{
      const box=label.getBoundingClientRect();
      const checkboxBox=label.querySelector("input")!.getBoundingClientRect();
      const textBox=label.querySelector("span")!.getBoundingClientRect();
      return {
        checkboxWidth:checkboxBox.width,
        labelRight:box.right,
        textLeft:textBox.left,
        textRight:textBox.right,
        textWidth:textBox.width,
        textHeight:textBox.height,
        viewportWidth:window.innerWidth,
        documentWidth:document.documentElement.scrollWidth,
      };
    });
    expect(dimensions.checkboxWidth).toBeGreaterThanOrEqual(18);
    expect(dimensions.checkboxWidth).toBeLessThanOrEqual(28);
    expect(dimensions.textWidth).toBeGreaterThan(100);
    expect(dimensions.textHeight).toBeLessThan(50);
    expect(dimensions.textLeft).toBeGreaterThan(0);
    expect(dimensions.textRight).toBeLessThanOrEqual(dimensions.labelRight+1);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth+1);

    await toggle.click();
    await expect(checkbox).toBeChecked();
  });
}
