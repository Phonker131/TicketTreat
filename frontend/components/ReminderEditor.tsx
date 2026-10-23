"use client";

import {useState} from "react";
import type {LanguageCode} from "@/lib/types";

type Props = {
  minutes: number[];
  onChange: (minutes: number[]) => void;
  message: string;
  onMessageChange: (value: string) => void;
  language: LanguageCode;
};

const PRESETS = [10080, 1440, 180, 60] as const;
const labels = {
  ru: {
    title: "Напоминания участникам",
    description: "Выбери от одного до четырёх моментов отправки до начала мероприятия.",
    quick: "Быстрый выбор",
    custom: "Добавить своё время",
    add: "Добавить",
    selected: "Выбранное расписание",
    remove: "Удалить",
    message: "Сообщение от организатора",
    placeholder: "Например: Ждём вас на событии! Вход с 17:30, покажите билет на входе.",
    hint: "Этот текст появится в каждом email-напоминании. В Telegram он отправляется один раз, в ближайший к событию выбранный момент. Только организационная информация, не реклама.",
    email: "Email: все выбранные интервалы — только подтверждённым владельцам билетов.",
    bot: "Telegram: одно напоминание — в ближайший к началу выбранный момент.",
    minutes: "минут",
    hours: "часов",
    days: "дней",
    limit: "Можно выбрать не больше 4 интервалов (от 15 минут до 7 дней).",
    atLeastOne: "Оставь хотя бы один интервал.",
    remaining: "доступно",
  },
  en: {
    title: "Attendee reminders",
    description: "Select one to four delivery times before the event starts.",
    quick: "Quick picks",
    custom: "Add custom lead time",
    add: "Add",
    selected: "Scheduled reminders",
    remove: "Remove",
    message: "Message from the organizer",
    placeholder: "We look forward to seeing you! Doors open at 17:30. Please show your ticket.",
    hint: "This message is included in every reminder email and one Telegram reminder at the closest selected time. Operational details only, no marketing.",
    email: "Email: all selected times, verified ticket holders only.",
    bot: "Telegram: one reminder, using the closest selected time.",
    minutes: "minutes",
    hours: "hours",
    days: "days",
    limit: "Choose up to four intervals, from 15 minutes to 7 days.",
    atLeastOne: "Keep at least one reminder.",
    remaining: "slots left",
  },
  cs: {
    title: "Připomínky účastníkům",
    description: "Zvolte jeden až čtyři časy odeslání před začátkem akce.",
    quick: "Rychlý výběr",
    custom: "Přidat vlastní čas",
    add: "Přidat",
    selected: "Rozvrh připomínek",
    remove: "Odebrat",
    message: "Zpráva od pořadatele",
    placeholder: "Těšíme se na vás! Vstup od 17:30, připravte si vstupenku.",
    hint: "Text se objeví v každém e-mailu a v jedné připomínce na Telegramu při nejbližším zvoleném čase. Pouze organizační informace, ne reklama.",
    email: "E-mail: všechny zvolené časy, pouze ověření držitelé vstupenek.",
    bot: "Telegram: jedna připomínka v nejbližším zvoleném čase.",
    minutes: "minut",
    hours: "hodin",
    days: "dní",
    limit: "Až čtyři intervaly, od 15 minut do 7 dní.",
    atLeastOne: "Ponechte alespoň jednu připomínku.",
    remaining: "volná místa",
  },
  uk: {
    title: "Нагадування учасникам",
    description: "Обери від одного до чотирьох моментів відправлення до початку події.",
    quick: "Швидкий вибір",
    custom: "Додати свій час",
    add: "Додати",
    selected: "Розклад нагадувань",
    remove: "Видалити",
    message: "Повідомлення від організатора",
    placeholder: "Чекаємо на вас! Вхід із 17:30, підготуйте квиток.",
    hint: "Цей текст буде в кожному email та одному нагадуванні Telegram у найближчий до події вибраний час. Лише організаційна інформація, не реклама.",
    email: "Email: усі обрані інтервали, тільки підтверджені власники квитків.",
    bot: "Telegram: одне нагадування в найближчий обраний час.",
    minutes: "хвилин",
    hours: "годин",
    days: "днів",
    limit: "До 4 інтервалів, від 15 хвилин до 7 днів.",
    atLeastOne: "Залиш хоча б одне нагадування.",
    remaining: "вільних місць",
  },
};

export function ReminderEditor({minutes,onChange,message,onMessageChange,language}:Props) {
  const words = labels[language] || labels.en;
  const [amount,setAmount] = useState("2");
  const [unit,setUnit] = useState<"minutes"|"hours"|"days">("hours");
  const [validation,setValidation] = useState("");
  const sorted=[...minutes].sort((a,b)=>b-a);
  function describe(n:number) {
    if(n % 1440===0) return `${n/1440} ${words.days}`;
    if(n % 60===0) return `${n/60} ${words.hours}`;
    return `${n} ${words.minutes}`;
  }
  function add(n:number) {
    if(!Number.isInteger(n)||n<15||n>10080||(!minutes.includes(n)&&minutes.length>=4)) {
      setValidation(words.limit);return;
    }
    setValidation("");
    if(!minutes.includes(n))onChange([...minutes,n].sort((a,b)=>b-a));
  }
  function remove(n:number) {
    if(minutes.length===1){setValidation(words.atLeastOne);return;}
    setValidation("");
    onChange(minutes.filter(value=>value!==n));
  }
  function addCustom() {
    const n=Number(amount)*(unit==="days"?1440:unit==="hours"?60:1);
    add(n);
  }
  return <section className="tt-reminder-editor" aria-label={words.title}>
    <h3>{words.title}</h3>
    <p className="form-note">{words.description}</p>
    <div className="tt-reminder-heading">{words.quick}</div>
    <div className="tt-reminder-chips">
      {PRESETS.map(n=><button key={n} className={minutes.includes(n)?"tt-reminder-chip is-selected":"tt-reminder-chip"}
        type="button" aria-pressed={minutes.includes(n)}
        onClick={()=>minutes.includes(n)?remove(n):add(n)}>
        {minutes.includes(n)?"✓ ":"+ "}{describe(n)}
      </button>)}
    </div>
    <div className="tt-reminder-heading">{words.custom}</div>
    <div className="tt-reminder-custom">
      <input type="number" min="1" step="1" inputMode="numeric" aria-label={words.custom}
        value={amount} onChange={e=>setAmount(e.target.value)}/>
      <select aria-label={words.custom} value={unit} onChange={e=>setUnit(e.target.value as typeof unit)}>
        <option value="minutes">{words.minutes}</option><option value="hours">{words.hours}</option><option value="days">{words.days}</option>
      </select>
      <button type="button" className="button button-outline" onClick={addCustom} disabled={minutes.length>=4}>{words.add}</button>
    </div>
    {validation&&<p role="alert" className="form-note" style={{color:"#ba3228"}}>{validation}</p>}
    <div className="tt-reminder-heading">{words.selected} · {minutes.length}/4</div>
    <div className="tt-reminder-chips">
      {sorted.map(n=><span className="tt-reminder-scheduled" key={n}>⏰ {describe(n)}
        <button type="button" aria-label={`${words.remove}: ${describe(n)}`} onClick={()=>remove(n)}>×</button>
      </span>)}
    </div>
    <label className="tt-reminder-label">{words.message}
      <textarea required rows={4} minLength={1} maxLength={1000} value={message}
        placeholder={words.placeholder} onChange={e=>onMessageChange(e.target.value)} />
      <small>{message.length}/1000</small>
    </label>
    <p className="form-note">{words.hint}</p>
    <p className="form-note">{words.email} {words.bot}</p>
  </section>;
}
