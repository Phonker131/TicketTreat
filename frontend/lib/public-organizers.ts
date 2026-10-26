import "server-only";
import type {OrganizerPublicSummary, OrganizerPublicDetail} from "@/lib/types";

const backend=(process.env.BACKEND_API_URL||"").trim().replace(/\/+$/,"");

async function fetchPublic<T>(path:string):Promise<T|null> {
  if (!/^https?:\/\//.test(backend)) return null;
  try {
    const result=await fetch(backend+path,{
      cache:"no-store",
      signal:AbortSignal.timeout(4500),
      redirect:"error"
    });
    return result.ok ? await result.json() as T : null;
  } catch {
    return null;
  }
}

/** Null means the API is unavailable, not that all organizers were deleted. */
export async function publicOrganizersStrict():Promise<OrganizerPublicSummary[]|null>{
  const result=await fetchPublic<unknown>("/demo/public/organizers");
  if(!Array.isArray(result)||!result.every(x=>x&&typeof x==="object"&&typeof x.slug==="string"))return null;
  return result as OrganizerPublicSummary[];
}
export async function publicOrganizers():Promise<OrganizerPublicSummary[]>{
  return await publicOrganizersStrict()||[];
}

export async function publicOrganizer(slug:string):Promise<OrganizerPublicDetail|null> {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,69}[a-z0-9])?$/.test(slug))return null;
  return fetchPublic<OrganizerPublicDetail>(`/demo/public/organizers/${encodeURIComponent(slug)}`);
}
