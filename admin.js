(() => {
  const ROOT=window.GANDUVARU_CONFIG||{}, SB=ROOT.supabase||{}, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let sessionToken=sessionStorage.getItem("ganduvaru_admin_session")||"", data=null, dirty=false;
  let selectedSelector="", selectedTag="", inspectorInitial={};

  function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2300)}
  function mark(){dirty=true;$("#changeStatus").textContent="Unsaved changes.";$("#changeStatus").style.color="#f0d89c"}
  function clean(){dirty=false;$("#changeStatus").textContent="All changes published.";$("#changeStatus").style.color="#93d9ad"}
  function slug(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")+"-"+Date.now().toString(36)}
  function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
  function toHex(v,fallback="#ffffff"){
    if(!v)return fallback;
    if(/^#[0-9a-f]{6}$/i.test(v))return v;
    const m=String(v).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
    if(!m)return fallback;
    return "#"+[m[1],m[2],m[3]].map(x=>Math.max(0,Math.min(255,Number(x))).toString(16).padStart(2,"0")).join("");
  }
  function frame(){return $("#liveFrame")?.contentWindow||null}
  function sendEditorData(){if(data&&frame())frame().postMessage({type:"GANDUVARU_EDITOR_DATA",data},"*")}
  function setInspectorMessage(m){
    if(!data||!m?.selector)return;
    selectedSelector=m.selector;selectedTag=(m.tag||"").toLowerCase();
    data.pageOverrides=data.pageOverrides||{};
    const o=data.pageOverrides[selectedSelector]||{};
    $("#selectedSelector").textContent=selectedSelector;
    $("#editorHint").textContent="Editing <"+selectedTag+"> · changes preview instantly.";
    const textAllowed=["p","h1","h2","h3","h4","h5","h6","a","span","strong","small","button","label"].includes(selectedTag);
    $("#editText").disabled=!textAllowed;
    $("#editText").value=textAllowed?(Object.prototype.hasOwnProperty.call(o,"text")?o.text:(m.text||"")):"";
    $("#editHref").disabled=selectedTag!=="a";$("#editHref").value=selectedTag==="a"?(Object.prototype.hasOwnProperty.call(o,"href")?o.href:(m.href||"")):"";
    $("#editSrc").disabled=selectedTag!=="img";$("#editSrc").value=selectedTag==="img"?(Object.prototype.hasOwnProperty.call(o,"src")?o.src:(m.src||"")):"";
    $("#editColor").value=toHex(o.color||m.color,"#ffffff");
    $("#editBg").value=toHex(o.background||m.background,"#0b0d10");
    $("#editFontSize").value=Object.prototype.hasOwnProperty.call(o,"fontSize")?o.fontSize:(m.fontSize||"");
    $("#editRadius").value=Object.prototype.hasOwnProperty.call(o,"radius")?o.radius:(m.radius||"");
    $("#editCss").value=o.customCss||"";
    $("#editHidden").checked=o.hidden===true;
    inspectorInitial={
      text:$("#editText").value,href:$("#editHref").value,src:$("#editSrc").value,
      color:$("#editColor").value,background:$("#editBg").value,
      fontSize:$("#editFontSize").value,radius:$("#editRadius").value,
      customCss:$("#editCss").value,hidden:$("#editHidden").checked
    };
  }
  function applyLiveEdit(){
    if(!data||!selectedSelector){toast("Select an element in the preview first");return}
    data.pageOverrides=data.pageOverrides||{};
    const current={...(data.pageOverrides[selectedSelector]||{})};
    const textAllowed=["p","h1","h2","h3","h4","h5","h6","a","span","strong","small","button","label"].includes(selectedTag);
    if(textAllowed)current.text=$("#editText").value;
    if(selectedTag==="a")current.href=$("#editHref").value.trim();
    if(selectedTag==="img")current.src=$("#editSrc").value.trim();

    if($("#editColor").value!==inspectorInitial.color || Object.prototype.hasOwnProperty.call(current,"color")) current.color=$("#editColor").value;
    if($("#editBg").value!==inspectorInitial.background || Object.prototype.hasOwnProperty.call(current,"background")) current.background=$("#editBg").value;
    if($("#editFontSize").value!==inspectorInitial.fontSize || Object.prototype.hasOwnProperty.call(current,"fontSize")) {
      const v=$("#editFontSize").value.trim(); if(v)current.fontSize=Number(v); else delete current.fontSize;
    }
    if($("#editRadius").value!==inspectorInitial.radius || Object.prototype.hasOwnProperty.call(current,"radius")) {
      const v=$("#editRadius").value.trim(); if(v)current.radius=Number(v); else delete current.radius;
    }
    const css=$("#editCss").value.trim(); if(css)current.customCss=css; else delete current.customCss;
    if($("#editHidden").checked)current.hidden=true; else delete current.hidden;

    data.pageOverrides[selectedSelector]=current; mark();
    frame()?.postMessage({type:"GANDUVARU_EDITOR_APPLY",selector:selectedSelector,override:current},"*");
    inspectorInitial={
      text:$("#editText").value,href:$("#editHref").value,src:$("#editSrc").value,
      color:$("#editColor").value,background:$("#editBg").value,
      fontSize:$("#editFontSize").value,radius:$("#editRadius").value,
      customCss:$("#editCss").value,hidden:$("#editHidden").checked
    };
    toast("Live preview updated");
  }
  function resetLiveEdit(){
    if(!data||!selectedSelector){toast("Select an element first");return}
    data.pageOverrides=data.pageOverrides||{};
    delete data.pageOverrides[selectedSelector];mark();
    $("#selectedSelector").textContent="Nothing selected";$("#editorHint").textContent="Element reset. Select it again after preview refresh.";
    selectedSelector="";selectedTag="";
    refreshPreview();
    toast("Element reset");
  }
  function refreshPreview(){
    const f=$("#liveFrame");if(!f)return;
    f.src="index.html?editor=1&v="+Date.now();
  }

  async function jsonFetch(url,opt={}){
    const r=await fetch(url,{...opt,headers:{apikey:SB.key,"Content-Type":"application/json",...(opt.headers||{})}});
    const body=await r.json().catch(()=>null);
    if(!r.ok) throw new Error(body?.message||body?.error_description||body?.hint||"Request failed");
    return body;
  }
  async function rpc(name,payload){
    return jsonFetch(SB.url+"/rest/v1/rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
  }
  async function loadCatalog(){
    const rows=await jsonFetch(SB.url+"/rest/v1/"+(SB.catalogTable||"ganduvaru_catalog")+"?id=eq.1&select=data",{method:"GET",headers:{"Content-Type":"application/json"}});
    if(!rows?.[0]?.data) throw new Error("Catalog not found");
    data=rows[0].data;
  }
  function showAdmin(){
    $("#loginBox").hidden=true; $("#adminApp").hidden=false; renderAll();
  }
  function showLogin(){
    $("#adminApp").hidden=true; $("#loginBox").hidden=false;
  }
  async function login(){
    const username=$("#usernameInput").value.trim(), password=$("#passwordInput").value;
    if(!username||!password){toast("Enter username and password");return}
    $("#loginBtn").disabled=true;
    try{
      const result=await rpc("ganduvaru_admin_login",{p_username:username,p_password:password});
      if(!result?.ok||!result?.token) throw new Error(result?.message||"Invalid username or password");
      sessionToken=result.token; sessionStorage.setItem("ganduvaru_admin_session",sessionToken);
      $("#passwordInput").value="";
      await loadCatalog(); showAdmin(); toast("Admin login successful");
    }catch(e){toast(e.message||"Login failed")}
    finally{$("#loginBtn").disabled=false}
  }
  async function logout(){
    const t=sessionToken; sessionToken=""; sessionStorage.removeItem("ganduvaru_admin_session");
    try{if(t)await rpc("ganduvaru_admin_logout",{p_token:t})}catch(e){}
    data=null; showLogin(); $("#passwordInput").value=""; toast("Logged out");
  }

  function renderAll(){
    data.pageOverrides=data.pageOverrides||{};
    $("#siteAnnouncement").value=data.site.announcement||"";$("#siteHeroTitle").value=data.site.heroTitle||"";$("#siteHeroSubtitle").value=data.site.heroSubtitle||"";$("#siteAboutTitle").value=data.site.aboutTitle||"";$("#siteAboutText").value=data.site.aboutText||"";$("#siteOrderWhatsApp").value=data.site.orderWhatsApp||"";
    $("#pStore").innerHTML=data.stores.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join("");
    renderTabs();renderProducts();renderStores();
    setTimeout(sendEditorData,120);
  }
  function renderTabs(){$("#tabsList").innerHTML=data.tabs.map((t,i)=>'<div class="admin-row"><div><strong>'+esc(t.label)+'</strong><small>'+esc(t.href)+'</small></div><button class="danger-btn" data-del-tab="'+i+'">Remove</button></div>').join("")}
  function renderProducts(){$("#productsList").innerHTML=data.products.map((p,i)=>'<div class="admin-row"><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+' · '+(p.price==null?"Ask for price":"MVR "+Number(p.price).toLocaleString())+'</small></div><button class="danger-btn" data-del-product="'+i+'">Remove</button></div>').join("")}
  function renderStores(){
    $("#storesList").innerHTML=data.stores.map((s,i)=>'<div class="admin-row" style="display:block"><strong>'+esc(s.name)+'</strong><div class="form-grid" style="margin-top:10px">'+
      '<label>Name<input data-store-field="'+i+':name" value="'+esc(s.name)+'"></label>'+
      '<label>Phone<input data-store-field="'+i+':phone" value="'+esc(s.phone||"")+'"></label>'+
      '<label>WhatsApp<input data-store-field="'+i+':whatsapp" value="'+esc(s.whatsapp||"")+'"></label>'+
      '<label>Email<input data-store-field="'+i+':email" value="'+esc(s.email||"")+'"></label>'+
      '<label class="span-2">Address<input data-store-field="'+i+':address" value="'+esc(s.address||"")+'"></label>'+
      '<label class="span-2">Summary<textarea rows="2" data-store-field="'+i+':summary">'+esc(s.summary||"")+'</textarea></label>'+
      '<label class="span-2">Facebook<input data-store-field="'+i+':facebook" value="'+esc(s.facebook||"")+'"></label></div><button class="danger-btn" style="margin-top:10px" data-del-store="'+i+'">Remove store</button></div>').join("")
  }
  function syncContent(){data.site.announcement=$("#siteAnnouncement").value;data.site.heroTitle=$("#siteHeroTitle").value;data.site.heroSubtitle=$("#siteHeroSubtitle").value;data.site.aboutTitle=$("#siteAboutTitle").value;data.site.aboutText=$("#siteAboutText").value;data.site.orderWhatsApp=$("#siteOrderWhatsApp").value}
  async function save(){
    syncContent(); $("#saveBtn").disabled=true;
    try{
      const result=await rpc("ganduvaru_admin_save",{p_token:sessionToken,p_data:data});
      if(!result?.ok){
        if(/session|unauthorized/i.test(result?.message||"")){sessionStorage.removeItem("ganduvaru_admin_session");sessionToken="";showLogin()}
        throw new Error(result?.message||"Publish failed");
      }
      clean();toast("Changes are live");
    }catch(e){toast(e.message||"Publish failed")}
    finally{$("#saveBtn").disabled=false}
  }

  document.addEventListener("input",e=>{
    if(!data)return;
    if(e.target.closest(".admin-section[data-admin-section='content']"))mark();
    if(e.target.dataset.storeField){const [i,k]=e.target.dataset.storeField.split(":");data.stores[Number(i)][k]=e.target.value;mark()}
  });
  document.addEventListener("click",e=>{
    if(!data)return;
    const tab=e.target.closest("[data-admin-tab]");if(tab){$$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===tab));$$("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection===tab.dataset.adminTab))}
    const dt=e.target.closest("[data-del-tab]");if(dt){data.tabs.splice(Number(dt.dataset.delTab),1);renderTabs();mark()}
    const dp=e.target.closest("[data-del-product]");if(dp){data.products.splice(Number(dp.dataset.delProduct),1);renderProducts();mark()}
    const ds=e.target.closest("[data-del-store]");if(ds){const i=Number(ds.dataset.delStore),id=data.stores[i]?.id;if(id&&data.products.some(p=>p.store===id)){if(!confirm("This store still has products. Remove the store anyway?"))return}data.stores.splice(i,1);renderAll();mark()}
  });

  $("#loginBtn").onclick=login;
  $("#passwordInput").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
  $("#logoutBtn").onclick=logout;
  $("#applyLiveEditBtn").onclick=applyLiveEdit;
  $("#resetLiveEditBtn").onclick=resetLiveEdit;
  $("#refreshPreviewBtn").onclick=refreshPreview;
  $("#liveSection").onchange=e=>frame()?.postMessage({type:"GANDUVARU_EDITOR_SCROLL",section:e.target.value},"*");
  $("#liveFrame").addEventListener("load",()=>setTimeout(sendEditorData,180));
  window.addEventListener("message",e=>{
    const m=e.data||{};
    if(m.type==="GANDUVARU_EDITOR_READY")sendEditorData();
    if(m.type==="GANDUVARU_EDITOR_SELECTED")setInspectorMessage(m);
  });
  $("#addTabBtn").onclick=()=>{const l=$("#tabLabel").value.trim(),h=$("#tabHref").value.trim();if(!l||!h)return toast("Enter label and link");data.tabs.push({label:l,href:h});$("#tabLabel").value="";$("#tabHref").value="";renderTabs();mark()};
  $("#addProductBtn").onclick=()=>{const n=$("#pName").value.trim();if(!n)return toast("Enter product name");const raw=$("#pPrice").value.trim();data.products.unshift({id:slug(n),name:n,store:$("#pStore").value,category:$("#pCategory").value.trim()||"Other",price:raw===""?null:Number(raw),badge:$("#pBadge").value.trim(),description:$("#pDescription").value.trim(),image:$("#pImage").value.trim(),featured:$("#pFeatured").checked,stock:$("#pStock").value.trim()||"Ask for stock"});["pName","pCategory","pPrice","pBadge","pDescription","pImage","pStock"].forEach(id=>$("#"+id).value="");$("#pFeatured").checked=false;renderProducts();mark();toast("Product added")};
  $("#addStoreBtn").onclick=()=>{const n=$("#sName").value.trim();if(!n)return toast("Enter store name");data.stores.push({id:slug(n),name:n,icon:$("#sIcon").value.trim()||"◇",accent:$("#sAccent").value||"#d6b36a",summary:$("#sSummary").value.trim(),address:$("#sAddress").value.trim(),phone:$("#sPhone").value.trim(),whatsapp:$("#sWhatsApp").value.trim(),email:$("#sEmail").value.trim(),facebook:$("#sFacebook").value.trim()});["sName","sIcon","sSummary","sAddress","sPhone","sWhatsApp","sEmail","sFacebook"].forEach(id=>$("#"+id).value="");renderAll();mark();toast("Store added")};
  $("#saveBtn").onclick=save;

  (async()=>{if(!SB.url||!SB.key){toast("Backend configuration missing");return}if(sessionToken){try{await loadCatalog();showAdmin()}catch(e){sessionStorage.removeItem("ganduvaru_admin_session");sessionToken="";showLogin()}}})();
})();