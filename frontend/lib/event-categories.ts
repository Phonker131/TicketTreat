"use client";

import {useEffect,useState} from "react";
import {getEventCategories,type EventCategory} from "@/lib/api";
import type {LanguageCode} from "@/lib/types";

/** Legacy category names stay available while the catalog request is loading. */
export const DEFAULT_CATEGORIES:EventCategory[]=[
 {key:"meet",en:"Meet people",cs:"Seznámit se",active:true},
 {key:"friends",en:"With friends",cs:"S přáteli",active:true},
 {key:"listen",en:"Listen",cs:"Poslechnout",active:true},
 {key:"dance",en:"Dance",cs:"Zatančit",active:true},
];

let cache:EventCategory[]|null=null;
let pending:Promise<EventCategory[]>|null=null;

function loadCatalog():Promise<EventCategory[]> {
 if(cache)return Promise.resolve(cache);
 if(!pending)pending=getEventCategories().then(rows=>{
   cache=Array.isArray(rows)?rows.filter(row=>typeof row.key==="string"&&typeof row.en==="string"&&typeof row.cs==="string"):DEFAULT_CATEGORIES;
   return cache;
 }).finally(()=>{pending=null});
 return pending;
}

export function invalidateEventCategories(){cache=null;pending=null;}

export function useEventCategories():EventCategory[]{
 const [categories,setCategories]=useState<EventCategory[]>(cache||DEFAULT_CATEGORIES);
 useEffect(()=>{let live=true;loadCatalog().then(rows=>{if(live)setCategories(rows)}).catch(()=>{});
   return()=>{live=false};
 },[]);
 return categories;
}

export function categoryLabel(category:EventCategory,language:LanguageCode):string {
 return language==="cs"?category.cs:category.en;
}

export function categoryFor(key:string,categories:EventCategory[]):EventCategory|undefined {
 return categories.find(category=>category.key===key);
}
