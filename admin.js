(() => {
  const ROOT=window.GANDUVARU_CONFIG||{}, SB=ROOT.supabase||{}, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let sessionToken=sessionStorage.getItem("ganduvaru_admin_session")||"", data=null, dirty=false;
  let adminRole=sessionStorage.getItem("ganduvaru_admin_role")||"", adminUsername=sessionStorage.getItem("ganduvaru_admin_username")||"";
  let editingProductIndex=-1, adminUsers=[];
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
  function applyRoleUI(){
    const superAdmin=adminRole==="super_admin";
    $("[data-super-only]").forEach(el=>el.hidden=!superAdmin);
    $("#adminRoleBadge").textContent=superAdmin?"SUPER ADMIN":"PRODUCT ADMIN";
    $("#adminStatus").textContent=adminUsername||"Secure session";
    if(!superAdmin){
      $("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x.dataset.adminTab==="products"));
      $("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection==="products"));
      $("#productAccessNote").textContent="Product Admin access: you can add new products only. New products are published immediately.";
    } else {
      $("#productAccessNote").textContent="Add products with multiple photos. Put one image URL on each line. Super Admin can also edit or remove existing products.";
    }
  }
  function showAdmin(){
    $("#loginBox").hidden=true; $("#adminApp").hidden=false; applyRoleUI(); renderAll();
    if(adminRole==="super_admin") loadAdminUsers();
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
      sessionToken=result.token; adminRole=result.role||"product_admin"; adminUsername=result.username||username;
      sessionStorage.setItem("ganduvaru_admin_session",sessionToken);
      sessionStorage.setItem("ganduvaru_admin_role",adminRole);
      sessionStorage.setItem("ganduvaru_admin_username",adminUsername);
      $("#passwordInput").value="";
      await loadCatalog(); showAdmin(); toast(adminRole==="super_admin"?"Super Admin login successful":"Product Admin login successful");
    }catch(e){toast(e.message||"Login failed")}
    finally{$("#loginBtn").disabled=false}
  }
  async function logout(){
    const t=sessionToken; sessionToken=""; adminRole=""; adminUsername="";
    ["ganduvaru_admin_session","ganduvaru_admin_role","ganduvaru_admin_username"].forEach(k=>sessionStorage.removeItem(k));
    try{if(t)await rpc("ganduvaru_admin_logout",{p_token:t})}catch(e){}
    data=null; showLogin(); $("#passwordInput").value=""; toast("Logged out");
  }

  function renderAll(){
    data.pageOverrides=data.pageOverrides||{}; data.promotions=data.promotions||[]; data.stores=data.stores||[]; data.products=data.products||[];
    if(adminRole==="super_admin"){
      $("#siteAnnouncement").value=data.site?.announcement||"";$("#siteHeroTitle").value=data.site?.heroTitle||"";$("#siteHeroSubtitle").value=data.site?.heroSubtitle||"";$("#siteAboutTitle").value=data.site?.aboutTitle||"";$("#siteAboutText").value=data.site?.aboutText||"";$("#siteOrderWhatsApp").value=data.site?.orderWhatsApp||"";
      renderTabs();renderStores();renderPromotions();
    }
    const storeOptions=['<option value="">General / Unassigned</option>',...data.stores.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>')].join("");
    $("#pStore").innerHTML=storeOptions;
    renderProducts();
    if(adminRole==="super_admin") setTimeout(sendEditorData,120);
  }
  function renderTabs(){$("#tabsList").innerHTML=data.tabs.map((t,i)=>'<div class="admin-row"><div><strong>'+esc(t.label)+'</strong><small>'+esc(t.href)+'</small></div><button class="danger-btn" data-del-tab="'+i+'">Remove</button></div>').join("")}
  function productImages(p){return [...new Set([...(Array.isArray(p?.images)?p.images:[]),p?.image].map(x=>String(x||"").trim()).filter(Boolean))]}
  function renderProducts(){
    const superAdmin=adminRole==="super_admin";
    $("#productsList").innerHTML=data.products.map((p,i)=>{
      const n=productImages(p).length;
      const actions=superAdmin?'<div class="admin-row-actions"><button class="mini-btn" data-edit-product="'+i+'">Edit</button><button class="danger-btn" data-del-product="'+i+'">Remove</button></div>':"";
      return '<div class="admin-row"><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.category||"Other")+' · '+(p.price==null?"Ask for price":"MVR "+Number(p.price).toLocaleString())+'</small><small class="admin-row-photo-count">'+n+' photo'+(n===1?"":"s")+'</small></div>'+actions+'</div>';
    }).join("");
  }
  function renderPromotions(){
    if(adminRole!=="super_admin")return;
    const opts=data.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
    $("#promoProduct").innerHTML=opts||'<option value="">No products available</option>';
    $("#promotionsList").innerHTML=(data.promotions||[]).map((pr,i)=>{
      const p=data.products.find(x=>x.id===pr.productId);
      return '<div class="admin-row"><div><strong>'+esc(p?.name||pr.productId)+'</strong><small>'+esc(pr.label||"Promotion")+'</small></div><button class="danger-btn" data-del-promo="'+i+'">Remove</button></div>';
    }).join("")||'<div class="admin-row"><small>No promotions selected yet.</small></div>';
  }
  async function loadAdminUsers(){
    if(adminRole!=="super_admin")return;
    try{
      const result=await rpc("ganduvaru_admin_list_users",{p_token:sessionToken});
      if(!result?.ok)throw new Error(result?.message||"Could not load admins");
      adminUsers=result.users||[];renderAdminUsers();
    }catch(e){toast(e.message||"Could not load admins")}
  }
  function renderAdminUsers(){
    const box=$("#adminsList");if(!box)return;
    box.innerHTML=adminUsers.map(u=>'<div class="admin-row"><div><strong>'+esc(u.username)+'</strong><small>'+(u.role==="super_admin"?"Super Admin":"Product Admin")+' · '+(u.active?"Active":"Disabled")+'</small></div><div class="admin-row-actions"><button class="mini-btn" data-reset-admin="'+u.id+'">Reset password</button>'+(u.role!=="super_admin"?'<button class="'+(u.active?"danger-btn":"mini-btn")+'" data-toggle-admin="'+u.id+'" data-next="'+(!u.active)+'">'+(u.active?"Disable":"Enable")+'</button>':"")+'</div></div>').join("");
  }
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
    if(adminRole==="super_admin"&&e.target.closest(".admin-section[data-admin-section='content']"))mark();
    if(adminRole==="super_admin"&&e.target.dataset.storeField){const [i,k]=e.target.dataset.storeField.split(":");data.stores[Number(i)][k]=e.target.value;mark()}
  });
  document.addEventListener("click",e=>{
    if(!data)return;
    const tab=e.target.closest("[data-admin-tab]");if(tab){$$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===tab));$$("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection===tab.dataset.adminTab))}
    const dt=e.target.closest("[data-del-tab]");if(dt&&adminRole==="super_admin"){data.tabs.splice(Number(dt.dataset.delTab),1);renderTabs();mark()}
    const ep=e.target.closest("[data-edit-product]");if(ep&&adminRole==="super_admin"){loadProductForm(Number(ep.dataset.editProduct))}
    const dp=e.target.closest("[data-del-product]");if(dp&&adminRole==="super_admin"){data.products.splice(Number(dp.dataset.delProduct),1);editingProductIndex=-1;clearProductForm();renderProducts();renderPromotions();mark()}
    const dpr=e.target.closest("[data-del-promo]");if(dpr&&adminRole==="super_admin"){data.promotions.splice(Number(dpr.dataset.delPromo),1);renderPromotions();mark()}
    const ta=e.target.closest("[data-toggle-admin]");if(ta&&adminRole==="super_admin")toggleAdmin(Number(ta.dataset.toggleAdmin),ta.dataset.next==="true");
    const ra=e.target.closest("[data-reset-admin]");if(ra&&adminRole==="super_admin")resetAdminPassword(Number(ra.dataset.resetAdmin));
    const ds=e.target.closest("[data-del-store]");if(ds&&adminRole==="super_admin"){const i=Number(ds.dataset.delStore),id=data.stores[i]?.id;if(id&&data.products.some(p=>p.store===id)){if(!confirm("This store still has products. Remove the store anyway?"))return}data.stores.splice(i,1);renderAll();mark()}
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
  function readProductForm(existingId=""){
    const n=$("#pName").value.trim();if(!n){toast("Enter product name");return null}
    const raw=$("#pPrice").value.trim();
    const images=[...new Set($("#pImages").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
    return {id:existingId||slug(n),name:n,store:$("#pStore").value,category:$("#pCategory").value.trim()||"Other",price:raw===""?null:Number(raw),badge:$("#pBadge").value.trim(),description:$("#pDescription").value.trim(),image:images[0]||"",images,featured:$("#pFeatured").checked,stock:$("#pStock").value.trim()||"Ask for stock"};
  }
  function clearProductForm(){
    editingProductIndex=-1;
    ["pName","pCategory","pPrice","pBadge","pDescription","pImages","pStock"].forEach(id=>$("#"+id).value="");
    $("#pStore").value="";$("#pFeatured").checked=false;$("#addProductBtn").textContent="Add product";$("#cancelProductEditBtn").hidden=true;
  }
  function loadProductForm(i){
    const p=data.products[i];if(!p)return;editingProductIndex=i;
    $("#pName").value=p.name||"";$("#pStore").value=p.store||"";$("#pCategory").value=p.category||"";$("#pPrice").value=p.price==null?"":p.price;$("#pBadge").value=p.badge||"";$("#pStock").value=p.stock||"";$("#pDescription").value=p.description||"";$("#pImages").value=productImages(p).join("\n");$("#pFeatured").checked=!!p.featured;
    $("#addProductBtn").textContent="Update product";$("#cancelProductEditBtn").hidden=false;$("#pName").focus();window.scrollTo({top:document.querySelector("[data-admin-section='products']").offsetTop-70,behavior:"smooth"});
  }
  $("#cancelProductEditBtn").onclick=clearProductForm;
  $("#addProductBtn").onclick=async()=>{
    const existing=editingProductIndex>=0?data.products[editingProductIndex]?.id:"";
    const product=readProductForm(existing);if(!product)return;
    if(adminRole==="product_admin"){
      $("#addProductBtn").disabled=true;
      try{
        const result=await rpc("ganduvaru_admin_add_product",{p_token:sessionToken,p_product:product});
        if(!result?.ok)throw new Error(result?.message||"Could not add product");
        await loadCatalog();clearProductForm();renderAll();toast("Product published successfully");
      }catch(e){toast(e.message||"Could not add product")}
      finally{$("#addProductBtn").disabled=false}
      return;
    }
    if(editingProductIndex>=0){data.products[editingProductIndex]=product;toast("Product updated — publish changes to go live")}
    else{data.products.unshift(product);toast("Product added — publish changes to go live")}
    clearProductForm();renderProducts();renderPromotions();mark();
  };
  $("#addPromoBtn").onclick=()=>{if(adminRole!=="super_admin")return;const id=$("#promoProduct").value;if(!id)return toast("Select a product");if(data.promotions.some(x=>x.productId===id))return toast("This product is already in promotions");data.promotions.unshift({productId:id,label:$("#promoLabel").value.trim()||"PROMOTION"});$("#promoLabel").value="";renderPromotions();mark();toast("Promotion added")};
  $("#addStoreBtn").onclick=()=>{if(adminRole!=="super_admin")return;const n=$("#sName").value.trim();if(!n)return toast("Enter store name");data.stores.push({id:slug(n),name:n,icon:$("#sIcon").value.trim()||"◇",accent:$("#sAccent").value||"#d6b36a",summary:$("#sSummary").value.trim(),address:$("#sAddress").value.trim(),phone:$("#sPhone").value.trim(),whatsapp:$("#sWhatsApp").value.trim(),email:$("#sEmail").value.trim(),facebook:$("#sFacebook").value.trim()});["sName","sIcon","sSummary","sAddress","sPhone","sWhatsApp","sEmail","sFacebook"].forEach(id=>$("#"+id).value="");renderAll();mark();toast("Store added")};
  async function createAdmin(){
    const username=$("#newAdminUsername").value.trim(),password=$("#newAdminPassword").value;
    if(!username||password.length<8)return toast("Enter a username and password of at least 8 characters");
    $("#createAdminBtn").disabled=true;
    try{const result=await rpc("ganduvaru_admin_create_user",{p_token:sessionToken,p_username:username,p_password:password});if(!result?.ok)throw new Error(result?.message||"Could not create admin");$("#newAdminUsername").value="";$("#newAdminPassword").value="";await loadAdminUsers();toast("Product Admin created")}
    catch(e){toast(e.message||"Could not create admin")}finally{$("#createAdminBtn").disabled=false}
  }
  async function toggleAdmin(id,active){
    try{const result=await rpc("ganduvaru_admin_set_user_active",{p_token:sessionToken,p_admin_id:id,p_active:active});if(!result?.ok)throw new Error(result?.message||"Could not update admin");await loadAdminUsers();toast(active?"Admin enabled":"Admin disabled")}catch(e){toast(e.message||"Could not update admin")}
  }
  async function resetAdminPassword(id){
    const password=prompt("Enter a new password (minimum 8 characters):");if(password===null)return;if(password.length<8)return toast("Password must be at least 8 characters");
    try{const result=await rpc("ganduvaru_admin_reset_user_password",{p_token:sessionToken,p_admin_id:id,p_password:password});if(!result?.ok)throw new Error(result?.message||"Could not reset password");toast("Password updated")}catch(e){toast(e.message||"Could not reset password")}
  }
  $("#createAdminBtn").onclick=createAdmin;
  $("#saveBtn").onclick=save;

  (async()=>{
    if(!SB.url||!SB.key){toast("Backend configuration missing");return}
    if(sessionToken){
      try{
        const me=await rpc("ganduvaru_admin_me",{p_token:sessionToken});
        if(!me?.ok)throw new Error("Session expired");
        adminRole=me.role;adminUsername=me.username;
        sessionStorage.setItem("ganduvaru_admin_role",adminRole);sessionStorage.setItem("ganduvaru_admin_username",adminUsername);
        await loadCatalog();showAdmin();
      }catch(e){
        ["ganduvaru_admin_session","ganduvaru_admin_role","ganduvaru_admin_username"].forEach(k=>sessionStorage.removeItem(k));
        sessionToken="";adminRole="";adminUsername="";showLogin()
      }
    }
  })();
})();