(() => {
  const CFG = window.GANDUVARU_CONFIG || {};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { data:null, products:[], filter:"All", search:"", sort:"featured", cart:JSON.parse(localStorage.getItem("ganduvaru_cart")||"[]"), user:JSON.parse(localStorage.getItem("ganduvaru_user")||"null"), pendingOtp:null };

  const money = v => v == null ? "Ask for price" : "MVR " + Number(v).toLocaleString();
  const digits = v => (v||"").replace(/\D/g,"");
  const initials = s => (s||"G").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const categoryIcon = c => ({
    "Phones":"▯","Tablets":"▭","Audio":"◉","Accessories":"✦","Smart Watches":"◌",
    "Networking":"⌁","Home Appliances":"◇","Personal Care Electronics":"✧",
    "Skincare":"◫","Beauty":"✤"
  }[c]||"G");
  function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200); }
  function saveCart(){ localStorage.setItem("ganduvaru_cart",JSON.stringify(state.cart)); renderCart(); }
  function openLayer(id){ $("#"+id).classList.add("open"); $("#"+id).setAttribute("aria-hidden","false"); if(id.includes("Drawer")) $("#backdrop").hidden=false; }
  function closeLayer(id){ const el=$("#"+id); el.classList.remove("open"); el.setAttribute("aria-hidden","true"); if(!$$(".drawer.open").length) $("#backdrop").hidden=true; }
  function getStore(id){ return (state.data?.stores||[]).find(s=>s.id===id) || {}; }
  const esc = v => String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  function productImages(p){
    const all=[...(Array.isArray(p?.images)?p.images:[]),p?.image].map(x=>String(x||"").trim()).filter(Boolean);
    return [...new Set(all)];
  }
  function productMedia(p,cls=""){
    const imgs=productImages(p);
    if(!imgs.length) return '<div class="product-fallback '+cls+'"><span class="fallback-icon">'+categoryIcon(p.category)+'</span><small>'+esc(p.category||"Product")+'</small></div>';
    return '<img class="'+cls+'" src="'+esc(imgs[0])+'" alt="'+esc(p.name)+'" loading="lazy">';
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

    const nav=d.tabs.map(t=>'<a href="'+t.href+'">'+t.label+'</a>').join("");
    $("#desktopNav").innerHTML=nav; $("#mobileNav").innerHTML=nav;

    $("#storeGrid").innerHTML=d.stores.map(s=>`
      <article class="store-card" data-store="${s.id}" style="--accent:${s.accent||"#d6b36a"}">
        <div><div class="store-icon">${s.icon||"◇"}</div><h3>${s.name}</h3><p>${s.summary||""}</p></div>
        <span class="store-link">Shop this store →</span>
      </article>`).join("");

    renderPromotions();

    $("#contactGrid").innerHTML=d.stores.map(s=>`
      <article class="contact-card" data-store-contact="${s.id}">
        <h3>${s.name}</h3><p>${s.address||""}</p><p>${s.phone||""}${s.whatsapp && s.whatsapp!==s.phone ? " · WhatsApp "+s.whatsapp : ""}</p>${s.email?'<p>'+s.email+'</p>':""}
        <div class="contact-actions">
          ${s.phone?'<a class="small-button" href="tel:'+digits(s.phone)+'">Call</a>':""}
          ${s.whatsapp?'<a class="small-button" target="_blank" rel="noopener" href="https://wa.me/'+digits(s.whatsapp)+'">WhatsApp</a>':""}
          ${s.facebook?'<a class="small-button" target="_blank" rel="noopener" href="'+s.facebook+'">Facebook</a>':""}
        </div>
      </article>`).join("");

    const cats = ["All", ...new Set(d.products.map(p=>p.category).filter(Boolean))];
    $("#filters").innerHTML=cats.map(c=>'<button class="filter-chip'+(c==="All"?" active":"")+'" data-filter="'+c+'">'+c+'</button>').join("");
    requestAnimationFrame(()=>{applyPageOverrides();refreshLuxuryMotion();});
  }

  function filtered(){
    let list=[...state.products];
    if(state.filter!=="All") list=list.filter(p=>p.category===state.filter || p.store===state.filter);
    const q=state.search.trim().toLowerCase();
    if(q) list=list.filter(p=>[p.name,p.category,p.description,getStore(p.store).name].join(" ").toLowerCase().includes(q));
    if(state.sort==="price-asc") list.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
    if(state.sort==="price-desc") list.sort((a,b)=>(b.price??-1)-(a.price??-1));
    if(state.sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
    if(state.sort==="featured") list.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
    return list;
  }

  function renderProducts(){
    const list=filtered(); $("#emptyState").hidden=!!list.length;
    $("#productGrid").innerHTML=list.map(p=>{
      const s=getStore(p.store), imgs=productImages(p);
      const media=productMedia(p);
      const photoCount=imgs.length>1?'<span class="photo-count">'+imgs.length+' photos</span>':"";
      return `<article class="product-card commerce-card" data-product="${esc(p.id)}" data-open-product="${esc(p.id)}" tabindex="0" aria-label="View ${esc(p.name)}">
        <div class="product-media">${media}${p.badge?'<span class="product-badge">'+esc(p.badge)+'</span>':""}${photoCount}</div>
        <div class="product-info">
          <span class="product-store">${esc(s.name||p.store||"Ganduvaru")}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description||"")}</p>
          <span class="product-stock">${esc(p.stock||"Ask for stock")}</span>
          <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-button" data-add="${esc(p.id)}">Add</button></div>
          <button class="quick-view" data-open-product="${esc(p.id)}">View details</button>
        </div></article>`;
    }).join("");
    requestAnimationFrame(()=>{applyPageOverrides();refreshLuxuryMotion();});
  }

  function renderPromotions(){
    const zone=$("#promotionZone"), track=$("#promotionTrack");
    if(!zone||!track||!state.data)return;
    const promos=(state.data.promotions||[]).map((promo,i)=>{
      const product=state.data.products.find(p=>p.id===promo.productId);
      return product?{promo,product,i}:null;
    }).filter(Boolean);
    zone.hidden=!promos.length;
    if(!promos.length){track.innerHTML="";return}
    track.innerHTML=promos.map(({promo,product})=>{
      const s=getStore(product.store);
      return `<article class="promotion-card" data-open-product="${esc(product.id)}" tabindex="0">
        <div class="promotion-image">${productMedia(product,"promotion-product-image")}</div>
        <div class="promotion-copy">
          <span class="promotion-kicker">${esc(promo.label||product.badge||"PROMOTION")}</span>
          <h3>${esc(product.name)}</h3>
          <small>${esc(s.name||product.category||"Ganduvaru")}</small>
          <strong>${money(product.price)}</strong>
          <span class="promotion-link">View offer →</span>
        </div>
      </article>`;
    }).join("");
  }

  let activeProductId=null,activePhotoIndex=0;
  function openProduct(id){
    const p=state.products.find(x=>x.id===id); if(!p)return;
    activeProductId=id;activePhotoIndex=0;
    const s=getStore(p.store);
    $("#productDetailStore").textContent=s.name||p.store||"Ganduvaru";
    $("#productDetailName").textContent=p.name;
    $("#productDetailPrice").textContent=money(p.price);
    $("#productDetailStock").textContent=p.stock||"Ask for stock";
    $("#productDetailDescription").textContent=p.description||"";
    const badge=$("#productDetailBadge");
    badge.hidden=!p.badge;badge.textContent=p.badge||"";
    $("#productDetailAdd").dataset.add=p.id;
    renderDetailGallery();
    openLayer("productModal");
  }
  function renderDetailGallery(){
    const p=state.products.find(x=>x.id===activeProductId);if(!p)return;
    const imgs=productImages(p), main=$("#productDetailMain"), thumbs=$("#productThumbs");
    if(!imgs.length){
      main.innerHTML='<div class="product-fallback detail-fallback"><span class="fallback-icon">'+categoryIcon(p.category)+'</span><small>'+esc(p.category||"Product")+'</small></div>';
      thumbs.innerHTML="";return;
    }
    activePhotoIndex=Math.max(0,Math.min(activePhotoIndex,imgs.length-1));
    main.innerHTML='<img src="'+esc(imgs[activePhotoIndex])+'" alt="'+esc(p.name)+'">';
    thumbs.innerHTML=imgs.map((src,i)=>'<button class="product-thumb'+(i===activePhotoIndex?" active":"")+'" data-detail-photo="'+i+'" aria-label="View photo '+(i+1)+'"><img src="'+esc(src)+'" alt=""></button>').join("");
  }

  function addToCart(id){
    const p=state.products.find(x=>x.id===id); if(!p) return;
    const line=state.cart.find(x=>x.id===id); if(line) line.qty++; else state.cart.push({id,qty:1});
    saveCart(); toast("Added to bag");
  }
  function renderCart(){
    const items=state.cart.map(c=>({ ...c, p:state.products.find(p=>p.id===c.id) })).filter(x=>x.p);
    $("#cartCount").textContent=items.reduce((a,b)=>a+b.qty,0);
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
    $("#checkoutUser").textContent=state.user ? state.user.name+" · "+state.user.phone : "";
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
    if(state.cart.length) setTimeout(()=>openLayer("checkoutModal"),180);
  }

  function checkout(){
    if(!state.cart.length){ toast("Your bag is empty"); return; }
    closeLayer("cartDrawer");
    if(!state.user){ openLayer("authModal"); return; }
    updateAccount(); openLayer("checkoutModal");
  }

  function placeOrder(){
    const details=$("#deliveryDetails").value.trim(); if(!details){ toast("Add delivery or pickup details"); return; }
    const payment=document.querySelector('input[name="payment"]:checked')?.value||"Pay on confirmation";
    const notes=$("#orderNotes").value.trim();
    const lines=state.cart.map(c=>{const p=state.products.find(x=>x.id===c.id);return p?("- "+p.name+" x"+c.qty+" — "+money(p.price==null?null:p.price*c.qty)):null}).filter(Boolean);
    const total=state.cart.reduce((n,c)=>{const p=state.products.find(x=>x.id===c.id);return n+(p?.price||0)*c.qty},0);
    const msg=["GANDUVARU ONLINE ORDER","","Customer: "+state.user.name,"Mobile: "+state.user.phone,"","Items:",...lines,"","Listed subtotal: "+money(total),"Method: "+payment,"Delivery/Pickup: "+details,notes?"Notes: "+notes:"","", "Please confirm stock, delivery and final payment."].filter(Boolean).join("\n");
    const number=state.data.site.orderWhatsApp||"9607969050";
    window.open("https://wa.me/"+digits(number)+"?text="+encodeURIComponent(msg),"_blank","noopener");
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
      [".store-card",45],
      [".promotion-card",28],
      [".product-card",35],
      [".service-grid article",55],
      [".about-card",0],
      [".contact-card",45],
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

  function initLuxuryMotion(){
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    const header=document.querySelector(".site-header");
    const syncHeader=()=>header?.classList.toggle("scrolled",window.scrollY>28);
    syncHeader();
    window.addEventListener("scroll",syncHeader,{passive:true});

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

  function bind(){
    document.addEventListener("click",e=>{
      const add=e.target.closest("[data-add]"); if(add){ e.stopPropagation(); addToCart(add.dataset.add); }
      const photo=e.target.closest("[data-detail-photo]"); if(photo){activePhotoIndex=Number(photo.dataset.detailPhoto)||0;renderDetailGallery();return;}
      const opener=e.target.closest("[data-open-product]"); if(opener&&!add){openProduct(opener.dataset.openProduct);}
      const f=e.target.closest("[data-filter]"); if(f){ state.filter=f.dataset.filter; $$(".filter-chip").forEach(x=>x.classList.toggle("active",x===f)); renderProducts(); }
      const st=e.target.closest("[data-store]"); if(st){ state.filter=st.dataset.store; $("#shop").scrollIntoView(); renderProducts(); }
      const q=e.target.closest("[data-qty]"); if(q){ const line=state.cart.find(x=>x.id===q.dataset.qty); if(line){line.qty+=Number(q.dataset.d);if(line.qty<=0)state.cart=state.cart.filter(x=>x!==line);saveCart();}}
      const rm=e.target.closest("[data-remove]"); if(rm){state.cart=state.cart.filter(x=>x.id!==rm.dataset.remove);saveCart();}
      const cls=e.target.closest("[data-close]"); if(cls) closeLayer(cls.dataset.close);
    });
    $("#productGrid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-product]")){e.preventDefault();openProduct(e.target.dataset.openProduct)}});
    $("#promotionTrack")?.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-open-product]")){e.preventDefault();openProduct(e.target.dataset.openProduct)}});
    $("#productSearch").addEventListener("input",e=>{state.search=e.target.value;renderProducts()});
    $("#sortSelect").addEventListener("change",e=>{state.sort=e.target.value;renderProducts()});
    $("#cartButton").onclick=()=>openLayer("cartDrawer"); $("#footerCart").onclick=()=>openLayer("cartDrawer");
    $("#menuButton").onclick=()=>openLayer("menuDrawer"); $("#backdrop").onclick=()=>$$(".drawer.open").forEach(d=>closeLayer(d.id));
    $("#accountButton").onclick=$("#footerAccount").onclick=()=>{ if(state.user){ toast("Signed in as "+state.user.name); } else openLayer("authModal"); };
    $("#checkoutButton").onclick=checkout; $("#requestOtpButton").onclick=requestOtp; $("#verifyOtpButton").onclick=verifyOtp;
    $("#backToDetails").onclick=()=>{$("#authOtpStep").hidden=true;$("#authDetailsStep").hidden=false;$("#demoCode").hidden=true;};
    $("#placeOrderButton").onclick=placeOrder;
    $("#searchToggle").onclick=()=>{$("#shop").scrollIntoView();setTimeout(()=>$("#productSearch").focus(),400)};
    $("#otpModeNotice").textContent=CFG.otpRequestUrl?"SMS OTP is enabled.":"Demo OTP mode is enabled until an SMS provider is connected.";
  }
  load().then(()=>{initLuxuryMotion();startEditorBridge();});
})();