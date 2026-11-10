import type {LanguageCode} from "@/lib/types";

/** Event sub-themes. Organizers pick them in the dashboard; the home page filters by them. */
export type EventTag="meet"|"friends"|"listen"|"dance";
export const EVENT_TAGS:EventTag[]=["meet","friends","listen","dance"];

export const TAG_LABELS:Record<LanguageCode,Record<EventTag,string>>={
 ru:{meet:"Познакомиться",friends:"С друзьями",listen:"Послушать",dance:"Потанцевать"},
 cs:{meet:"Seznámit se",friends:"S přáteli",listen:"Poslechnout",dance:"Zatančit"},
 uk:{meet:"Познайомитися",friends:"З друзями",listen:"Послухати",dance:"Потанцювати"},
 en:{meet:"Meet people",friends:"With friends",listen:"Listen",dance:"Dance"}
};

/* Keyword fallback for events created before organizers could tag them. */
const KEYWORDS:Record<EventTag,RegExp>={
 meet:/dating|знаком|знайом|seznam|singles|rande|speed.date/i,
 friends:/quiz|квиз|квіз|kvíz|trivia|board.game|друз|přátel|friends|hospoda|pub|liar|мафи|mafia/i,
 listen:/music|музык|музик|koncert|concert|open.mic|stand.up|комед|комеді|послуш|poslech/i,
 dance:/dance|танц|танцю|taneč|party|dj|klub|club|disco/i
};

export function isEventTag(value:unknown):value is EventTag{
 return typeof value==="string"&&(EVENT_TAGS as string[]).includes(value);
}

/** Explicit organizer tags win; otherwise the title and description are matched by keywords. */
export function eventTags(event:{tags?:string[]|null;title:string;description?:string|null}):EventTag[]{
 const explicit=(event.tags||[]).filter(isEventTag);
 if(explicit.length)return explicit;
 const text=[event.title,event.description||""].join(" ");
 return EVENT_TAGS.filter(tag=>KEYWORDS[tag].test(text));
}

const ICONS:Record<EventTag|"all"|"saved",React.ReactNode>={
 all:<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/></>,
 saved:<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>,
 meet:<><circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.6"/><path d="M3 19c.5-3.4 2.7-5.2 5.5-5.2 1.5 0 2.8.5 3.8 1.4M14 14.3c2.9-.5 5.4 1 6 4.7"/><path d="M13.5 5.5l1-1 1 1"/></>,
 friends:<><circle cx="12" cy="7" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M4 9h3M17 9h3M5.5 6.5l2 1.5M18.5 6.5l-2 1.5"/></>,
 listen:<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zm16 0h-3v5h2a1 1 0 0 0 1-1z"/>,
 dance:<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>
};

export function TagIcon({tag,size=18}:{tag:EventTag|"all"|"saved";size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[tag]}</svg>;
}
