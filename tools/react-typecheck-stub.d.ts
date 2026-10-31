/* Declaration stub used ONLY for offline validation when npm registry unavailable.
   Production uses official @types/react and @types/react-dom. */
declare namespace React {type ReactNode=any; type ChangeEvent<T>=any;type FormEvent<T>=any;type ReactElement=any;}
declare module 'react' {
 export = React;
 namespace React {function createElement(...args:any[]):any;function useState<T>(value:T|(()=>T)):[T,(next:T|((prev:T)=>T))=>void];function useEffect(effect:()=>void|(()=>void),deps?:any[]):void;function useMemo<T>(cb:()=>T,deps:any[]):T;function useRef<T>(value:T):{current:T};type ReactNode=any;}
}
declare module 'react-dom/client' {export function createRoot(node:Element):{render(el:any):void};}
declare module 'vite' {export function defineConfig(value:any):any;}
declare module '@vitejs/plugin-react' {export default function react():any;}
declare namespace JSX {interface Element {} interface IntrinsicElements {[elemName:string]:any;} interface ElementChildrenAttribute {children:any;} interface IntrinsicAttributes {key?:string|number;}}

interface ImportMeta { readonly env:{PROD:boolean}; }

declare module 'vite/client' {}
