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

export async function publicOrganizers():Promise<OrganizerPublicSummary[]> {
  return await fetchPublic<OrganizerPublicSummary[]>("/demo/public/organizers")||[];
}

export async function publicOrganizer(slug:string):Promise<OrganizerPublicDetail|null> {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,69}[a-z0-9])?$/.test(slug))return null;
  return fetchPublic<OrganizerPublicDetail>(`/demo/public/organizers/${encodeURIComponent(slug)}`);
}
