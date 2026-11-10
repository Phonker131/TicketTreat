"use client";
import {useEffect,useState} from "react";

/* Events a guest marked with "Want" (swipe right or the heart). Stored per browser; booking stays separate. */
const KEY="tickettreat_wanted_events";
const CHANGE="tickettreat-wanted-change";

export function getWanted():number[]{
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||"[]");
  return Array.isArray(saved)?saved.filter((x):x is number=>typeof x==="number"):[];
 }catch{return [];}
}

export function setWanted(id:number,on:boolean):void{
 try{
  const ids=getWanted().filter(x=>x!==id);
  localStorage.setItem(KEY,JSON.stringify(on?[...ids,id]:ids));
  window.dispatchEvent(new Event(CHANGE));
 }catch{/* Browsing works without storage. */}
}

/** Live list of wanted ids plus a setter; every card and the saved list stay in sync. */
export function useWanted():[number[],(id:number,on:boolean)=>void]{
 const [ids,setIds]=useState<number[]>([]);
 useEffect(()=>{
  const sync=()=>setIds(getWanted());
  sync();
  window.addEventListener(CHANGE,sync);
  window.addEventListener("storage",sync);
  return()=>{window.removeEventListener(CHANGE,sync);window.removeEventListener("storage",sync)};
 },[]);
 return [ids,setWanted];
}
