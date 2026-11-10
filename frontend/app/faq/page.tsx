import {permanentRedirect} from "next/navigation";

/** The former default FAQ URL served Russian. Preserve bookmarks with a
 * permanent redirect to the current English FAQ, not stale Russian content.
 */
export default function LegacyFaqRoute(){permanentRedirect("/en/faq");}
