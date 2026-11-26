// Keyed by the published source text so repeated dates share a translation
// and a changed programme immediately falls back to the organizer's new text.
const translations: Record<number, string> = {
  404009319: `Liar’s Bar je karetní hra o blafování inspirovaná stejnojmennou videohrou. Hrajeme naživo u stolů pro 4 až 6 lidí. Pravidla vysvětlí moderátor, který vás také provede celou hrou.

Jak se hraje

1. Každý dostane do ruky několik karet. V balíčku jsou králové, dámy, esa a pár žolíků.
2. Na začátku kola moderátor určí hodnotu karty, třeba dámu.
3. Když jsi na tahu, položíš jednu až tři karty lícem dolů a řekneš, kolik dam vykládáš. Můžeš mluvit pravdu, nebo blafovat. Žolík se počítá jako dáma.
4. Další hráč ti buď uvěří a hraje dál, nebo řekne „Lžeš!“ a tvoje karty otočí.
5. Pokud mezi nimi byla jediná karta jiné hodnoty než dáma nebo žolík, kolo prohráváš. Pokud všechny odpovídají, prohrává ten, kdo tě obvinil.
6. Poražený si lízne kartu ze svého „revolveru“: před každým hráčem leží šest karet lícem dolů, pět prázdných a jedna s nábojem. Prázdná tě nechá ve hře, ale příště už vybíráš z méně karet. Náboj znamená konec hry.
7. Další kolo začíná s novou hodnotou karty. Vyhrává poslední hráč u stolu.

Videohru znát nemusíš. Vysvětlení zabere asi pět minut a první kolo si s vámi zahraje moderátor. Přijď klidně sólo nebo s přáteli, místo u stolu ti najdeme.`,
  2051585568: `Udrž své tajemství, nikomu nevěř a do konce večera odhal, kdo lže. Představ si Městečko Palermo, ve kterém má každá postava vlastní roli a příběh.

Každý dostane zalepenou obálku s tajnou rolí. V noci jednají skryté postavy. Ve dne město diskutuje, obviňuje, hájí se a hlasuje. Někdo u stolu ví, co se skutečně stalo. Jenže pravdu neřekne každý.

Vyřadili tě? Hraješ dál jako Stín. Už nesmíš mluvit, ale živí tě mohou vyvolat. U spiritistické tabulky Stíny společně pohybují ukazatelem a písmeno po písmenu předávají, co vědí. Mají také vedlejší úkoly, které mohou změnit konec příběhu.

Na závěr se odhalí všechny role i lži a vypravěč prozradí, co se doopravdy stalo.

• Pravidla pochopíš za pět minut. Hledáním lháře strávíš celý večer.
• Hraje 14 až 28 lidí pod vedením vypravěče. Každý večer ožívá jiný pražský příběh.
• Zkušenosti nepotřebuješ. Přijď sólo, ve dvou nebo s celou partou.
• Nikomu se nic nestane. Duchové jsou přátelští, podezření už méně.

Vezmi si něco tmavého. Nikomu nevěř.`,
  4003067621: `Vytvořte si vůni, která bude jen vaše.

Objevte výběr kvalitních parfumérských surovin z francouzského Grasse, vyzkoušejte neobvyklé vonné kombinace a pod vedením odborníka na parfumerii si namíchejte vlastní osobitý parfém.

Vaše vůně. Vaše tvořivost. Váš podpis.`,
  3168125460: `Vlkodlaci jsou společenská hra pro 10 až 16 lidí. Několik hráčů tajně dostane roli vlkodlaka. Ostatní jsou vesničané a snaží se vlkodlaky odhalit. V noci si vlkodlaci vyberou oběť. Ve dne se u stolu probírá, kdo asi lže, a hlasováním se jeden hráč vyřadí. Vesničané vyhrají, pokud odhalí všechny vlkodlaky. Vlkodlakům stačí vydržet, dokud jich nezbude stejně jako vesničanů.

Pravidla znát nemusíš. Na začátku je vysvětlí moderátor a pak tě provede celou hrou. Přijď sólo nebo vezmi přátele.

Hrajeme v pražském baru, u stolu je místo pro 16 hráčů.`,
  1614515640: `Blood on the Clocktower je dedukční hra pro 5 až 15 lidí. Připomíná Mafii nebo Vlkodlaky, ale každá postava má vlastní schopnost. Většina hráčů stojí na straně města. Proti nim hraje Démon, který v noci zabíjí, a jeho přisluhovači, kteří mu pomáhají zůstat v utajení.

Jak se hraje

1. Tajně si vylosuješ žeton postavy. Dobří hledají Démona, zlí se vydávají za dobré.
2. V noci všichni zavřou oči. Vypravěč postupně probouzí jednotlivé hráče: někdo získá informaci, někdo použije svou schopnost a Démon si vybere oběť.
3. Ve dne se diskutuje. Porovnávejte informace a klidně si někoho vezměte stranou. Lhát může každý. Některé dobré postavy jsou navíc opilé nebo otrávené, aniž by to věděly, takže i ony mohou mít mylné informace.
4. Následují nominace a hlasování. K popravě je potřeba alespoň polovina hlasů žijících hráčů a nikdo jiný nesmí získat více hlasů.
5. Pokud Démon zemře, vyhrává dobro. Pokud zůstanou naživu jen dva hráči, vítězí zlo.

Ani po smrti od stolu neodcházíš. Můžeš dál diskutovat a zbývá ti jeden poslední hlas, který často rozhodne celou hru.

Hrajeme začátečnickou edici Trouble Brewing. Vypravěč vše vysvětlí a celou hru povede. Přijď sólo nebo s přáteli.`,
  9288102: `Šest podivných případů a jediný vrah. Ptej se, zvedni telefon a poskládej důkazy na nástěnku dřív, než večer skončí. Představ si Twin Peaks, kde jste detektivy vy.

Moderátor v obleku s naprosto vážnou tváří vypráví podivnou příhodu z ulic. Ptát se můžete na cokoli, ale odpověď zní vždy „ano“, „ne“ nebo „na tom nezáleží“. Společně přijděte na to, co se opravdu stalo.

Šest případů postupně přituhuje. Po každém přibude na nástěnce stopa: výstřižek z novin, fotka, načmáraná poznámka nebo telefonní číslo. Na číslo můžete opravdu zavolat a na druhém konci se ozve postava z příběhu. Nevíte si rady? Kupte si za herní peníze nápovědu, vyměňte si informace s jiným týmem nebo zkuste podplatit moderátora.

Ve finále propojte důkazy červenou nití a označte vraha. Každý tým má jediný pokus.

• Pravidla zaberou dvě minuty, případy celý večer.
• Hraje 8 až 20 lidí v týmech po 4 až 5, hru vede moderátor s asistentem.
• Zkušenosti nepotřebuješ. Přijď sólo, ve dvou nebo s partou.
• Před ostatními nemusíš nic předvádět. Jste tu jen vy, váš tým a jedna velmi podezřelá nástěnka.
• Na přání uspořádáme soukromou hru pro dvě a více osob.

Bystrou hlavu s sebou!`,
  1549579670: `Naše vlajková hra. Sami jsme ji vymysleli, hráli ji už mnohokrát a naši stálí hosté se pokaždé ptají, kdy bude další.

Každé kolo je jiná hra. Kdo vyhraje, určí pravidlo pro ostatní.

Barfight vypadá jako kvíz, ale dlouho jím nezůstane. V jednom kole tě čeká talentová soutěž. V dalším se na pódiu objeví obří akvárium a váš stůl hádá, které předměty se potopí a které poplavou. Nikdy nevíš, co přijde dál.

Vítězové kola vymyslí pro příští kolo pravidlo i trest. Třeba když jeden z nich zatleská, musí zatleskat všechny stoly. Poslední tým čeká trest. Během večera týmy plní i tajné úkoly za bonusové body, takže kromě otázek musíš sledovat také soupeře.

• Týmy po 4 až 5 lidech hrají společně od prvního kola do posledního.
• Čeká vás moderátor, ozvučení, počítání bodů a trofej pro vítěze.
• Dvě až tři hodiny překvapení.

Vyhraj kolo a urči pravidlo!`,
};

export function eventDescription(source: string | null, language: string): string {
  if (!source || language !== "cs") return source || "";
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  }
  return translations[hash >>> 0] ?? source;
}
