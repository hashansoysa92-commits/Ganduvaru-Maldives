(() => {
  const CFG = window.GANDUVARU_CONFIG || {};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { data:null, products:[], filter:"All", search:"", sort:"featured", promotionCategory:"", cart:JSON.parse(localStorage.getItem("ganduvaru_cart")||"[]"), user:JSON.parse(localStorage.getItem("ganduvaru_user")||"null"), pendingOtp:null };

  const money = v => v == null ? "Ask for price" : "MVR " + Number(v).toLocaleString();
  const digits = v => (v||"").replace(/\D/g,"");
  const initials = s => (s||"G").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const categoryIcon = c => ({
    "Phones":"▯","Tablets":"▭","Audio":"◉","Accessories":"✦","Smart Watches":"◌",
    "Networking":"⌁","Home Appliances":"◇","Personal Care Electronics":"✧",
    "Skincare":"◫","Beauty":"✤"
  }[c]||"G");
  function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200); }
  async function publicRpc(name,payload){
    const sb=CFG.supabase||{};
    if(!sb.url||!sb.key)throw new Error("Ordering service is unavailable");
    const r=await fetch(sb.url+"/rest/v1/rpc/"+name,{
      method:"POST",
      headers:{apikey:sb.key,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const body=await r.json().catch(()=>null);
    if(!r.ok)throw new Error(body?.message||body?.error_description||"Order request failed");
    return body;
  }
  function saveCart(){ localStorage.setItem("ganduvaru_cart",JSON.stringify(state.cart)); renderCart(); }
  let layerScrollY=0;
  const historyLayers=new Set(["cartDrawer","productModal"]);

  function syncLayerLock(){
    const open=!!document.querySelector(".drawer.open,.modal.open");
    if(open && !document.body.classList.contains("ui-layer-open")){
      layerScrollY=Math.max(0,window.scrollY||0);
      document.body.classList.add("ui-layer-open");
      document.body.style.top="-"+layerScrollY+"px";
    }else if(!open && document.body.classList.contains("ui-layer-open")){
      document.body.classList.remove("ui-layer-open");
      document.body.style.top="";
      requestAnimationFrame(()=>window.scrollTo({top:layerScrollY,left:0,behavior:"auto"}));
    }
  }

  function syncBackdrop(){
    const backdrop=$("#backdrop");
    if(backdrop)backdrop.hidden=!document.querySelectorAll(".drawer.open").length;
  }

  function setLayerVisible(id,visible){
    const el=$("#"+id); if(!el)return false;
    el.classList.toggle("open",visible);
    el.setAttribute("aria-hidden",visible?"false":"true");
    syncBackdrop();
    return true;
  }

  function writeLayerHistory(id,mode="push",extra={}){
    if(!historyLayers.has(id) || mode==="none")return;
    const next={...(history.state||{}),ganduvaruLayer:id,...extra};
    if(id!=="productModal")delete next.ganduvaruProductId;
    try{
      if(mode==="replace")history.replaceState(next,"",location.href);
      else if(history.state?.ganduvaruLayer!==id || (id==="productModal" && history.state?.ganduvaruProductId!==extra.ganduvaruProductId)){
        history.pushState(next,"",location.href);
      }
    }catch(e){}
  }

  function clearLayerHistory(id,mode="replace"){
    if(!historyLayers.has(id) || history.state?.ganduvaruLayer!==id)return;
    const next={...(history.state||{})};
    delete next.ganduvaruLayer;
    delete next.ganduvaruProductId;
    delete next.ganduvaruCartOpen;
    try{
      if(mode==="back")history.back();
      else history.replaceState(next,"",location.href);
    }catch(e){}
  }

  function openLayer(id,options={}){
    const el=$("#"+id); if(!el)return;
    const historyMode=options.historyMode||"push";
    setLayerVisible(id,true);
    writeLayerHistory(id,historyMode,options.stateData||{});
    syncLayerLock();
    requestAnimationFrame(()=>el.querySelector("button,[href],input,textarea,select")?.focus({preventScroll:true}));
  }

  function closeLayer(id,options={}){
    const el=$("#"+id); if(!el)return;
    const fromHistory=options===true || options.fromHistory===true;
    const historyMode=typeof options==="object"&&options.historyMode?options.historyMode:"back";
    setLayerVisible(id,false);
    syncLayerLock();
    if(!fromHistory)clearLayerHistory(id,historyMode);
  }
  const esc = v => String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  function productImages(p){
    const all=[...(Array.isArray(p?.images)?p.images:[]),p?.image].map(x=>String(x||"").trim()).filter(Boolean);
    return [...new Set(all)];
  }
  function productMedia(p,cls=""){
    const imgs=productImages(p);
    if(!imgs.length) return '<div class="product-fallback '+cls+'"><span class="fallback-icon">'+categoryIcon(p.category)+'</span><small>'+esc(p.category||"Product")+'</small></div>';
    return '<img class="'+cls+'" src="'+esc(imgs[0])+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">';
  }

  function initLuxuryIntro(){
    const intro=$("#luxuryIntro");
    const unlock=()=>{
      document.body.classList.remove("intro-pending");
      document.documentElement.classList.remove("intro-pending");
    };
    if(!intro){unlock();return}
    const editorMode=new URLSearchParams(location.search).get("editor")==="1";
    if(!editorMode){
      try{history.scrollRestoration="manual"}catch(e){}
      window.scrollTo({top:0,left:0,behavior:"auto"});
    }
    if(editorMode){
      intro.remove();
      unlock();
      return;
    }

    // Keep the document itself in native scrolling mode. Block gestures only on the
    // temporary intro overlay so Safari/iOS/trackpads never inherit a stuck body lock.
    const blockIntroGesture=e=>e.preventDefault();
    intro.addEventListener("wheel",blockIntroGesture,{passive:false});
    intro.addEventListener("touchmove",blockIntroGesture,{passive:false});

    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitDelay=reduced?180:2850;
    const removeDelay=reduced?360:3700;
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;
      cleaned=true;
      unlock();
      intro.classList.add("intro-exit");
      intro.removeEventListener("wheel",blockIntroGesture);
      intro.removeEventListener("touchmove",blockIntroGesture);
    };

    window.setTimeout(cleanup,exitDelay);
    window.setTimeout(()=>{cleanup();intro.remove()},removeDelay);

    // Defensive unlocks for tab restore / bfcache / throttled timers.
    window.addEventListener("pageshow",unlock,{once:true});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden&&performance.now()>exitDelay)cleanup()},{once:true});
  }

  function contactIcon(type){
    const icons={
      phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 2.8 9.3 7c.4.6.3 1.3-.2 1.8l-1.6 1.5c1.1 2.3 3 4.2 5.3 5.3l1.5-1.6c.5-.5 1.2-.6 1.8-.2l4.2 2.7c.6.4.8 1.1.6 1.8-.5 1.6-2 2.7-3.7 2.7C9.4 21 3 14.6 3 6.8c0-1.7 1.1-3.2 2.7-3.7.7-.2 1.4.1 1.8.7Z" fill="none"/></svg>',
      whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.49A11.86 11.86 0 0 0 12.07 0C5.49 0 .14 5.35.14 11.93c0 2.1.55 4.15 1.59 5.95L.04 24l6.26-1.64a11.9 11.9 0 0 0 5.77 1.47h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.49-8.41ZM12.08 21.8h-.01a9.85 9.85 0 0 1-5.02-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.86 9.86 0 0 1-1.51-5.27c0-5.44 4.43-9.87 9.88-9.87a9.8 9.8 0 0 1 6.98 2.9 9.8 9.8 0 0 1 2.89 6.98c-.01 5.44-4.44 9.86-9.9 9.86Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.19 5.06 4.47.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" stroke="none"/></svg>',
      facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.54-4.7 1.32 0 2.7.24 2.7.24v2.98h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.34l-.53 3.49h-2.81V24C19.61 23.1 24 18.1 24 12.07Z" stroke="none"/></svg>',
      instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm9.45 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" stroke="none"/></svg>',
      tiktok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.4 2h3.1c.22 1.65 1.17 3.05 2.5 3.92A6.55 6.55 0 0 0 23 7.06v3.14a9.55 9.55 0 0 1-5.49-1.77v7.62A6.95 6.95 0 1 1 11.52 9.2v3.2a3.81 3.81 0 1 0 2.88 3.69V2Z" stroke="none"/></svg>'
    };
    return icons[type]||"";
  }

  async function load(){
    try{
      let loaded=null;
      if(CFG.supabase?.url && CFG.supabase?.key){
        try{
          const endpoint=CFG.supabase.url+"/rest/v1/"+(CFG.supabase.catalogTable||"ganduvaru_catalog")+"?id=eq.1&select=data";
          const r=await fetch(endpoint,{cache:"no-store",headers:{apikey:CFG.supabase.key}});
          if(r.ok){
            const rows=await r.json();
            loaded=rows?.[0]?.data||null;
          }
        }catch(err){ console.warn("Live catalog fallback",err); }
      }
      if(!loaded){
        const res=await fetch(CFG.catalogPath || "data/catalog.json",{cache:"no-store"});
        if(!res.ok) throw new Error("Catalog unavailable");
        loaded=await res.json();
      }
      state.data=loaded; state.products=[...state.data.products];
      hydrateSite(); bind(); renderProducts(); renderCart(); updateAccount();
    }catch(e){
      console.error(e); $("#productGrid").innerHTML='<div class="empty-state"><strong>Catalog unavailable.</strong><span>Please refresh this page.</span></div>';
    }
  }

  function hydrateSite(){
    const d=state.data, site=d.site||{};
    $("#announcement").textContent=site.announcement||"";
    $("#heroTitle").textContent=site.heroTitle||"Ganduvaru Maldives";
    $("#heroSubtitle").textContent=site.heroSubtitle||"";
    $("#aboutTitle").textContent=site.aboutTitle||"";
    $("#aboutText").textContent=site.aboutText||"";
    $("#year").textContent=new Date().getFullYear();

    const nav=(d.tabs||[]).map(t=>'<a href="'+esc(t.href||"#")+'">'+esc(t.label||"Link")+'</a>').join("");
    $("#desktopNav").innerHTML=nav; $("#mobileNav").innerHTML=nav;

    renderPromotions();

    const contacts=[
      site.contactPhone ? {type:"phone",label:"Call "+site.contactPhone,href:"tel:"+digits(site.contactPhone)} : null,
      site.contactWhatsApp ? {type:"whatsapp",label:"WhatsApp "+site.contactWhatsApp,href:"https://wa.me/"+digits(site.contactWhatsApp),external:true} : null,
      site.contactFacebook ? {type:"facebook",label:"Facebook",href:site.contactFacebook,external:true} : null,
      site.contactInstagram ? {type:"instagram",label:"Instagram",href:site.contactInstagram,external:true} : null,
      site.contactTikTok ? {type:"tiktok",label:"TikTok",href:site.contactTikTok,external:true} : null
    ].filter(Boolean);

    $("#contactGrid").innerHTML=contacts.length?contacts.map(x=>`
      <a class="contact-icon-link contact-icon-${esc(x.type)}" href="${esc(x.href)}" aria-label="${esc(x.label)}" title="${esc(x.label)}"${x.external?' target="_blank" rel="noopener"':""}>
        ${contactIcon(x.type)}
        <span class="sr-only">${esc(x.label)}</span>
      </a>`).join(""):'<div class="empty-state"><strong>Contact details coming soon.</strong></div>';

    [["#footerWhatsApp",site.contactWhatsApp?"https://wa.me/"+digits(site.contactWhatsApp):""],["#footerFacebook",site.contactFacebook],["#footerInstagram",site.contactInstagram],["#footerTikTok",site.contactTikTok]].forEach(([selector,url])=>{
      const el=$(selector); if(!el)return; el.hidden=!url; if(url)el.href=url;
    });

    const cats = ["All", ...new Set(d.products.map(p=>p.category).filter(Boolean))];
    $("#filters").innerHTML=cats.map(cat=>'<button class="filter-chip'+(cat===state.filter?" active":"")+'" type="button" data-filter="'+esc(cat)+'" aria-pressed="'+(cat===state.filter?"true":"false")+'">'+esc(cat)+'</button>').join("");
    requestAnimationFrame(()=>{applyPageOverrides();refreshLuxuryMotion();});
  }

  function filtered(){
    let list=[...state.products];
    if(state.filter!=="All") list=list.filter(p=>p.category===state.filter);
    const q=state.search.trim().toLowerCase();
    if(q) list=list.filter(p=>[p.name,p.category,p.subcategory,p.description].join(" ").toLowerCase().includes(q));
    if(state.sort==="price-asc") list.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
    if(state.sort==="price-desc") list.sort((a,b)=>(b.price??-1)-(a.price??-1));
    if(state.sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
    if(state.sort==="featured") list.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
    return list;
  }

  function renderProducts(){
    const list=filtered(); $("#emptyState").hidden=!!list.length;
    $("#productGrid").innerHTML=list.map(p=>{
      const imgs=productImages(p);
      const media=productMedia(p);
      const photoCount=imgs.length>1?'<span class="photo-count">'+imgs.length+' photos</span>':"";
      const out=p.availability==="out_of_stock";
      const categoryLabel=[p.category,p.subcategory].filter(Boolean).join(" / ")||"Ganduvaru";
      return `<article class="product-card commerce-card${out?" product-out-of-stock":""}" data-product="${esc(p.id)}" data-open-product="${esc(p.id)}" tabindex="0" aria-label="View ${esc(p.name)}">
        <div class="product-media">${media}${p.badge?'<span class="product-badge">'+esc(p.badge)+'</span>':""}${photoCount}${out?'<span class="stock-overlay">OUT OF STOCK</span>':""}</div>
        <div class="product-info">
          <span class="product-store">${esc(categoryLabel)}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description||"")}</p>
          <span class="product-stock ${out?"out":""}">${out?"Out of Stock":esc(p.stock||"In Stock")}</span>
          <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-button" data-add="${esc(p.id)}" ${out?"disabled":""}>${out?"Out of stock":"Add to bag"}</button></div>
          <button class="quick-view" data-open-product="${esc(p.id)}">View details</button>
        </div></article>`;
    }).join("");
    requestAnimationFrame(()=>{applyPageOverrides();refreshLuxuryMotion();});
  }

  function promotionCategoryKey(value){
    return String(value||"promotion").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||"promotion";
  }

  function promotionCategories(){
    const configured=Array.isArray(state.data?.promotionCategories)?state.data.promotionCategories:[];
    const seen=new Set();
    const out=[];

    configured.forEach(cat=>{
      const name=String(cat?.name||"").trim();
      if(!name)return;
      const id=String(cat?.id||promotionCategoryKey(name));
      if(seen.has(id))return;
      seen.add(id);
      out.push({id,name});
    });

    (state.data?.promotions||[]).forEach(promo=>{
      const name=String(promo?.label||"Promotion").trim()||"Promotion";
      const id=String(promo?.categoryId||promotionCategoryKey(name));
      if(seen.has(id))return;
      seen.add(id);
      out.push({id,name});
    });

    return out;
  }

  function promoMatchesCategory(promo,categoryId){
    const id=String(promo?.categoryId||promotionCategoryKey(promo?.label||"Promotion"));
    return id===categoryId;
  }

  function renderPromotions(){
    const zone=$("#promotionZone"), track=$("#promotionTrack"), nav=$("#promotionCategories");
    if(!zone||!track||!nav||!state.data)return;

    const promos=(state.data.promotions||[]).map((promo,i)=>{
      const product=state.data.products.find(p=>p.id===promo.productId);
      return product?{promo,product,i}:null;
    }).filter(Boolean);

    const cats=promotionCategories().map(cat=>({
      ...cat,
      count:promos.filter(x=>promoMatchesCategory(x.promo,cat.id)).length
    })).filter(cat=>cat.count>0);

    zone.hidden=!promos.length||!cats.length;
    if(zone.hidden){
      nav.innerHTML="";
      track.innerHTML="";
      state.promotionCategory="";
      return;
    }

    if(!cats.some(cat=>cat.id===state.promotionCategory)){
      state.promotionCategory=cats[0].id;
    }

    nav.innerHTML=cats.map((cat,index)=>{
      const active=cat.id===state.promotionCategory;
      return `<button class="promotion-category-button${active?" active":""}" type="button" role="tab" aria-selected="${active?"true":"false"}" data-promo-category="${esc(cat.id)}" style="--promo-index:${index}">
        <span>${esc(cat.name)}</span>
        <small>${cat.count} ${cat.count===1?"item":"items"}</small>
      </button>`;
    }).join("");

    const activePromos=promos.filter(x=>promoMatchesCategory(x.promo,state.promotionCategory));

    track.classList.remove("promotion-track-switching");
    void track.offsetWidth;
    track.innerHTML=activePromos.map(({promo,product},index)=>{
      const category= cats.find(cat=>cat.id===state.promotionCategory);
      return `<article class="promotion-card" data-open-product="${esc(product.id)}" tabindex="0" style="--promo-card-index:${index}">
        <div class="promotion-image">${productMedia(product,"promotion-product-image")}</div>
        <div class="promotion-copy">
          <span class="promotion-kicker">${esc(category?.name||promo.label||"PROMOTION")}</span>
          <h3>${esc(product.name)}</h3>
          <small>${esc(product.category||"Ganduvaru")}</small>
          <strong>${money(product.price)}</strong>
          <span class="promotion-link">View offer →</span>
        </div>
      </article>`;
    }).join("");
    track.scrollLeft=0;
    const bar=$("#promotionCarouselBar"),count=$("#promotionCarouselCount"),prev=$("#promotionPrev"),next=$("#promotionNext");
    if(bar)bar.hidden=activePromos.length<2;
    if(count)count.textContent=activePromos.length+" "+(activePromos.length===1?"item":"items");
    if(prev)prev.disabled=activePromos.length<2;
    if(next)next.disabled=activePromos.length<2;
    requestAnimationFrame(()=>{
      track.classList.add("promotion-track-switching");
      refreshLuxuryMotion();
    });
  }

  function scrollPromotions(direction){
    const track=$("#promotionTrack"); if(!track)return;
    const card=track.querySelector(".promotion-card");
    const amount=(card?.getBoundingClientRect().width||300)+12;
    track.scrollBy({left:direction*amount,behavior:"smooth"});
  }

  let activeProductId=null,activePhotoIndex=0;
  function populateProduct(id){
    const p=state.products.find(x=>x.id===id); if(!p)return false;
    activeProductId=id;activePhotoIndex=0;
    $("#productDetailStore").textContent=[p.category,p.subcategory].filter(Boolean).join(" / ")||"Ganduvaru";
    $("#productDetailName").textContent=p.name;
    $("#productDetailPrice").textContent=money(p.price);
    const out=p.availability==="out_of_stock";
    $("#productDetailStock").textContent=out?"Out of Stock":(p.stock||"In Stock");
    $("#productDetailStock").classList.toggle("out",out);
    $("#productDetailAdd").disabled=out;
    $("#productDetailAdd").textContent=out?"Out of Stock":"Add to bag";
    $("#productDetailDescription").textContent=p.description||"";
    const badge=$("#productDetailBadge");
    badge.hidden=!p.badge;badge.textContent=p.badge||"";
    $("#productDetailAdd").dataset.add=p.id;
    renderDetailGallery();
    return true;
  }
  function openProduct(id,options={}){
    if(!populateProduct(id))return;
    openLayer("productModal",{
      historyMode:options.historyMode||"push",
      stateData:{ganduvaruProductId:id}
    });
  }
  function renderDetailGallery(){
    const p=state.products.find(x=>x.id===activeProductId);if(!p)return;
    const imgs=productImages(p), main=$("#productDetailMain"), thumbs=$("#productThumbs");
    if(!imgs.length){
      main.innerHTML='<div class="product-fallback detail-fallback"><span class="fallback-icon">'+categoryIcon(p.category)+'</span><small>'+esc(p.category||"Product")+'</small></div>';
      thumbs.innerHTML="";thumbs.hidden=true;return;
    }
    activePhotoIndex=Math.max(0,Math.min(activePhotoIndex,imgs.length-1));
    main.classList.remove("photo-changing");
    void main.offsetWidth;
    main.innerHTML='<img src="'+esc(imgs[activePhotoIndex])+'" alt="'+esc(p.name)+'" decoding="async">';
    main.classList.add("photo-changing");
    thumbs.hidden=imgs.length<2;
    thumbs.innerHTML=imgs.length<2?"":imgs.map((src,i)=>'<button type="button" class="product-thumb'+(i===activePhotoIndex?" active":"")+'" data-detail-photo="'+i+'" aria-label="View photo '+(i+1)+'" aria-pressed="'+(i===activePhotoIndex?"true":"false")+'"><img src="'+esc(src)+'" alt="" loading="lazy" decoding="async"></button>').join("");
  }

  function addToCart(id){
    const p=state.products.find(x=>x.id===id); if(!p) return;
    if(p.availability==="out_of_stock"){toast("This product is currently out of stock");return}
    const line=state.cart.find(x=>x.id===id); if(line) line.qty++; else state.cart.push({id,qty:1});
    saveCart(); toast("Added to bag");
  }
  function renderCart(){
    const items=state.cart.map(c=>({ ...c, p:state.products.find(p=>p.id===c.id) })).filter(x=>x.p);
    const totalQty=items.reduce((a,b)=>a+b.qty,0);
    $("#cartCount").textContent=totalQty;
    const bubbleCount=$("#cartBubbleCount");
    if(bubbleCount)bubbleCount.textContent=totalQty;
    $("#cartBubble")?.classList.toggle("has-items",totalQty>0);
    $("#cartItems").innerHTML=items.length?items.map(x=>{
      const imgs=productImages(x.p);
      const thumb=imgs.length?'<div class="cart-thumb cart-thumb-image"><img src="'+esc(imgs[0])+'" alt=""></div>':'<div class="cart-thumb">'+initials(x.p.name)+'</div>';
      return `
      <div class="cart-line">${thumb}<div><h4>${esc(x.p.name)}</h4><p>${money(x.p.price)}</p>
      <div class="qty"><button data-qty="${x.p.id}" data-d="-1">−</button><span>${x.qty}</span><button data-qty="${x.p.id}" data-d="1">+</button><button class="remove" data-remove="${x.p.id}">Remove</button></div></div><strong>${x.p.price==null?"—":money(x.p.price*x.qty)}</strong></div>`}).join(""):'<div class="empty-state"><strong>Your bag is empty.</strong><span>Add products to begin.</span></div>';
    const subtotal=items.reduce((n,x)=>n+(x.p.price||0)*x.qty,0); $("#cartSubtotal").textContent=money(subtotal);
  }
  function updateAccount(){
    $("#accountButton").textContent=state.user ? state.user.name.split(" ")[0] : "Sign in";
    if(state.user){
      if($("#checkoutCustomerName")&&!$("#checkoutCustomerName").value)$("#checkoutCustomerName").value=state.user.name||"";
      if($("#checkoutCustomerPhone")&&!$("#checkoutCustomerPhone").value)$("#checkoutCustomerPhone").value=state.user.phone||"";
    }
  }

  async function requestOtp(){
    const name=$("#customerName").value.trim(), phone=digits($("#customerPhone").value);
    if(name.length<2 || phone.length<7){ toast("Enter a valid name and mobile number"); return; }
    const full=(CFG.countryCode||"+960")+phone;
    if(CFG.otpRequestUrl){
      try{
        const r=await fetch(CFG.otpRequestUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,phone:full})});
        if(!r.ok) throw 0; state.pendingOtp={name,phone:full,remote:true};
      }catch(e){ toast("OTP service is unavailable"); return; }
    } else if(CFG.demoOtpAllowed){
      const code=String(Math.floor(100000+Math.random()*900000)); state.pendingOtp={name,phone:full,code,remote:false};
      $("#demoCode").hidden=false; $("#demoCode").textContent="Demo OTP: "+code+" — replace with an SMS provider before production.";
    } else { toast("SMS OTP provider is not configured"); return; }
    $("#otpSentTo").textContent="Verification for "+full; $("#authDetailsStep").hidden=true; $("#authOtpStep").hidden=false;
  }

  async function verifyOtp(){
    const code=digits($("#otpInput").value); if(code.length!==6){ toast("Enter the 6-digit code"); return; }
    let ok=false;
    if(state.pendingOtp?.remote && CFG.otpVerifyUrl){
      try{ const r=await fetch(CFG.otpVerifyUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:state.pendingOtp.phone,code})}); ok=r.ok; }catch(e){}
    } else ok=code===state.pendingOtp?.code;
    if(!ok){ toast("Incorrect OTP"); return; }
    state.user={name:state.pendingOtp.name,phone:state.pendingOtp.phone,verifiedAt:new Date().toISOString()};
    localStorage.setItem("ganduvaru_user",JSON.stringify(state.user)); updateAccount(); closeLayer("authModal"); toast("Signed in successfully");

  }

  function checkout(){
    if(!state.cart.length){ toast("Your bag is empty"); return; }
    const unavailable=state.cart.map(x=>state.products.find(p=>p.id===x.id)).filter(p=>p?.availability==="out_of_stock");
    if(unavailable.length){toast(unavailable[0].name+" is out of stock");return}
    closeLayer("cartDrawer",{historyMode:"replace"});
    updateAccount();
    $("#orderSubmitStatus").textContent="";
    openLayer("checkoutModal",{historyMode:"none"});
  }

  async function placeOrder(){
    const name=$("#checkoutCustomerName").value.trim();
    const contact=$("#checkoutCustomerPhone").value.trim();
    const address=$("#checkoutAddress").value.trim();
    const payment=document.querySelector('input[name="payment"]:checked')?.value||"Pay on confirmation";
    const notes=$("#orderNotes").value.trim();
    const status=$("#orderSubmitStatus");

    if(name.length<2){toast("Enter the customer name");$("#checkoutCustomerName").focus();return}
    if(digits(contact).length<7){toast("Enter a valid contact number");$("#checkoutCustomerPhone").focus();return}
    if(address.length<3){toast("Enter the address or delivery details");$("#checkoutAddress").focus();return}
    if(!state.cart.length){toast("Your bag is empty");return}

    const btn=$("#placeOrderButton");
    btn.disabled=true;btn.textContent="Submitting…";
    status.textContent="Recording your order…";

    try{
      const items=state.cart.map(x=>({id:x.id,qty:x.qty}));
      const result=await publicRpc("ganduvaru_create_order",{p_order:{
        customerName:name,
        contactNumber:contact,
        address,
        items,
        paymentMethod:payment,
        notes
      }});
      if(!result?.ok)throw new Error(result?.message||"Could not submit order");

      const lines=state.cart.map(ci=>{
        const p=state.products.find(x=>x.id===ci.id);
        return p?("- "+p.name+" x"+ci.qty+" — "+money(p.price==null?null:p.price*ci.qty)):null
      }).filter(Boolean);
      const total=result.total==null?"Ask for price":money(result.total);
      const msg=[
        "GANDUVARU ONLINE ORDER",
        "Order: "+result.orderCode,
        "",
        "Customer: "+name,
        "Contact: "+contact,
        "Address: "+address,
        "",
        "Items:",...lines,
        "",
        "Listed total: "+total,
        "Payment: "+payment,
        notes?"Notes: "+notes:"",
        "",
        "Please confirm stock, delivery and final payment."
      ].filter(Boolean).join("\n");

      state.cart=[];saveCart();
      status.textContent="Order "+result.orderCode+" submitted successfully.";
      toast("Order submitted successfully");

      const number=state.data.site.orderWhatsApp||state.data.site.contactWhatsApp||"";
      if(number){
        const whatsappUrl="https://wa.me/"+digits(number)+"?text="+encodeURIComponent(msg);
        window.setTimeout(()=>window.open(whatsappUrl,"_blank","noopener"),180);
      }

      window.setTimeout(()=>closeLayer("checkoutModal",{historyMode:"replace"}),850);
    }catch(e){
      console.error(e);
      status.textContent=e.message||"Could not submit order. Please try again.";
      toast(e.message||"Could not submit order");
    }finally{
      btn.disabled=false;btn.textContent="Submit Order";
    }
  }


  function applyOneOverride(el,o){
    if(!el||!o)return;
    if(Object.prototype.hasOwnProperty.call(o,"text")) el.textContent=o.text;
    if(Object.prototype.hasOwnProperty.call(o,"href") && el.matches("a")) {
      if(o.href) el.setAttribute("href",o.href); else el.removeAttribute("href");
    }
    if(Object.prototype.hasOwnProperty.call(o,"src") && el.matches("img")) {
      if(o.src) el.setAttribute("src",o.src);
    }
    if(o.color) el.style.color=o.color;
    if(o.background) el.style.background=o.background;
    if(o.fontSize!==null && o.fontSize!==undefined && o.fontSize!=="") el.style.fontSize=Number(o.fontSize)+"px";
    if(o.radius!==null && o.radius!==undefined && o.radius!=="") el.style.borderRadius=Number(o.radius)+"px";
    if(o.customCss) el.style.cssText += ";"+o.customCss;
    if(o.hidden===true) el.style.setProperty("display","none","important");
  }

  function applyPageOverrides(){
    const overrides=state.data?.pageOverrides||{};
    Object.entries(overrides).forEach(([selector,o])=>{
      try{ document.querySelectorAll(selector).forEach(el=>applyOneOverride(el,o)); }catch(e){}
    });
  }

  function editorEscape(v){
    if(window.CSS?.escape)return CSS.escape(v);
    return String(v).replace(/[^a-zA-Z0-9_-]/g,s=>"\\"+s);
  }

  function editorSelector(el){
    if(!el || el===document.body || el===document.documentElement)return "body";
    if(el.id)return "#"+editorEscape(el.id);

    const anchor=el.closest("[data-product],[data-store-contact],[data-store],section[id],footer,header.site-header");
    let base="", root=null;
    if(anchor){
      root=anchor;
      if(anchor.dataset.product)base='[data-product="'+editorEscape(anchor.dataset.product)+'"]';
      else if(anchor.dataset.storeContact)base='[data-store-contact="'+editorEscape(anchor.dataset.storeContact)+'"]';
      else if(anchor.dataset.store)base='[data-store="'+editorEscape(anchor.dataset.store)+'"]';
      else if(anchor.id)base="#"+editorEscape(anchor.id);
      else if(anchor.matches("footer"))base=".site-footer";
      else if(anchor.matches("header.site-header"))base=".site-header";
      if(el===anchor)return base;
    } else {
      root=document.body;base="body";
    }

    const parts=[]; let cur=el;
    while(cur && cur!==root && cur!==document.body){
      let p=cur.tagName.toLowerCase();
      const classes=[...cur.classList].filter(x=>!x.startsWith("ganduvaru-editor")).slice(0,2);
      if(classes.length)p+="."+classes.map(editorEscape).join(".");
      const same=[...cur.parentElement.children].filter(x=>x.tagName===cur.tagName);
      if(same.length>1)p+=":nth-of-type("+(same.indexOf(cur)+1)+")";
      parts.unshift(p);cur=cur.parentElement;
    }
    return base+(parts.length?" > "+parts.join(" > "):"");
  }

  function startEditorBridge(){
    if(new URLSearchParams(location.search).get("editor")!=="1")return;
    document.body.classList.add("ganduvaru-editor-mode");
    const style=document.createElement("style");
    style.textContent='.ganduvaru-editor-mode *{cursor:crosshair!important}.ganduvaru-editor-mode [data-editor-selected="1"]{outline:3px solid #f0d89c!important;outline-offset:3px!important}.ganduvaru-editor-mode a,.ganduvaru-editor-mode button{cursor:crosshair!important}';
    document.head.appendChild(style);

    document.addEventListener("click",e=>{
      const el=e.target.closest("body *");
      if(!el)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      document.querySelectorAll('[data-editor-selected="1"]').forEach(x=>x.removeAttribute("data-editor-selected"));
      el.setAttribute("data-editor-selected","1");
      const cs=getComputedStyle(el);
      parent.postMessage({
        type:"GANDUVARU_EDITOR_SELECTED",
        selector:editorSelector(el),
        tag:el.tagName.toLowerCase(),
        text:(el.matches("input,textarea,select")?"":el.textContent||"").trim(),
        href:el.matches("a")?(el.getAttribute("href")||""):"",
        src:el.matches("img")?(el.getAttribute("src")||""):"",
        color:cs.color,
        background:cs.backgroundColor,
        fontSize:parseFloat(cs.fontSize)||null,
        radius:parseFloat(cs.borderRadius)||null
      },"*");
    },true);

    window.addEventListener("message",e=>{
      const m=e.data||{};
      if(m.type==="GANDUVARU_EDITOR_DATA" && m.data){
        state.data=m.data; state.products=[...(state.data.products||[])];
        hydrateSite();renderProducts();renderCart();updateAccount();applyPageOverrides();
      }
      if(m.type==="GANDUVARU_EDITOR_APPLY" && m.selector){
        try{document.querySelectorAll(m.selector).forEach(el=>applyOneOverride(el,m.override||{}));}catch(err){}
      }
      if(m.type==="GANDUVARU_EDITOR_RESET" && m.selector){
        location.reload();
      }
      if(m.type==="GANDUVARU_EDITOR_SCROLL" && m.section){
        const target=m.section==="footer"?document.querySelector("footer"):document.getElementById(m.section);
        target?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });
    parent.postMessage({type:"GANDUVARU_EDITOR_READY"},"*");
  }


  let luxuryObserver=null;

  function refreshLuxuryMotion(){
    if(!luxuryObserver)return;
    const groups=[
      [".hero-copy > *",0],
      [".hero-visual",80],
      [".section-heading",0],
      [".promotion-card",28],
      [".product-card",35],
      [".service-grid article",55],
      [".about-card",0],
      [".contact-icon-link",45],
      [".footer-grid > div",40]
    ];
    groups.forEach(([selector,step])=>{
      document.querySelectorAll(selector).forEach((el,i)=>{
        if(el.dataset.luxuryBound)return;
        el.dataset.luxuryBound="1";
        el.classList.add("luxury-reveal");
        el.style.setProperty("--reveal-delay",Math.min(i*step,220)+"ms");
        luxuryObserver.observe(el);
      });
    });
  }

  function randomizeHeroCategoryMotion(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    document.querySelectorAll(".hero-category-icon").forEach((el,i)=>{
      const rnd=(min,max)=>Math.round((min+Math.random()*(max-min))*10)/10;
      const sign=()=>Math.random()>.5?1:-1;
      el.style.setProperty("--drift-x1",(rnd(3.5,8.5)*sign())+"px");
      el.style.setProperty("--drift-y1",(rnd(3.5,8.5)*sign())+"px");
      el.style.setProperty("--drift-x2",(rnd(3.5,8.5)*sign())+"px");
      el.style.setProperty("--drift-y2",(rnd(3.5,8.5)*sign())+"px");
      el.style.setProperty("--spin",(rnd(1.2,4.2)*sign())+"deg");
      const dur=rnd(5.8,8.8);
      el.style.setProperty("--dur",dur+"s");
      el.style.setProperty("--delay",(-rnd(.2,dur))+"s");
    });
  }

  function initTopChromeAutoHide(){
    const chrome=document.getElementById("topChrome");
    const spacer=document.getElementById("topChromeSpacer");
    const header=document.querySelector(".site-header");
    if(!chrome||chrome.dataset.autoHideBound==="1")return;
    if(new URLSearchParams(location.search).get("editor")==="1")return;
    chrome.dataset.autoHideBound="1";

    let lastY=Math.max(0,window.scrollY||0);
    let direction=0;
    let travel=0;
    let ticking=false;
    let hidden=false;
    let revealingTimer=0;
    let touchY=null;
    let maxChromeHeight=0;
    let lastWidth=window.innerWidth;

    const setSpacerHeight=()=>{
      const widthChanged=Math.abs(window.innerWidth-lastWidth)>40;
      if(widthChanged){
        maxChromeHeight=0;
        lastWidth=window.innerWidth;
      }
      const h=Math.ceil(chrome.getBoundingClientRect().height||0);
      if(h>0)maxChromeHeight=Math.max(maxChromeHeight,h);
      if(maxChromeHeight>0){
        document.documentElement.style.setProperty("--top-chrome-space",maxChromeHeight+"px");
        if(spacer)spacer.style.height=maxChromeHeight+"px";
      }
    };

    const showChrome=()=>{
      if(!hidden && chrome.classList.contains("top-chrome-visible"))return;
      hidden=false;
      chrome.classList.remove("top-chrome-hidden");
      chrome.classList.add("top-chrome-visible","top-chrome-revealing");
      clearTimeout(revealingTimer);
      revealingTimer=setTimeout(()=>chrome.classList.remove("top-chrome-revealing"),360);
    };

    const hideChrome=()=>{
      if(hidden)return;
      hidden=true;
      chrome.classList.remove("top-chrome-visible","top-chrome-revealing");
      chrome.classList.add("top-chrome-hidden");
    };

    const reactToDirection=(dir,amount,y)=>{
      if(dir!==direction){
        direction=dir;
        travel=0;
      }
      travel+=amount;

      const hideAfter=Math.max(88,Math.min(maxChromeHeight||118,150)*.72);

      if(y<=8){
        travel=0;
        showChrome();
        return;
      }

      if(dir<0 && travel>=3){
        // Any clear upward intent should reveal the header immediately,
        // even when the user is still in the middle of the page.
        travel=0;
        showChrome();
      }else if(dir>0 && y>hideAfter && travel>=14){
        travel=0;
        hideChrome();
      }
    };

    const update=()=>{
      const y=Math.max(0,window.scrollY||0);
      const delta=y-lastY;

      header?.classList.toggle("scrolled",y>28);

      if(y<=8){
        showChrome();
      }else if(Math.abs(delta)>.25){
        reactToDirection(delta>0?1:-1,Math.abs(delta),y);
      }

      lastY=y;
      ticking=false;
    };

    const onScroll=()=>{
      if(ticking)return;
      ticking=true;
      requestAnimationFrame(update);
    };

    const onWheel=e=>{
      const dy=Number(e.deltaY)||0;
      if(Math.abs(dy)<.5)return;
      const y=Math.max(0,window.scrollY||0);
      reactToDirection(dy>0?1:-1,Math.abs(dy),y);
    };

    const onTouchStart=e=>{
      touchY=e.touches?.[0]?.clientY??null;
    };

    const onTouchMove=e=>{
      const y=e.touches?.[0]?.clientY;
      if(y==null||touchY==null)return;
      const dy=y-touchY;
      if(Math.abs(dy)>=3){
        // Finger moving down means the page is being scrolled upward.
        reactToDirection(dy>0?-1:1,Math.abs(dy),Math.max(0,window.scrollY||0));
        touchY=y;
      }
    };

    const onKeyDown=e=>{
      if(["ArrowUp","PageUp","Home"].includes(e.key))showChrome();
      if(["ArrowDown","PageDown","End"].includes(e.key) && window.scrollY>100)hideChrome();
    };

    setSpacerHeight();
    showChrome();
    header?.classList.toggle("scrolled",lastY>28);

    window.addEventListener("scroll",onScroll,{passive:true});
    window.addEventListener("wheel",onWheel,{passive:true});
    window.addEventListener("touchstart",onTouchStart,{passive:true});
    window.addEventListener("touchmove",onTouchMove,{passive:true});
    window.addEventListener("keydown",onKeyDown);
    window.addEventListener("resize",()=>requestAnimationFrame(setSpacerHeight),{passive:true});
    window.addEventListener("pageshow",()=>{
      lastY=Math.max(0,window.scrollY||0);
      direction=0;
      travel=0;
      setSpacerHeight();
      if(lastY<=8)showChrome();
    });

    if("ResizeObserver" in window){
      const ro=new ResizeObserver(()=>requestAnimationFrame(setSpacerHeight));
      ro.observe(chrome);
    }
  }

  function initLuxuryMotion(){
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    initTopChromeAutoHide();
    if(reduced){
      document.querySelectorAll(".luxury-reveal").forEach(el=>el.classList.add("in-view"));
      return;
    }

    luxuryObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add("in-view");
          luxuryObserver.unobserve(entry.target);
        }
      });
    },{threshold:.12,rootMargin:"0px 0px -5% 0px"});

    refreshLuxuryMotion();
    randomizeHeroCategoryMotion();

    const hero=document.querySelector(".hero-visual");
    const card=document.querySelector(".hero-card-main");
    if(hero&&card&&window.matchMedia("(min-width: 901px) and (hover: hover)").matches){
      hero.addEventListener("pointermove",e=>{
        const r=hero.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5;
        const y=(e.clientY-r.top)/r.height-.5;
        card.style.animation="none";
        card.style.transform=`translate3d(${x*8}px,${y*6}px,0) rotateX(${-y*2.5}deg) rotateY(${x*3}deg)`;
      });
      hero.addEventListener("pointerleave",()=>{card.style.transform="";card.style.animation=""});
    }
  }

  function initCartBubble(){
    const bubble=$("#cartBubble");
    if(!bubble||bubble.dataset.bound==="1")return;
    bubble.dataset.bound="1";
    bubble.dataset.draggable="true";

    const storageKey="ganduvaru_cart_bubble_position";
    const pad=10;
    let startX=0,startY=0,startLeft=0,startTop=0,moved=false,dragging=false,ignoreClickUntil=0;

    const clamp=(x,min,max)=>Math.min(Math.max(x,min),Math.max(min,max));
    const place=(left,top)=>{
      const w=bubble.offsetWidth||62,h=bubble.offsetHeight||62;
      const maxLeft=window.innerWidth-w-pad;
      const maxTop=window.innerHeight-h-pad;
      bubble.style.left=clamp(left,pad,maxLeft)+"px";
      bubble.style.top=clamp(top,pad,maxTop)+"px";
      bubble.style.right="auto";
      bubble.style.bottom="auto";
    };
    const save=()=>{
      const r=bubble.getBoundingClientRect();
      try{localStorage.setItem(storageKey,JSON.stringify({left:r.left,top:r.top}))}catch(e){}
    };
    const restore=()=>{
      try{
        const saved=JSON.parse(localStorage.getItem(storageKey)||"null");
        if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))place(saved.left,saved.top);
      }catch(e){}
    };
    const begin=(x,y)=>{
      const r=bubble.getBoundingClientRect();
      startX=x;startY=y;startLeft=r.left;startTop=r.top;moved=false;dragging=true;
      bubble.classList.add("dragging");
      bubble.setAttribute("aria-grabbed","true");
    };
    const move=(x,y)=>{
      if(!dragging)return;
      const dx=x-startX,dy=y-startY;
      if(Math.hypot(dx,dy)>4)moved=true;
      place(startLeft+dx,startTop+dy);
    };
    const finish=()=>{
      if(!dragging)return;
      dragging=false;
      bubble.classList.remove("dragging");
      bubble.setAttribute("aria-grabbed","false");
      if(moved){
        save();
        ignoreClickUntil=performance.now()+350;
      }
    };

    if(window.PointerEvent){
      bubble.addEventListener("pointerdown",e=>{
        if(e.button!==undefined&&e.button!==0)return;
        begin(e.clientX,e.clientY);
        bubble.setPointerCapture?.(e.pointerId);
      });
      bubble.addEventListener("pointermove",e=>move(e.clientX,e.clientY));
      bubble.addEventListener("pointerup",e=>{bubble.releasePointerCapture?.(e.pointerId);finish()});
      bubble.addEventListener("pointercancel",finish);
    }else{
      bubble.addEventListener("mousedown",e=>{
        if(e.button!==0)return;
        begin(e.clientX,e.clientY);
        e.preventDefault();
      });
      document.addEventListener("mousemove",e=>move(e.clientX,e.clientY));
      document.addEventListener("mouseup",finish);
      bubble.addEventListener("touchstart",e=>{
        const t=e.touches?.[0];if(!t)return;
        begin(t.clientX,t.clientY);
      },{passive:true});
      bubble.addEventListener("touchmove",e=>{
        const t=e.touches?.[0];if(!t)return;
        move(t.clientX,t.clientY);
        if(moved)e.preventDefault();
      },{passive:false});
      bubble.addEventListener("touchend",finish,{passive:true});
      bubble.addEventListener("touchcancel",finish,{passive:true});
    }

    bubble.addEventListener("click",e=>{
      if(performance.now()<ignoreClickUntil){e.preventDefault();e.stopPropagation();return}
      openLayer("cartDrawer");
    });
    bubble.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();openLayer("cartDrawer")}
    });
    window.addEventListener("resize",()=>{
      const r=bubble.getBoundingClientRect();
      place(r.left,r.top);
      save();
    },{passive:true});

    restore();
  }

  function bind(){
    document.addEventListener("click",e=>{
      const promoCategory=e.target.closest("[data-promo-category]");
      if(promoCategory){
        state.promotionCategory=promoCategory.dataset.promoCategory||"";
        renderPromotions();
        return;
      }
      const add=e.target.closest("[data-add]"); if(add){ e.stopPropagation(); addToCart(add.dataset.add); }
      const photo=e.target.closest("[data-detail-photo]"); if(photo){activePhotoIndex=Number(photo.dataset.detailPhoto)||0;renderDetailGallery();return;}
      const opener=e.target.closest("[data-open-product]"); if(opener&&!add){openProduct(opener.dataset.openProduct);}
      const f=e.target.closest("[data-filter]"); if(f){ state.filter=f.dataset.filter; $$(".filter-chip").forEach(x=>{const active=x===f;x.classList.toggle("active",active);x.setAttribute("aria-pressed",active?"true":"false")}); renderProducts(); }
      const q=e.target.closest("[data-qty]"); if(q){ const line=state.cart.find(x=>x.id===q.dataset.qty); if(line){line.qty+=Number(q.dataset.d);if(line.qty<=0)state.cart=state.cart.filter(x=>x!==line);saveCart();}}
      const rm=e.target.closest("[data-remove]"); if(rm){state.cart=state.cart.filter(x=>x.id!==rm.dataset.remove);saveCart();}
      const cls=e.target.closest("[data-close]"); if(cls) closeLayer(cls.dataset.close);
      const mobileNavLink=e.target.closest("#mobileNav a"); if(mobileNavLink) closeLayer("menuDrawer");
    });
    $("#promotionPrev")?.addEventListener("click",()=>scrollPromotions(-1));
    $("#promotionNext")?.addEventListener("click",()=>scrollPromotions(1));
    document.addEventListener("keydown",e=>{
      if(e.key!=="Escape")return;
      const openModal=document.querySelector(".modal.open");
      const openDrawer=document.querySelector(".drawer.open");
      if(openModal)closeLayer(openModal.id); else if(openDrawer)closeLayer(openDrawer.id);
    });
    window.addEventListener("popstate",e=>{
      const target=e.state?.ganduvaruLayer||null;

      if(target==="productModal"){
        const id=e.state?.ganduvaruProductId;
        if(id&&populateProduct(id))setLayerVisible("productModal",true);
      }else if($("#productModal")?.classList.contains("open")){
        setLayerVisible("productModal",false);
      }

      if(target==="cartDrawer"){
        setLayerVisible("cartDrawer",true);
      }else if($("#cartDrawer")?.classList.contains("open")){
        setLayerVisible("cartDrawer",false);
      }

      syncBackdrop();
      syncLayerLock();
    });
    $("#productGrid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-product]")){e.preventDefault();openProduct(e.target.dataset.openProduct)}});
    $("#promotionTrack")?.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-product]")){e.preventDefault();openProduct(e.target.dataset.openProduct)}});
    $("#productSearch").addEventListener("input",e=>{state.search=e.target.value;renderProducts()});
    $("#sortSelect").addEventListener("change",e=>{state.sort=e.target.value;renderProducts()});
    $("#cartButton").onclick=()=>openLayer("cartDrawer"); $("#footerCart").onclick=()=>openLayer("cartDrawer");
    $("#cartContinueButton").onclick=()=>closeLayer("cartDrawer");
    initCartBubble();
    $("#menuButton").onclick=()=>openLayer("menuDrawer");
    $("#backdrop").onclick=()=>document.querySelectorAll(".drawer.open").forEach(d=>closeLayer(d.id));
    document.addEventListener("click",e=>{
      if(e.target.matches(".modal.open"))closeLayer(e.target.id);
    });
    $("#accountButton").onclick=$("#footerAccount").onclick=()=>{ if(state.user){ toast("Signed in as "+state.user.name); } else openLayer("authModal"); };
    $("#checkoutButton").onclick=checkout; $("#requestOtpButton").onclick=requestOtp; $("#verifyOtpButton").onclick=verifyOtp;
    $("#backToDetails").onclick=()=>{$("#authOtpStep").hidden=true;$("#authDetailsStep").hidden=false;$("#demoCode").hidden=true;};
    $("#placeOrderButton").onclick=placeOrder;
    $("#searchToggle").onclick=()=>{$("#shop").scrollIntoView({block:"start"});setTimeout(()=>$("#productSearch").focus({preventScroll:true}),320)};
    $("#otpModeNotice").textContent=CFG.otpRequestUrl?"SMS OTP is enabled.":"Demo OTP mode is enabled until an SMS provider is connected.";
  }
  if(history.state?.ganduvaruLayer){
    const clean={...(history.state||{})};
    delete clean.ganduvaruLayer;delete clean.ganduvaruProductId;delete clean.ganduvaruCartOpen;
    try{history.replaceState(clean,"",location.href)}catch(e){}
  }
  initLuxuryIntro();
  load().then(()=>{initLuxuryMotion();startEditorBridge();});
})();