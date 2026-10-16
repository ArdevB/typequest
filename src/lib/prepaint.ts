import { THEME_LIST } from "@/themes/registry";

/** Runs before first paint so the saved theme never flashes. */
const TEMPLATE = `(function(){try{var d=document.documentElement;var s=(JSON.parse(localStorage.getItem("tq-settings")||"{}").state)||{};var ids=__IDS__;if(ids.indexOf(s.themeId)>-1)d.dataset.theme=s.themeId;d.dataset.cb=s.colorblind?"true":"false";var m=s.motion||"system";d.dataset.rm=(m==="reduce"||(m==="system"&&matchMedia("(prefers-reduced-motion: reduce)").matches))?"true":"false";}catch(e){}})();`;

export const PREPAINT_SCRIPT = TEMPLATE.replace("__IDS__", JSON.stringify(THEME_LIST.map((t) => t.config.id)));
