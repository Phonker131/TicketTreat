export type Event = {id:number;title:string;description?:string;location?:string;starts_at?:string;price?:string|number;currency?:string;registered_count?:number;max_participants?:number;image_url?:string;payment_status?:string;payment_instructions?:string};
export type Me = {id:number;email:string|null;telegram_connected:boolean;first_name:string|null;last_name:string|null;phone:string|null;contact_preference:string|null;instagram:string|null;complete:boolean};
const base = (import.meta.env.VITE_API_URL || '') + '/api/v1';
let token:string|null = sessionStorage.getItem('tt_token');
export const setToken=(v:string|null)=>{token=v;if(v)sessionStorage.setItem('tt_token',v);else sessionStorage.removeItem('tt_token');};
export async function api<T>(path:string, options:RequestInit={}):Promise<T>{
 const headers:Record<string,string>={'Content-Type':'application/json',...(options.headers as Record<string,string>||{})};
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(base+path,{...options,headers});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Ошибка '+response.status);
 return data as T;
}
export const post=<T>(path:string,body:unknown)=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
export async function telegramSession(initData:string){const response=await fetch(base+'/auth/telegram',{method:'POST',headers:{Authorization:'tma '+initData}});const body=await response.json();if(!response.ok)throw new Error(body.detail||'Telegram authorization failed');setToken(body.access_token);}
