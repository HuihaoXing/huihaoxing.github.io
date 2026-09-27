// Case pages: whichever beat sits across the reading line sets the scene. The rail shows where you are and jumps.
import {CASES,state,show,setLight,setAdjust,bandAdjust,mobile,debug} from './engine.js?v=20260927j';

export function mountCase(k){
  const story=document.querySelector('.story'),inner=mobile&&getComputedStyle(story).overflowY==='auto',beats=[...document.querySelectorAll('.beat')],rail=document.querySelector('.rail .segs'),label=document.querySelector('.rail small');
  beats.forEach((b,i)=>{const btn=document.createElement('button');btn.type='button';btn.setAttribute('aria-label',b.dataset.name||('Part '+(i+1)));
    btn.onclick=()=>b.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:inner?'start':'center'});rail.appendChild(btn)});
  const segs=[...rail.children];
  // on phones the scene has only the top half, between the header and the article
  if(inner)setAdjust(bandAdjust(()=>[document.querySelector('header .mark').getBoundingClientRect().bottom+14,story.getBoundingClientRect().top-14]));
  let cur=-1;
  function pick(){const line=inner?story.getBoundingClientRect().top+story.clientHeight*.35:innerHeight*.5;let best=0,bd=Infinity;
    beats.forEach((b,i)=>{const r=b.getBoundingClientRect(),d=r.top<=line&&r.bottom>=line?0:Math.min(Math.abs(r.top-line),Math.abs(r.bottom-line));if(d<bd){bd=d;best=i}});
    if(best===cur)return;const first=cur<0;cur=best;
    beats.forEach((b,i)=>b.classList.toggle('on',i===best));segs.forEach((s,i)=>{s.classList.toggle('done',i<best);s.classList.toggle('now',i===best)});
    if(label)label.textContent=beats[best].dataset.name||'';
    const s=+beats[best].dataset.step;if(first||s!==state.step||state.ck!==k)show(k,s,first)}
  addEventListener('scroll',pick,{passive:true});story.addEventListener('scroll',pick,{passive:true});addEventListener('resize',pick);pick();

  const modeBtns=[...document.querySelectorAll('.mode button[data-mode]')];
  function theme(l){setLight(l);document.documentElement.dataset.theme=l?'light':'dark';modeBtns.forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.mode==='light')===l)));try{localStorage.setItem('theme',l?'light':'dark')}catch(e){}}
  document.querySelector('header .mode').onclick=()=>theme(document.documentElement.dataset.theme!=='light');
  if(document.documentElement.dataset.theme==='light')theme(true);

  addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,button,a'))return;
    const go=d=>{const t=beats[Math.max(0,Math.min(beats.length-1,cur+d))];if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:inner?'start':'center'})}};
    if(e.key==='j')go(1);else if(e.key==='k')go(-1)});
  window.__story={cases:CASES,camera:debug.camera,ff:debug.ff,state:()=>({...state,beat:cur}),beat:i=>{beats[i].scrollIntoView({block:inner?'start':'center'});pick()}};
}
