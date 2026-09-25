// Shared: copy email, copy link, share menu. The email address is assembled on demand, never printed in the page.
(function(){
  var toast=document.querySelector('.toast');
  function say(t){if(!toast)return;toast.textContent=t;toast.classList.add('show');clearTimeout(say.t);say.t=setTimeout(function(){toast.classList.remove('show')},2200)}
  function copy(text,ok){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){say(ok)},function(){say(text)});else say(text)}
  var email=function(){return ['jackxing175','gmail.com'].join('@')};
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-email]');if(b){copy(email(),'Email copied');return}
    b=e.target.closest('[data-copy-link]');if(b){var u=new URL(b.getAttribute('data-copy-link')||location.href,location.href);copy(u.href,'Link copied');closeMenus();return}
    b=e.target.closest('[data-share]');
    if(b){var url=location.href.split('#')[0],title=document.title;
      if(navigator.share&&matchMedia('(pointer:coarse)').matches){navigator.share({title:title,url:url}).catch(function(){});return}
      var m=b.parentElement.querySelector('.share-menu');var open=!m.classList.contains('open');closeMenus();if(open)m.classList.add('open');return}
    if(!e.target.closest('.share-menu'))closeMenus();
  });
  function closeMenus(){document.querySelectorAll('.share-menu.open').forEach(function(m){m.classList.remove('open')})}
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus()});
  // fill share menus: copy link, LinkedIn, email to a colleague
  document.querySelectorAll('.share-menu').forEach(function(m){if(m.children.length)return;
    var url=encodeURIComponent(location.href.split('#')[0]),title=encodeURIComponent(document.title);
    m.innerHTML='<button type="button" data-copy-link>Copy link</button>'+
      '<a href="https://www.linkedin.com/sharing/share-offsite/?url='+url+'" target="_blank" rel="noopener">Share on LinkedIn</a>'+
      '<a href="mailto:?subject='+title+'&body='+url+'">Email to a colleague</a>';
  });
})();
