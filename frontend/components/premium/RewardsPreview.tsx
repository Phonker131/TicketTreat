"use client";
import Link from "next/link";
import type {LanguageCode} from "@/lib/types";
import {RewardsRules,RewardsTrack,progressLine,rewardsCopy} from "@/components/premium/RewardsTrack";

/** Rewards in one block for a guest (or an account with no visits yet):
 * the four levels on one line with an example position, then the three counting rules. */
export function RewardsPreview({language,mode}:{language:LanguageCode;mode:"guest"|"empty"}){
 const c=rewardsCopy[language];
 return <section className="tt-rw" aria-labelledby="tp-rewards-title">
  <div className="tt-rw-head">
   <div>
    <h2 id="tp-rewards-title">{c.title}</h2>
    <p>{c.lead}</p>
   </div>
   <div className="tt-rw-actions">
    {mode==="guest"&&<Link href="/profile" className="button button-primary">{c.signin}</Link>}
    <Link href="/" className={"button "+(mode==="guest"?"button-secondary":"button-primary")}>{c.find}</Link>
   </div>
  </div>
  <div className="tt-rw-card">
   <p className="tt-rw-progress"><span>{c.example}</span>{progressLine(language,0)}</p>
   <RewardsTrack language={language} visits={0}/>
  </div>
  <RewardsRules language={language}/>
 </section>;
}
