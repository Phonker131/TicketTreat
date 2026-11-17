import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAeCAIAAAC5TEmyAAAAJUlEQVR4nGO8E6DBQA3ARBVTRg0aNWjUoFGDRg0aNWjUoBFnEABkigGQbJ8CQgAAAABJRU5ErkJggg==','base64');
const event={id:991,title:'Poster test',organizer:'Host',location:'Prague',description:'Test event',max_participants:20,registered_count:0,price:'0',currency:'CZK',languages:['en'],image_url:null as string|null,starts_at:'2026-12-30T18:00:00',is_cancelled:false,publication:{status:'published',visible:true},visibility:'public',owner_account_id:1,gallery_urls:[],uploaded_gallery:[]};
test('large phone poster saves independently and remains after reload',async({page})=>{
  let saved={...event},patch:any;
  await page.addInitScript(()=>localStorage.setItem('tickettreat_web_auth','browser-session'));
  await page.route('**/api/gateway/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/manage/me'))return route.fulfill({json:{account_id:1,role:'organizer'}});
    if(path.endsWith('/manage/events/991/participants'))return route.fulfill({json:{event:saved,tickets:[],waitlist:[]}});
    if(path.endsWith('/manage/events/991')){
      if(route.request().method()==='PATCH'){patch=route.request().postDataJSON();saved={...saved,image_url:patch.poster_data_url};}
      return route.fulfill({json:saved});
    }
    return route.fulfill({status:404,json:{detail:'fixture'}});
  });
  await page.goto('/admin/events/991?lang=en#details');
  await page.locator('input[type=file]').last().setInputFiles({name:'phone.png',mimeType:'image/png',buffer:Buffer.concat([png,Buffer.alloc(5*1024*1024)])});
  await page.getByRole('button',{name:'Save poster only',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Poster saved.'})).toBeVisible();
  expect(Object.keys(patch)).toEqual(['poster_data_url']);
  expect(patch.poster_data_url).toMatch(/^data:image\/jpeg;base64,/);
  await page.reload();
  await expect(page.locator('img[alt="Event poster"]')).toHaveAttribute('src',saved.image_url!);
});
test('broadcast photo can be uploaded from device without sending messages',async({page})=>{
  let uploads=0,sends=0;
  await page.addInitScript(()=>localStorage.setItem('tickettreat_web_auth','browser-session'));
  await page.route('**/api/gateway/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/manage/me'))return route.fulfill({json:{account_id:1,role:'global_admin'}});
    if(path.endsWith('/manage/events'))return route.fulfill({json:[]});
    if(path.endsWith('/manage/broadcasts')){if(route.request().method()==='POST')sends++;return route.fulfill({json:[]});}
    if(path.endsWith('/manage/broadcast-images')){uploads++;expect(route.request().postDataJSON().data_url).toMatch(/^data:image\/png/);return route.fulfill({json:{url:'https://example.invalid/uploaded.png'}});}
    return route.fulfill({status:404,json:{detail:'fixture'}});
  });
  await page.goto('/admin/broadcasts?lang=en');
  await page.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await expect(page.getByRole('status').filter({hasText:'Image uploaded.'}).first()).toBeVisible();
  expect(uploads).toBe(1);expect(sends).toBe(0);
  await expect(page.getByRole('img',{name:'Image preview'})).toHaveAttribute('src','https://example.invalid/uploaded.png');
});
