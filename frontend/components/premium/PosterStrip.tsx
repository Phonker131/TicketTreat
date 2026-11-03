import {BrandPhoto,type PhotoName} from "@/components/premium/BrandPhoto";
import type {LanguageCode} from "@/lib/types";

/* A slow strip of night-out photos with the kinds of evenings on TicketTreat. The list is drawn twice so the
   loop is seamless; the copy is hidden from screen readers. Reduced motion turns it into a plain scroll row. */
const items:{photo:PhotoName;label:Record<LanguageCode,string>}[]=[
 {photo:"sd",label:{ru:"Быстрые свидания",en:"Speed dating",cs:"Speed dating",uk:"Швидкі побачення"}},
 {photo:"quiz",label:{ru:"Квизы",en:"Quiz nights",cs:"Kvízy",uk:"Квізи"}},
 {photo:"mic",label:{ru:"Открытый микрофон",en:"Open mic",cs:"Open mic",uk:"Відкритий мікрофон"}},
 {photo:"night",label:{ru:"Вечеринки",en:"Parties",cs:"Večírky",uk:"Вечірки"}},
 {photo:"studios",label:{ru:"Тематические вечера",en:"Theme nights",cs:"Tematické večery",uk:"Тематичні вечори"}},
 {photo:"hero",label:{ru:"С друзьями",en:"With friends",cs:"S přáteli",uk:"З друзями"}},
 {photo:"cta",label:{ru:"Знакомства",en:"Meet people",cs:"Seznámení",uk:"Знайомства"}}
];
const title:Record<LanguageCode,string>={ru:"Какие вечера здесь бывают",en:"Nights you will find here",cs:"Jaké večery tu najdete",uk:"Які вечори тут бувають"};

export function PosterStrip({language}:{language:LanguageCode}){
 return <section className="tp-strip" aria-label={title[language]}>
  <ul className="tp-strip-track">
   {[...items,...items].map((it,i)=><li key={i} aria-hidden={i>=items.length||undefined}>
    <BrandPhoto name={it.photo} sizes="(max-width: 900px) 200px, 260px" className="tp-strip-photo"/>
    <span>{it.label[language]}</span>
   </li>)}
  </ul>
 </section>;
}
