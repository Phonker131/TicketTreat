import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { LegalOperatorIdentity } from "@/components/LegalOperatorIdentity";
import { CookieSettingsControl } from "@/components/CookieSettingsControl";

export const metadata: Metadata = {
  title:"Cookie Policy",
  description:"TicketTreat's essential cookies, device storage, optional Google Maps consent and preference management.",
};

export default function CookiePolicyPage(){
  return <div className="app-shell"><AppHeader/><main className="page tt-legal-page">
    <Link href="/" className="back-link">← TicketTreat</Link>
    <p className="eyebrow">TICKETTREAT / PRIVACY</p>
    <h1 className="tt-legal-title">Cookie Policy / Zásady cookies</h1>
    <p className="tt-legal-updated">Effective: 23 October 2026 · Consent version 2026-10-23/maps-v1</p>
    <CookieSettingsControl/>
    <article className="tt-legal-content">
      <LegalOperatorIdentity/>
      <section>
        <h2>1. What we use</h2>
        <p>Cookies are small pieces of data stored by your browser. TicketTreat also uses browser localStorage and sessionStorage. We use strictly necessary technologies for account access and security without asking for optional tracking consent. Under Czech Electronic Communications Act No. 127/2005 Coll., Section 89(3), the exception applies only to storage/access necessary for transmitting communications or providing services you expressly request.</p>
      </section>
      <section>
        <h2>2. Essential cookies and local storage — always active</h2>
        <div className="tt-legal-table-scroll"><table className="tt-legal-data-table">
          <thead><tr><th>Name / category</th><th>Purpose</th><th>Storage and lifetime</th></tr></thead>
          <tbody>
            <tr><td><code>tt_web_session</code></td><td>Secure HttpOnly website login session; sent only to TicketTreat's same-origin API gateway.</td><td>First-party cookie, at most 7 days; deleted on logout.</td></tr>
            <tr><td><code>tt_google_flow</code></td><td>Short-lived state to link a voluntary Google sign-in callback with the original browser.</td><td>First-party HttpOnly cookie, at most 10 minutes; cleared after callback.</td></tr>
            <tr><td><code>tickettreat_interface_language</code></td><td>Remember your chosen language.</td><td>Browser localStorage, until you clear site data.</td></tr>
            <tr><td><code>tickettreat_web_auth</code></td><td>Non-secret indicator that a website session may be available; no bearer token is stored in it.</td><td>Browser localStorage, removed on logout.</td></tr>
            <tr><td>PWA/service-worker cache</td><td>Load application assets efficiently, including offline-enabled parts of the app.</td><td>Browser cache, subject to the service worker and browser controls.</td></tr>
            <tr><td><code>tt_cookie_choice_v1</code></td><td>Store optional Google Maps permission, the policy version, choice timestamp and expiry.</td><td>Browser localStorage, up to 180 days; renewed when you change your choice.</td></tr>
          </tbody>
        </table></div>
        <p>Telegram Mini App software is included to support users who open TicketTreat through Telegram; using Telegram can also involve the provider processing technical data under its own policies. Sign-in with Google is initiated only when you select it. Third-party authentication and transport systems are not optional advertising trackers.</p>
      </section>
      <section>
        <h2>3. Optional embedded Google Maps</h2>
        <p>We do not load embedded Google Maps on an event page until you give permission in our settings. If you accept, opening an embedded map can transmit your IP address and technical browser information to Google and can permit Google to set or read its own cookies. The exact Google cookies and retention depend on Google's services and settings; TicketTreat does not control them. Instead, you can follow the external map link, which opens Google's website outside TicketTreat.</p>
        <p>For details, refer to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>. You may refuse the optional map without losing access to tickets, events, registration or support.</p>
      </section>
      <section>
        <h2>4. Analytics and advertising</h2>
        <p>We do not currently use Google Analytics, Meta Pixel or other advertising and analytics cookies on TicketTreat. Granting map permission does not permit unrelated marketing or analytics. If such tools are introduced later, we must disclose specific providers, purposes, retention and separate consent controls before any optional tags load. Consent for this version cannot be repurposed for new trackers.</p>
      </section>
      <section>
        <h2>5. Consent, withdrawal and retention</h2>
        <p>On your first visit, both accepting and rejecting optional embedded maps are available with equal prominence. Leaving the website or scrolling is not consent. The choice is stored on this device for up to 180 days and expires when we materially change this consent policy. Use the Cookie settings link in the footer or the control above at any time to change your decision. Withdrawal prevents further embedded maps from loading and removes a map iframe already open; it cannot erase information already collected by Google while you had allowed maps.</p>
        <p>Browser storage can be blocked or cleared in your browser settings. If you clear it, the consent choice will be requested again. This notice describes this release, not other unrelated websites.</p>
      </section>
      <section lang="cs" id="ceska-verze" className="tt-legal-czech">
        <h2>Zásady cookies — česká verze</h2>
        <p><strong>Právní základ:</strong> v souladu s § 89 odst. 3 zákona č. 127/2005 Sb. používáme nezbytné cookies bez předchozího souhlasu, pokud slouží výhradně k přenosu zpráv nebo k fungování služby výslovně požadované uživatelem. Na ostatní ukládání/čtení dat v zařízení je třeba předchozí informovaný souhlas. Pro následné zpracování osobních údajů platí GDPR a informace v <Link href="/privacy-policy">zásadách ochrany osobních údajů</Link>.</p>
        <p><strong>Nezbytné cookies:</strong> <code>tt_web_session</code> zabezpečuje přihlášení (max. 7 dní; při odhlášení se smaže), <code>tt_google_flow</code> umožňuje bezpečně dokončit vámi zvolené přihlášení přes Google (max. 10 minut). Jde o HttpOnly cookies, takže nejsou přístupné JavaScriptu na stránce.</p>
        <p><strong>Místní úložiště:</strong> <code>tickettreat_interface_language</code> uchovává nastavený jazyk, <code>tickettreat_web_auth</code> jen netajný indikátor přihlášení (nikoliv přístupový token), <code>tt_cookie_choice_v1</code> volbu a čas souhlasu, který platí nejdéle 180 dní. Aplikace PWA může používat cache pro své soubory; můžete ji vymazat v prohlížeči.</p>
        <p><strong>Volitelné Mapy Google:</strong> vložená mapa se načítá teprve po souhlasu. Při jejím načtení může Google získat vaši IP adresu a technické údaje a využít vlastní cookies podle <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">zásad společnosti Google</a>. Souhlas není povinný pro použití TicketTreat; místo mapy lze použít odkaz, který Google otevře mimo TicketTreat.</p>
        <p><strong>Analytika a reklama:</strong> nyní nepoužíváme Google Analytics, reklamní pixely ani marketingové cookies. Souhlas s mapou nelze použít k jejich případnému budoucímu zapnutí bez nového odpovídajícího souhlasu.</p>
        <p><strong>Vaše volba:</strong> nepovinné mapy můžete stejně snadno povolit i odmítnout. Rozhodnutí lze kdykoli změnit kliknutím na „Nastavení cookies“ v zápatí nebo tlačítkem nahoře. Odvolání zastaví další načítání map a odebere již vloženou mapu, ale neodstraní údaje dříve získané společností Google. Nepřijetí souhlasu neomezuje rezervace ani vydání vstupenek. Pokud smažete data webu v prohlížeči, budeme se ptát znovu.</p>
        <p><strong>Provozovatel:</strong> příslušný správce osobních údajů a kontaktní údaje jsou uvedeny v identifikačním bloku výše a v <Link href="/legal-notice">informacích o provozovateli</Link>. Dokud nejsou vyplněny, právní informace o provozovateli nejsou dokončené.</p>
      </section>
    </article>
  </main></div>;
}
