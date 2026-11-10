import {redirect} from "next/navigation";

/** The legacy homepage banner editor was retired with the new landing layout.
 * Keep old bookmarks working without exposing an unused settings screen.
 */
export default function FormerSiteContentPage(){
  redirect("/admin");
}
