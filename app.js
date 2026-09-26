(() => {
  const CFG = window.GANDUVARU_CONFIG || {};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { data:null, products:[], filter:"All", search:"", sort:"featured", cart:JSON.parse(localStorage.getItem("ganduvaru_cart")||"[]"), user:JSON.parse(localStorage.getItem("ganduvaru_user")||"null"), pendingOtp:null };

  const money = v => v == null ? "Ask for price" : "MVR " + Number(v).toLocaleString();
  const digits = v => (v||"").replace(/\D/g,"");
  const initials = s => (s||"G").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200); }
  function saveCart(){ localStorage.setItem("ganduvaru_cart",JSON.stringify(state.cart)); renderCart(); }
  function openLayer(id){ $("#"+id).classList.add("open"); $("#"+id).setAttribute("aria-hidden","false"); if(id.includes("Drawer")) $("#backdrop").hidden=false; }
  function closeLayer(id){ const el=$("#"+id); el.classList.remove("open"); el.setAttribute("aria-hidden","true"); if(!$$(".drawer.open").length) $("#backdrop").hidden=true; }
  function getStore(id){ return state.data.stores.find(s=>s.id===id) || {}; }

  async function load(){
    try{
      const res = await fetch(CFG.catalogPath || "data/catalog.json", {cache:"no-store"});
      state.data = await res.json(); state.products=[...state.data.products];
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

    $("#contactGrid").innerHTML=d.stores.map(s=>`
      <article class="contact-card">
        <h3>${s.name}</h3><p>${s.address||""}</p><p>${s.phone||""}${s.whatsapp && s.whatsapp!==s.phone ? " · WhatsApp "+s.whatsapp : ""}</p>${s.email?'<p>'+s.email+'</p>':""}
        <div class="contact-actions">
          ${s.phone?'<a class="small-button" href="tel:'+digits(s.phone)+'">Call</a>':""}
          ${s.whatsapp?'<a class="small-button" target="_blank" rel="noopener" href="https://wa.me/'+digits(s.whatsapp)+'">WhatsApp</a>':""}
          ${s.facebook?'<a class="small-button" target="_blank" rel="noopener" href="'+s.facebook+'">Facebook</a>':""}
        </div>
      </article>`).join("");

    const cats = ["All", ...new Set(d.products.map(p=>p.category).filter(Boolean))];
    $("#filters").innerHTML=cats.map(c=>'<button class="filter-chip'+(c==="All"?" active":"")+'" data-filter="'+c+'">'+c+'</button>').join("");
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
      const s=getStore(p.store);
      const media=p.image?'<img src="'+p.image+'" alt="'+p.name+'" loading="lazy" onerror="this.remove()">':'<div class="product-fallback">'+initials(p.name)+'</div>';
      return `<article class="product-card">
        <div class="product-media">${media}${p.badge?'<span class="product-badge">'+p.badge+'</span>':""}</div>
        <div class="product-info"><span class="product-store">${s.name||p.store}</span><h3>${p.name}</h3><p>${p.description||""}</p>
          <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-button" data-add="${p.id}">Add to bag</button></div>
        </div></article>`;
    }).join("");
  }

  function addToCart(id){
    const p=state.products.find(x=>x.id===id); if(!p) return;
    const line=state.cart.find(x=>x.id===id); if(line) line.qty++; else state.cart.push({id,qty:1});
    saveCart(); toast("Added to bag");
  }
  function renderCart(){
    const items=state.cart.map(c=>({ ...c, p:state.products.find(p=>p.id===c.id) })).filter(x=>x.p);
    $("#cartCount").textContent=items.reduce((a,b)=>a+b.qty,0);
    $("#cartItems").innerHTML=items.length?items.map(x=>`
      <div class="cart-line"><div class="cart-thumb">${initials(x.p.name)}</div><div><h4>${x.p.name}</h4><p>${money(x.p.price)}</p>
      <div class="qty"><button data-qty="${x.p.id}" data-d="-1">−</button><span>${x.qty}</span><button data-qty="${x.p.id}" data-d="1">+</button><button class="remove" data-remove="${x.p.id}">Remove</button></div></div><strong>${x.p.price==null?"—":money(x.p.price*x.qty)}</strong></div>`).join(""):'<div class="empty-state"><strong>Your bag is empty.</strong><span>Add products to begin.</span></div>';
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

  function bind(){
    document.addEventListener("click",e=>{
      const add=e.target.closest("[data-add]"); if(add) addToCart(add.dataset.add);
      const f=e.target.closest("[data-filter]"); if(f){ state.filter=f.dataset.filter; $$(".filter-chip").forEach(x=>x.classList.toggle("active",x===f)); renderProducts(); }
      const st=e.target.closest("[data-store]"); if(st){ state.filter=st.dataset.store; $("#shop").scrollIntoView(); renderProducts(); }
      const q=e.target.closest("[data-qty]"); if(q){ const line=state.cart.find(x=>x.id===q.dataset.qty); if(line){line.qty+=Number(q.dataset.d);if(line.qty<=0)state.cart=state.cart.filter(x=>x!==line);saveCart();}}
      const rm=e.target.closest("[data-remove]"); if(rm){state.cart=state.cart.filter(x=>x.id!==rm.dataset.remove);saveCart();}
      const cls=e.target.closest("[data-close]"); if(cls) closeLayer(cls.dataset.close);
    });
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
  load();
})();