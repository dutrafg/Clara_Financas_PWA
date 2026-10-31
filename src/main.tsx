import * as React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App/>);

if('serviceWorker' in navigator && location.protocol!=='file:' && import.meta.env.PROD){
 let reloading=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(reloading)return;
  reloading=true;window.location.reload();
 });
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  const notify=()=>{if(reg.waiting&&navigator.serviceWorker.controller)
   window.dispatchEvent(new CustomEvent('clara-update-ready'))};
  notify();
  reg.addEventListener('updatefound',()=>{
   const installing=reg.installing;
   installing?.addEventListener('statechange',()=>{if(installing.state==='installed')notify()});
  });
  document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='visible'&&navigator.onLine)reg.update().catch(()=>{});
  });
 }).catch(e=>console.warn('PWA: instalação do Service Worker indisponível',e));
}
