/* Storage simulator exclusively for the single-file Android preview.
 * In-memory persistence intentionally ends when the preview page is closed.
 * The Vite PWA uses actual IndexedDB and the user's chosen folder. */
(function(){
 const tables=new Map();
 const db={
  createObjectStore(name){tables.set(name,new Map());},
  transaction(name){const table=tables.get(name);const tx={error:null,abort(){queueMicrotask(()=>this.onabort?.())},objectStore(){return {
   get(key){return req(()=>table.get(key))},
   put(value,key){return req(()=>{table.set(key,key==='folder'?value:structuredClone(value));return key})},
   delete(key){return req(()=>table.delete(key))}
  }}};
  function req(run){const r={};queueMicrotask(()=>{try{r.result=run();r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())}catch(e){tx.error=e;tx.onerror?.()}});return r;}
  return tx;}
 };
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const r={result:db};queueMicrotask(()=>{if(!tables.size)r.onupgradeneeded?.();r.onsuccess?.()});return r;}}});
})();
