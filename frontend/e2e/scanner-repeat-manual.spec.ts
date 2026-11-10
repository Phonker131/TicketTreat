import {expect,test} from "@playwright/test";

// Camera permission is intentionally absent in CI. The fallback must work
// repeatedly in the same mounted component even when camera startup fails.
test("manual staff check-in accepts four consecutive printed ticket codes",async({page})=>{
  const errors:string[]=[];
  const submitted:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem("tickettreat_web_auth","browser-session");
  });
  await page.route("**/api/gateway/api/v1/pilot/check-in",async route=>{
    const data=route.request().postDataJSON() as {qr_token:string};
    submitted.push(data.qr_token);
    const id=submitted.length;
    await route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify({status:"checked_in",ticket:{
        id,code:`CRD-${String(id).padStart(6,"0")}`,
        guest:{first_name:"Test",last_name:`Guest ${id}`},
        event:{title:"CI admission test"}
      }})
    });
  });
  await page.goto("/admin/check-in?lang=en");
  const input=page.locator("#tickettreat-manual-token");
  await expect(input).toBeVisible();
  const checkin=page.locator(".tt-checkin-buttons .button-primary");
  for(let id=1;id<=4;id++){
    const code=`CRD${String(id).padStart(6,"0")}`;
    await input.fill(code);
    await checkin.click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".checkin-result")).toContainText(`Guest ${id}`);
  }
  expect(submitted).toEqual(["CRD000001","CRD000002","CRD000003","CRD000004"]);
  expect(errors).toEqual([]);
});
