"use client";
import {useMemo} from "react";
import type {LanguageCode} from "@/lib/types";

type CountryCityProps = {
  countryCode: string;
  city: string;
  onCountryChange: (value: string) => void;
  onCityChange: (value: string) => void;
  language?: LanguageCode;
  required?: boolean;
};

const COUNTRY_CODES = Array.from({length:26*26},(_,n)=>
  String.fromCharCode(65+Math.floor(n/26),65+(n%26))
);
const englishNames=new Intl.DisplayNames(["en"],{type:"region"});
const VALID_COUNTRIES=COUNTRY_CODES.filter(code=>{
  const name=englishNames.of(code);
  return !!name && name !== code && !["EU","UN","EZ","QO"].includes(code);
});
const CAPTIONS:Record<LanguageCode,{country:string;city:string;choose:string;hint:string}> = {
  ru:{country:"Страна",city:"Город",choose:"Выбери страну",hint:"Город проживания, например Praha или Brno"},
  uk:{country:"Країна",city:"Місто",choose:"Обери країну",hint:"Наприклад, Praha або Brno"},
  cs:{country:"Země",city:"Město",choose:"Vyber zemi",hint:"Například Praha nebo Brno"},
  en:{country:"Country",city:"City",choose:"Choose a country",hint:"For example, Prague or Brno"},
};

export function CountryCityFields({
  countryCode,city,onCountryChange,onCityChange,language="en",required=true,
}:CountryCityProps){
  const names=useMemo(()=>{
    const display=new Intl.DisplayNames([language],{type:"region"});
    return VALID_COUNTRIES.map(code=>({code,name:display.of(code)||code}))
      .sort((a,b)=>a.name.localeCompare(b.name,language));
  },[language]);
  const t=CAPTIONS[language];
  return <div className="two-col location-fields">
    <label>{t.country}
      <select value={countryCode} required={required} onChange={e=>onCountryChange(e.target.value)}>
        <option value="">{t.choose}</option>
        {names.map(item=><option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
      </select>
    </label>
    <label>{t.city}
      <input value={city} required={required} maxLength={100} autoComplete="address-level2"
        placeholder={t.hint} onChange={e=>onCityChange(e.target.value)} />
    </label>
  </div>;
}
