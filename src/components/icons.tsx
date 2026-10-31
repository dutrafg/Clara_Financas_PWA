import * as React from 'react';
const paths:Record<string,React.ReactNode>={
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
 transactions:<><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/></>,
 accounts:<><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18m-5 5h2"/></>,
 planning:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
 reports:<><path d="M4 20V4m0 16h17M8 16l4-5 3 3 5-8"/></>,
 settings:<><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.4 1.4m9.92 9.92 1.4 1.4M18.36 5.64l-1.4 1.4M7.04 16.96l-1.4 1.4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/></>,
 plus:<path d="M12 5v14M5 12h14"/>, eye:<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
 hide:<><path d="M3 3l18 18"/><path d="M10 6.2A10.3 10.3 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.4 3.8M6.2 8.4C3.4 10 2 12 2 12s3.5 6 10 6c1.1 0 2.1-.2 3-.5"/></>,
 folder:<><path d="M3 6h7l2 2h9v11H3z"/></>, upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/></>,download:<><path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/></>,
 edit:<><path d="M4 20l4.5-1 11-11-3.5-3.5-11 11zM14.5 6l3.5 3.5"/></>,trash:<><path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,arrowup:<><path d="M12 19V5m-6 6 6-6 6 6"/></>,arrowdown:<><path d="M12 5v14m-6-6 6 6 6-6"/></>,wallet:<><rect x="2" y="6" width="20" height="15" rx="3"/><path d="M2 10h20m-4 5h2"/></>,
 close:<path d="M5 5l14 14M19 5 5 19"/>,menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,check:<path d="M5 12l5 5L20 7"/>,info:<><circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/></>,
 theme:<><path d="M20.8 15A9 9 0 0 1 9 3.2 9 9 0 1 0 20.8 15Z"/></>,print:<><rect x="6" y="3" width="12" height="5"/><path d="M6 18H4V9h16v9h-2m-12-5h12v8H6z"/></>,
 chevron:<path d="m9 18 6-6-6-6"/>,target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></>
};
export function Icon({name,size=19,className=''}:{name:string;size?:number;className?:string}){return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.info}</svg>;}
