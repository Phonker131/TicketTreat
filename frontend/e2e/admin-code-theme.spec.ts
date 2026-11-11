import {expect,test} from "@playwright/test";

function luminance(color:string):number {
  const rgb=color.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
  if(rgb.length!==3)throw new Error("Unexpected CSS color "+color);
  const components=rgb.map(value=>{
    const c=value/255;
    return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
  });
  return .2126*components[0]+.7152*components[1]+.0722*components[2];
}
function contrast(a:string,b:string):number {
  const values=[luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (values[1]+.05)/(values[0]+.05);
}

test("printed ticket code form switches surfaces and remains readable in both themes",async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>{
    const container=document.createElement("div");
    container.className="app-shell";
    container.id="test-ticket-code-app";
    container.innerHTML=[
      '<div class="admin-heading"><h1>Organizer event</h1></div>',
      '<main class="page"><section class="panel">',
      '<form class="tt-printed-code-form">',
      '<label for="test-ticket-code">Admit by ticket code</label>',
      '<div class="tt-printed-code-inputs">',
      '<input id="test-ticket-code" placeholder="CRD-000123" />',
      '<button type="button" class="button button-primary" disabled>Admit ticket</button>',
      '</div><small>Spaces, letter case and O/0 or I/1 do not matter.</small>',
      '</form></section></main>'
    ].join("");
    document.body.appendChild(container);
  });
  async function sample(theme:"light"|"dark") {
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    return page.evaluate(()=>{
      const form=document.querySelector("#test-ticket-code-app .tt-printed-code-form")!;
      const label=form.querySelector("label")!;
      const small=form.querySelector("small")!;
      const input=form.querySelector("input")!;
      const disabled=form.querySelector("button")!;
      return {
        formBg:getComputedStyle(form).backgroundColor,
        labelFg:getComputedStyle(label).color,
        hintFg:getComputedStyle(small).color,
        inputBg:getComputedStyle(input).backgroundColor,
        inputFg:getComputedStyle(input).color,
        placeholder:getComputedStyle(input,"::placeholder").color,
        buttonBg:getComputedStyle(disabled).backgroundColor,
        buttonFg:getComputedStyle(disabled).color,
      };
    });
  }
  const light=await sample("light");
  const dark=await sample("dark");
  expect(light.formBg).not.toBe(dark.formBg);
  expect(light.inputBg).not.toBe(dark.inputBg);
  for(const style of [light,dark]){
    expect(contrast(style.labelFg,style.formBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.hintFg,style.formBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.inputFg,style.inputBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.placeholder,style.inputBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.buttonFg,style.buttonBg)).toBeGreaterThanOrEqual(4.5);
  }
});
