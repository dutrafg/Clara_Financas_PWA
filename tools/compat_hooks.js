/* Adaptador de hooks apenas para prévia, pois o runtime offline disponível neste ambiente é React 16.0.0.
   O projeto Vite utiliza React 19 nativamente após npm install. */
(function(){
 const R=window.React, cache=new WeakMap(), nativeCreate=R.createElement;
 let current=null;
 function same(a,b){return !!a&&!!b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));}
 function wrap(fn){if(cache.has(fn))return cache.get(fn);
  class HookComponent extends R.Component{
   constructor(props){super(props);this._hooks=[];this._cursor=0;this._effects=[];}
   render(){let prev=current;current=this;this._cursor=0;this._effects=[];
    try{return fn(this.props);} finally{current=prev;}}
   componentDidMount(){this._runEffects()}
   componentDidUpdate(){this._runEffects()}
   componentWillUnmount(){for(const entry of this._hooks)if(entry&&entry.kind==='effect'&&typeof entry.cleanup==='function')entry.cleanup();}
   _runEffects(){for(const [i,cb,deps] of this._effects){let h=this._hooks[i];if(h&&typeof h.cleanup==='function')h.cleanup();let cleanup=cb();this._hooks[i]={kind:'effect',deps,cleanup}}}
  }
  cache.set(fn,HookComponent);return HookComponent;
 }
 R.Fragment=({children})=>children||null;
 R.createElement=function(component,props,...children){let normalized=props;if(props&&props.ref&&typeof props.ref==='object'){normalized=Object.assign({},props,{ref:node=>{props.ref.current=node}});}return nativeCreate.call(R,typeof component==='function'&&component!==R.Fragment?wrap(component):component,normalized,...children)};
 R.useState=function(init){const instance=current,i=instance._cursor++;
  if(!instance._hooks[i])instance._hooks[i]={kind:'state',value:typeof init==='function'?init():init};
  const set=(next)=>{const h=instance._hooks[i];const value=typeof next==='function'?next(h.value):next;if(!Object.is(value,h.value)){h.value=value;instance.forceUpdate()}};
  return [instance._hooks[i].value,set];};
 R.useRef=function(init){const instance=current,i=instance._cursor++;if(!instance._hooks[i])instance._hooks[i]={current:init};return instance._hooks[i]};
 R.useMemo=function(fn,deps){const inst=current,i=inst._cursor++;let prev=inst._hooks[i];if(!prev||!same(prev.deps,deps)){prev={value:fn(),deps};inst._hooks[i]=prev}return prev.value;};
 R.useEffect=function(fn,deps){const inst=current,i=inst._cursor++;let prev=inst._hooks[i];if(!prev||!same(prev.deps,deps))inst._effects.push([i,fn,deps]);};
})();

