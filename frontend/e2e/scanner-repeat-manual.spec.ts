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
  await page.route("**/api/gateway/**/pilot/check-in-access",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({can_scan_all:true,events:[]})
  }));
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
    await expect(page.getByTestId("checkin-feedback")).toHaveClass(/tt-checkin-feedback--success/);
    await expect(page.getByTestId("checkin-feedback")).toContainText("ENTRY CONFIRMED");
    await expect(page.getByTestId("checkin-feedback")).toContainText("Admit this guest");
  }
  expect(submitted).toEqual(["CRD000001","CRD000002","CRD000003","CRD000004"]);
  expect(errors).toEqual([]);
});

test("scanner displays clear green success, red duplicate and red verification failure",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  await page.route("**/api/gateway/**/pilot/check-in-access",route=>route.fulfill({
    json:{can_scan_all:true,events:[]}
  }));
  let attempt=0;
  await page.route("**/api/gateway/**/pilot/check-in",route=>{
    attempt++;
    if(attempt===3)return route.fulfill({status:404,json:{error:"ticket_not_found"}});
    return route.fulfill({json:{status:attempt===1?"checked_in":"already_checked_in",ticket:{
      id:91,code:"CRD-000091",guest:{first_name:"Alex",last_name:"Guest"},
      event:{id:42,title:"Werewolf Night"}
    }}});
  });
  await page.goto("/admin/check-in?lang=en");
  const input=page.locator("#tickettreat-manual-token");
  const submit=page.locator(".tt-checkin-buttons .button-primary");
  const feedback=page.getByTestId("checkin-feedback");

  await input.fill("CRD000091");
  await submit.click();
  await expect(feedback).toHaveClass(/tt-checkin-feedback--success/);
  await expect(feedback).toHaveAttribute("role","status");
  await expect(feedback).toContainText("ENTRY CONFIRMED");
  await expect(feedback).toContainText("Alex Guest");
  await expect(page.getByTestId("checkin-toast")).toBeVisible();

  await input.fill("CRD000091");
  await submit.click();
  await expect(feedback).toHaveClass(/tt-checkin-feedback--duplicate/);
  await expect(feedback).toHaveAttribute("role","alert");
  await expect(feedback).toContainText("TICKET ALREADY USED");
  await expect(feedback).toContainText("Do not admit again");

  await input.fill("INVALID");
  await submit.click();
  await expect(feedback).toHaveClass(/tt-checkin-feedback--error/);
  await expect(feedback).toContainText("CHECK-IN NOT CONFIRMED");
  await expect(feedback).toContainText("Do not admit until");
  await expect(page.locator(".checkin-result")).toHaveCount(0);
  expect(attempt).toBe(3);
});
