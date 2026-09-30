(() => {
  const ROOT=window.GANDUVARU_CONFIG||{}, SB=ROOT.supabase||{}, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let sessionToken=sessionStorage.getItem("ganduvaru_admin_session")||"", data=null, dirty=false;
  let adminRole=sessionStorage.getItem("ganduvaru_admin_role")||"", adminUsername=sessionStorage.getItem("ganduvaru_admin_username")||"";
  let adminPermissions=JSON.parse(sessionStorage.getItem("ganduvaru_admin_permissions")||"[]");
  let editingProductIndex=-1, adminUsers=[], adminOrders=[];
  let selectedSelector="", selectedTag="", inspectorInitial={};

  function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2300)}
  function mark(){dirty=true;$("#changeStatus").textContent="Unsaved changes.";$("#changeStatus").style.color="#f0d89c"}
  function clean(){dirty=false;$("#changeStatus").textContent="All changes published.";$("#changeStatus").style.color="#93d9ad"}
  function slug(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")+"-"+Date.now().toString(36)}
  function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
  function hasPermission(p){return adminRole==="super_admin"||adminPermissions.includes("*")||adminPermissions.includes(p)}
  function hasAnyPermission(list){return adminRole==="super_admin"||list.some(hasPermission)}
  const permissionLabels={
    products_add:"Add products",products_edit:"Edit products",products_delete:"Delete products",
    categories_manage:"Categories & sub categories",promotions_manage:"Promotions",orders_view:"View orders",
    site_content_manage:"Site content & navigation",contact_manage:"Contact & notifications"
  };
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
    $$("[data-super-only]").forEach(el=>el.hidden=!superAdmin);
    $$("[data-permission]").forEach(el=>el.hidden=!hasPermission(el.dataset.permission));
    $$("[data-permission-any]").forEach(el=>el.hidden=!hasAnyPermission(String(el.dataset.permissionAny||"").split(",").filter(Boolean)));
    $("#adminRoleBadge").textContent=superAdmin?"SUPER ADMIN":"ADMIN";
    $("#adminStatus").textContent=adminUsername||"Secure session";

    const visibleTabs=$$("[data-admin-tab]").filter(x=>!x.hidden);
    let active=visibleTabs.find(x=>x.classList.contains("active"))||visibleTabs[0];
    if(active){
      $$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===active));
      $$("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection===active.dataset.adminTab));
    }

    const abilities=[
      hasPermission("products_add")?"add":null,
      hasPermission("products_edit")?"edit":null,
      hasPermission("products_delete")?"delete":null
    ].filter(Boolean);
    $("#productAccessNote").textContent=superAdmin
      ?"Full product access. Products are grouped by category and can include multiple photos."
      :("Product access: "+(abilities.length?abilities.join(", "):"view only")+".");
    $("#addProductBtn").hidden=!hasPermission("products_add")&&!hasPermission("products_edit");
  }
  function showAdmin(){
    $("#loginBox").hidden=true; $("#adminApp").hidden=false; applyRoleUI(); renderAll();
    if(adminRole==="super_admin") loadAdminUsers();
    if(hasPermission("orders_view")) loadOrders();
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
      sessionToken=result.token; adminRole=result.role||"product_admin"; adminUsername=result.username||username; adminPermissions=Array.isArray(result.permissions)?result.permissions:[];
      sessionStorage.setItem("ganduvaru_admin_session",sessionToken);
      sessionStorage.setItem("ganduvaru_admin_role",adminRole);
      sessionStorage.setItem("ganduvaru_admin_username",adminUsername);
      sessionStorage.setItem("ganduvaru_admin_permissions",JSON.stringify(adminPermissions));
      $("#passwordInput").value="";
      await loadCatalog(); showAdmin(); toast(adminRole==="super_admin"?"Super Admin login successful":"Product Admin login successful");
    }catch(e){toast(e.message||"Login failed")}
    finally{$("#loginBtn").disabled=false}
  }
  async function logout(){
    const t=sessionToken; sessionToken=""; adminRole=""; adminUsername="";adminPermissions=[];
    ["ganduvaru_admin_session","ganduvaru_admin_role","ganduvaru_admin_username","ganduvaru_admin_permissions"].forEach(k=>sessionStorage.removeItem(k));
    try{if(t)await rpc("ganduvaru_admin_logout",{p_token:t})}catch(e){}
    data=null; showLogin(); $("#passwordInput").value=""; toast("Logged out");
  }

  function renderAll(){
    data.pageOverrides=data.pageOverrides||{};
    data.promotions=Array.isArray(data.promotions)?data.promotions:[];
    data.products=Array.isArray(data.products)?data.products:[];
    data.tabs=Array.isArray(data.tabs)?data.tabs:[];
    data.site=data.site||{};
    data.promotionCategories=Array.isArray(data.promotionCategories)?data.promotionCategories:[];
    data.productCategories=Array.isArray(data.productCategories)?data.productCategories:[];

    if(!data.productCategories.length&&data.products.length){
      const seen=new Map();
      data.products.forEach(p=>{
        const name=String(p.category||"Other").trim()||"Other";
        const key=name.toLowerCase();
        if(!seen.has(key))seen.set(key,{id:slug(name),name,subcategories:[]});
      });
      data.productCategories=[...seen.values()];
    }
    data.productCategories.forEach(cat=>{
      cat.subcategories=Array.isArray(cat.subcategories)?cat.subcategories:[];
    });
    data.products.forEach(p=>{
      if(!p.categoryId){
        const cat=data.productCategories.find(x=>String(x.name).toLowerCase()===String(p.category||"").toLowerCase());
        if(cat)p.categoryId=cat.id;
      }
      if(!p.availability)p.availability=/out of stock/i.test(p.stock||"")?"out_of_stock":"in_stock";
      p.stock=p.availability==="out_of_stock"?"Out of Stock":(p.stock&& !/out of stock/i.test(p.stock)?p.stock:"In Stock");
    });

    if(!data.promotionCategories.length&&data.promotions.length){
      const seen=new Map();
      data.promotions.forEach(pr=>{
        const name=String(pr.label||"Promotion").trim()||"Promotion";
        const key=name.toLowerCase();
        if(!seen.has(key))seen.set(key,{id:"promo-"+slug(name),name});
      });
      data.promotionCategories=[...seen.values()];
      data.promotions.forEach(pr=>{
        const name=String(pr.label||"Promotion").trim()||"Promotion";
        const cat=data.promotionCategories.find(x=>x.name.toLowerCase()===name.toLowerCase());
        if(cat){pr.categoryId=cat.id;pr.label=cat.name}
      });
    }

    if(hasPermission("site_content_manage")){
      $("#siteAnnouncement").value=data.site.announcement||"";
      $("#siteHeroTitle").value=data.site.heroTitle||"";
      $("#siteHeroSubtitle").value=data.site.heroSubtitle||"";
      $("#siteAboutTitle").value=data.site.aboutTitle||"";
      $("#siteAboutText").value=data.site.aboutText||"";
      renderTabs();
    }
    if(hasPermission("contact_manage")){
      $("#contactPhone").value=data.site.contactPhone||"";
      $("#contactWhatsApp").value=data.site.contactWhatsApp||"";
      $("#contactFacebook").value=data.site.contactFacebook||"";
      $("#contactInstagram").value=data.site.contactInstagram||"";
      $("#contactTikTok").value=data.site.contactTikTok||"";
      $("#orderEmail").value=data.site.orderEmail||"";
      $("#orderWhatsApp").value=data.site.orderWhatsApp||data.site.contactWhatsApp||"";
      $("#orderDriveFolderLink").href=data.site.orderDriveFolderUrl||"#";
      $("#orderSheetLink").href=data.site.orderSheetUrl||"#";
    }
    if(hasPermission("categories_manage"))renderCategories();
    if(hasPermission("promotions_manage"))renderPromotions();
    renderProductSelectors();
    renderProducts();
    if(hasPermission("site_content_manage"))setTimeout(sendEditorData,120);
  }

  function renderTabs(){
    const box=$("#tabsList");if(!box)return;
    box.innerHTML=data.tabs.map((t,i)=>'<div class="admin-row"><div><strong>'+esc(t.label)+'</strong><small>'+esc(t.href)+'</small></div><button class="danger-btn" data-del-tab="'+i+'">Remove</button></div>').join("");
  }

  function productImages(p){return [...new Set([...(Array.isArray(p?.images)?p.images:[]),p?.image].map(x=>String(x||"").trim()).filter(Boolean))]}

  function categoryById(id){return data.productCategories.find(x=>x.id===id)}
  function subcategoryById(cat,id){return cat?.subcategories?.find(x=>x.id===id)}

  function renderProductSelectors(){
    const categorySelect=$("#pCategoryId"),filter=$("#adminProductCategoryFilter");
    const opts=data.productCategories.map(cat=>'<option value="'+esc(cat.id)+'">'+esc(cat.name)+'</option>').join("");
    if(categorySelect){
      const old=categorySelect.value;
      categorySelect.innerHTML=opts||'<option value="">Create a category first</option>';
      if(old&&data.productCategories.some(x=>x.id===old))categorySelect.value=old;
      renderSubcategorySelect();
    }
    if(filter){
      const old=filter.value||"all";
      filter.innerHTML='<option value="all">All categories</option>'+opts;
      if(old==="all"||data.productCategories.some(x=>x.id===old))filter.value=old;
    }
  }

  function renderSubcategorySelect(selected=""){
    const box=$("#pSubcategoryId");if(!box)return;
    const cat=categoryById($("#pCategoryId")?.value);
    box.innerHTML='<option value="">No sub category</option>'+(cat?.subcategories||[]).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join("");
    if(selected&&cat?.subcategories?.some(x=>x.id===selected))box.value=selected;
  }

  function renderCategories(){
    const box=$("#categoriesList");if(!box)return;
    box.innerHTML=data.productCategories.length?data.productCategories.map((cat,i)=>{
      const subs=(cat.subcategories||[]).map((sub,j)=>
        '<div class="subcategory-admin-row"><input data-category-index="'+i+'" data-subcategory-index="'+j+'" value="'+esc(sub.name)+'" aria-label="Sub category name" /><button class="danger-btn" data-del-subcategory="'+i+':'+j+'">Remove</button></div>'
      ).join("");
      const count=data.products.filter(p=>p.categoryId===cat.id||String(p.category).toLowerCase()===String(cat.name).toLowerCase()).length;
      return '<div class="admin-row category-admin-card"><div class="category-admin-head"><input data-category-name="'+i+'" value="'+esc(cat.name)+'" aria-label="Category name" /><span class="admin-row-photo-count">'+count+' products</span><button class="danger-btn" data-del-category="'+i+'">Remove</button></div><div class="subcategory-admin-list">'+subs+'<div class="subcategory-add-row"><input data-new-subcategory="'+i+'" placeholder="New sub category" /><button class="mini-btn" data-add-subcategory="'+i+'">Add sub category</button></div></div></div>';
    }).join(""):'<div class="admin-row"><small>No categories yet.</small></div>';
    renderProductSelectors();
  }

  function renderProducts(){
    const box=$("#productsList");if(!box)return;
    const filterBox=$("#adminProductCategoryFilter");
    let filter=filterBox?.value||"all";
    const canEdit=hasPermission("products_edit"),canDelete=hasPermission("products_delete");

    let selectedCategory=filter==="all"?null:categoryById(filter);
    if(filter!=="all"&&!selectedCategory){
      filter="all";
      selectedCategory=null;
      if(filterBox)filterBox.value="all";
    }

    const list=data.products.map((p,i)=>({p,i})).filter(({p})=>{
      if(filter==="all")return true;
      if(p.categoryId===filter)return true;
      const legacyName=String(p.category||"").trim().toLowerCase();
      const selectedName=String(selectedCategory?.name||"").trim().toLowerCase();
      return !!selectedName&&legacyName===selectedName;
    });

    $("#adminProductCount").textContent=list.length+" product"+(list.length===1?"":"s");
    box.innerHTML=list.length?list.map(({p,i})=>{
      const n=productImages(p).length;
      const cat=categoryById(p.categoryId),sub=subcategoryById(cat,p.subcategoryId);
      const catText=[cat?.name||p.category||"Other",sub?.name].filter(Boolean).join(" / ");
      const actions=(canEdit||canDelete)?'<div class="admin-row-actions">'+(canEdit?'<button class="mini-btn" data-edit-product="'+i+'">Edit</button>':'')+(canDelete?'<button class="danger-btn" data-del-product="'+i+'">Remove</button>':'')+'</div>':"";
      return '<div class="admin-row"><div><strong>'+esc(p.name)+'</strong><small>'+esc(catText)+' · '+(p.price==null?"Ask for price":"MVR "+Number(p.price).toLocaleString())+'</small><span class="stock-pill '+(p.availability==="out_of_stock"?"out":"in")+'">'+(p.availability==="out_of_stock"?"Out of Stock":"In Stock")+'</span><small class="admin-row-photo-count">'+n+' photo'+(n===1?"":"s")+'</small></div>'+actions+'</div>';
    }).join(""):'<div class="admin-row"><small>No products in this category.</small></div>';
  }

  function renderPromotions(){
    if(!hasPermission("promotions_manage"))return;

    data.promotionCategories=Array.isArray(data.promotionCategories)?data.promotionCategories:[];
    data.promotions=Array.isArray(data.promotions)?data.promotions:[];

    const productOpts=data.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
    $("#promoProduct").innerHTML=productOpts||'<option value="">No products available</option>';

    const categoryOpts=data.promotionCategories.map(cat=>'<option value="'+esc(cat.id)+'">'+esc(cat.name)+'</option>').join("");
    $("#promoCategorySelect").innerHTML=categoryOpts||'<option value="">Create a category first</option>';

    $("#promoCategoriesList").innerHTML=data.promotionCategories.length?data.promotionCategories.map((cat,i)=>{
      const count=data.promotions.filter(pr=>pr.categoryId===cat.id || (!pr.categoryId && String(pr.label||"").toLowerCase()===String(cat.name||"").toLowerCase())).length;
      return '<div class="admin-row"><div style="flex:1"><input class="promo-category-admin-input" data-promo-cat-name="'+i+'" value="'+esc(cat.name)+'" /><small class="promo-category-count">'+count+' '+(count===1?'product':'products')+'</small></div><button class="danger-btn" data-del-promo-cat="'+i+'">Remove</button></div>';
    }).join(""):'<div class="admin-row"><small>No promotion categories yet.</small></div>';

    $("#promotionsList").innerHTML=data.promotions.length?data.promotions.map((pr,i)=>{
      const p=data.products.find(x=>x.id===pr.productId);
      const cat=data.promotionCategories.find(x=>x.id===pr.categoryId);
      const label=cat?.name||pr.label||"Promotion";
      return '<div class="admin-row"><div><strong>'+esc(p?.name||pr.productId)+'</strong><small>'+esc(label)+'</small></div><button class="danger-btn" data-del-promo="'+i+'">Remove</button></div>';
    }).join(""):'<div class="admin-row"><small>No products assigned to promotions yet.</small></div>';
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
    const keys=Object.keys(permissionLabels);
    box.innerHTML=adminUsers.map(u=>{
      const perms=Array.isArray(u.permissions)?u.permissions:[];
      const chips=(u.role==="super_admin"?["Full access"]:perms.map(p=>permissionLabels[p]||p)).map(x=>'<span>'+esc(x)+'</span>').join("");
      const picker=u.role==="super_admin"?"":'<div class="permission-picker admin-user-permission-picker">'+keys.map(k=>'<label><input type="checkbox" data-user-permission="'+u.id+'" value="'+k+'" '+(perms.includes(k)?"checked":"")+' /> '+esc(permissionLabels[k])+'</label>').join("")+'</div>';
      const actions='<div class="admin-row-actions"><button class="mini-btn" data-reset-admin="'+u.id+'">Reset password</button>'+(u.role!=="super_admin"?'<button class="mini-btn" data-save-admin-permissions="'+u.id+'">Save access</button><button class="'+(u.active?"danger-btn":"mini-btn")+'" data-toggle-admin="'+u.id+'" data-next="'+(!u.active)+'">'+(u.active?"Disable":"Enable")+'</button>':"")+'</div>';
      return '<div class="admin-row admin-user-card"><div style="flex:1"><strong>'+esc(u.username)+'</strong><small>'+(u.role==="super_admin"?"Super Admin":"Admin")+' · '+(u.active?"Active":"Disabled")+'</small><div class="admin-user-permissions">'+chips+'</div>'+picker+'</div>'+actions+'</div>';
    }).join("");
  }

  async function saveAdminPermissions(id){
    const checks=$$('input[data-user-permission="'+id+'"]:checked');
    const permissions=checks.map(x=>x.value);
    try{
      const result=await rpc("ganduvaru_admin_set_user_permissions",{p_token:sessionToken,p_admin_id:id,p_permissions:permissions});
      if(!result?.ok)throw new Error(result?.message||"Could not update access");
      await loadAdminUsers();toast("Admin access updated");
    }catch(e){toast(e.message||"Could not update access")}
  }

  async function loadOrders(){
    if(!hasPermission("orders_view"))return;
    const box=$("#ordersList");if(box)box.innerHTML='<div class="admin-row"><small>Loading orders…</small></div>';
    try{
      const result=await rpc("ganduvaru_admin_list_orders",{p_token:sessionToken,p_limit:300});
      if(!result?.ok)throw new Error(result?.message||"Could not load orders");
      adminOrders=result.orders||[];renderOrders();
    }catch(e){if(box)box.innerHTML='<div class="admin-row"><small>'+esc(e.message||"Could not load orders")+'</small></div>';toast(e.message||"Could not load orders")}
  }

  function renderOrders(){
    const box=$("#ordersList"),summary=$("#ordersSummary");if(!box)return;
    const newCount=adminOrders.filter(x=>String(x.status||"New").toLowerCase()==="new").length;
    const totalKnown=adminOrders.reduce((n,o)=>n+(Number(o.totalMvr)||0),0);
    if(summary)summary.innerHTML='<span>'+adminOrders.length+' total orders</span><span>'+newCount+' new</span><span>MVR '+totalKnown.toLocaleString()+' listed total</span>';
    box.innerHTML=adminOrders.length?adminOrders.map(o=>{
      const date=o.createdAt?new Date(o.createdAt).toLocaleString():"";
      return '<div class="admin-row order-admin-card"><div><strong>'+esc(o.orderCode||("Order #"+o.id))+' · '+esc(o.customerName)+'</strong><small>'+esc(o.contactNumber)+' · '+esc(date)+'</small><address>'+esc(o.address)+'</address><div class="order-admin-items">'+esc(o.itemSummary||"")+'</div><div class="order-admin-meta"><span>'+esc(o.paymentMethod||"")+'</span><span>'+(o.totalMvr==null?"Total: Ask for price":"Total: MVR "+Number(o.totalMvr).toLocaleString())+'</span><span>'+esc(o.status||"New")+'</span></div></div><a class="mini-btn" href="tel:'+esc(String(o.contactNumber||"").replace(/[^+0-9]/g,""))+'">Call</a></div>';
    }).join(""):'<div class="admin-row"><small>No online orders yet.</small></div>';
  }

  function syncContent(){
    data.site=data.site||{};
    if(hasPermission("site_content_manage")){
      data.site.announcement=$("#siteAnnouncement").value;
      data.site.heroTitle=$("#siteHeroTitle").value;
      data.site.heroSubtitle=$("#siteHeroSubtitle").value;
      data.site.aboutTitle=$("#siteAboutTitle").value;
      data.site.aboutText=$("#siteAboutText").value;
    }
    if(hasPermission("contact_manage")){
      data.site.contactPhone=$("#contactPhone").value.trim();
      data.site.contactWhatsApp=$("#contactWhatsApp").value.trim();
      data.site.contactFacebook=$("#contactFacebook").value.trim();
      data.site.contactInstagram=$("#contactInstagram").value.trim();
      data.site.contactTikTok=$("#contactTikTok").value.trim();
      data.site.orderEmail=$("#orderEmail").value.trim();
      data.site.orderWhatsApp=$("#orderWhatsApp").value.trim()||data.site.contactWhatsApp;
    }
  }
  async function save(){
    syncContent();
    const productCategoryNames=(data.productCategories||[]).map(x=>String(x.name||"").trim());
    if(productCategoryNames.some(x=>x.length<2)){toast("Product category names must be at least 2 characters");return}
    if(new Set(productCategoryNames.map(x=>x.toLowerCase())).size!==productCategoryNames.length){toast("Product category names must be unique");return}
    for(const cat of (data.productCategories||[])){
      const subs=(cat.subcategories||[]).map(x=>String(x.name||"").trim());
      if(subs.some(x=>x.length<2)){toast("Sub category names must be at least 2 characters");return}
      if(new Set(subs.map(x=>x.toLowerCase())).size!==subs.length){toast("Sub category names must be unique within each category");return}
    }
    const categoryNames=(data.promotionCategories||[]).map(x=>String(x.name||"").trim());
    if(categoryNames.some(x=>x.length<2)){toast("Promotion category names must be at least 2 characters");return}
    const lowered=categoryNames.map(x=>x.toLowerCase());
    if(new Set(lowered).size!==lowered.length){toast("Promotion category names must be unique");return}
    (data.promotionCategories||[]).forEach((cat,i)=>{cat.name=categoryNames[i]});
    (data.promotions||[]).forEach(pr=>{
      const cat=(data.promotionCategories||[]).find(x=>x.id===pr.categoryId);
      if(cat)pr.label=cat.name;
    });
    $("#saveBtn").disabled=true;
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
    if(e.target.closest(".admin-section[data-admin-section='content']")&&hasPermission("site_content_manage"))mark();
    if(e.target.closest(".admin-section[data-admin-section='contact']")&&hasPermission("contact_manage"))mark();
    if(e.target.dataset.promoCatName!==undefined&&hasPermission("promotions_manage")){
      const i=Number(e.target.dataset.promoCatName),cat=data.promotionCategories?.[i];
      if(!cat)return;
      const next=e.target.value;cat.name=next;
      data.promotions.forEach(pr=>{if(pr.categoryId===cat.id)pr.label=next});
      mark();
    }
    if(e.target.dataset.categoryName!==undefined&&hasPermission("categories_manage")){
      const i=Number(e.target.dataset.categoryName),cat=data.productCategories?.[i];if(!cat)return;
      cat.name=e.target.value;
      data.products.forEach(p=>{if(p.categoryId===cat.id)p.category=e.target.value});
      mark();
    }
    if(e.target.dataset.subcategoryIndex!==undefined&&hasPermission("categories_manage")){
      const ci=Number(e.target.dataset.categoryIndex),si=Number(e.target.dataset.subcategoryIndex);
      const cat=data.productCategories?.[ci],sub=cat?.subcategories?.[si];if(!sub)return;
      sub.name=e.target.value;
      data.products.forEach(p=>{if(p.categoryId===cat.id&&p.subcategoryId===sub.id)p.subcategory=e.target.value});
      mark();
    }
  });
  document.addEventListener("click",async e=>{
    if(!data)return;
    const tab=e.target.closest("[data-admin-tab]");
    if(tab&&!tab.hidden){
      $$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===tab));
      $$("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection===tab.dataset.adminTab));
      if(tab.dataset.adminTab==="orders"&&hasPermission("orders_view"))loadOrders();
    }

    const dt=e.target.closest("[data-del-tab]");
    if(dt&&hasPermission("site_content_manage")){data.tabs.splice(Number(dt.dataset.delTab),1);renderTabs();mark()}

    const ep=e.target.closest("[data-edit-product]");
    if(ep&&hasPermission("products_edit"))loadProductForm(Number(ep.dataset.editProduct));

    const dp=e.target.closest("[data-del-product]");
    if(dp&&hasPermission("products_delete")){
      const i=Number(dp.dataset.delProduct),p=data.products[i];if(!p)return;
      if(!confirm('Remove "'+p.name+'" from the storefront?'))return;
      try{
        const result=await rpc("ganduvaru_admin_product_action",{p_token:sessionToken,p_action:"delete",p_product_id:p.id,p_product:null});
        if(!result?.ok)throw new Error(result?.message||"Could not remove product");
        await loadCatalog();clearProductForm();renderAll();toast("Product removed");
      }catch(err){toast(err.message||"Could not remove product")}
    }

    const dc=e.target.closest("[data-del-category]");
    if(dc&&hasPermission("categories_manage")){
      const i=Number(dc.dataset.delCategory),cat=data.productCategories?.[i];if(!cat)return;
      const used=data.products.filter(p=>p.categoryId===cat.id).length;
      if(used)return toast("Move or remove the "+used+" product"+(used===1?"":"s")+" in this category first");
      data.productCategories.splice(i,1);renderCategories();mark();
    }

    const asc=e.target.closest("[data-add-subcategory]");
    if(asc&&hasPermission("categories_manage")){
      const ci=Number(asc.dataset.addSubcategory),cat=data.productCategories?.[ci],input=$('[data-new-subcategory="'+ci+'"]');
      const name=input?.value.trim();if(!cat||!name)return toast("Enter a sub category name");
      if(cat.subcategories.some(x=>String(x.name).toLowerCase()===name.toLowerCase()))return toast("Sub category already exists");
      cat.subcategories.push({id:"sub-"+slug(name),name});if(input)input.value="";renderCategories();mark();
    }

    const dsc=e.target.closest("[data-del-subcategory]");
    if(dsc&&hasPermission("categories_manage")){
      const [ci,si]=dsc.dataset.delSubcategory.split(":").map(Number),cat=data.productCategories?.[ci],sub=cat?.subcategories?.[si];if(!sub)return;
      const used=data.products.filter(p=>p.categoryId===cat.id&&p.subcategoryId===sub.id).length;
      if(used)return toast("Move "+used+" product"+(used===1?"":"s")+" out of this sub category first");
      cat.subcategories.splice(si,1);renderCategories();mark();
    }

    const dpc=e.target.closest("[data-del-promo-cat]");
    if(dpc&&hasPermission("promotions_manage")){
      const i=Number(dpc.dataset.delPromoCat),cat=data.promotionCategories?.[i];if(!cat)return;
      const used=data.promotions.filter(pr=>pr.categoryId===cat.id).length;
      if(used&&!confirm('Remove "'+cat.name+'" and its '+used+' promotion item'+(used===1?'':'s')+'?'))return;
      data.promotions=data.promotions.filter(pr=>pr.categoryId!==cat.id);
      data.promotionCategories.splice(i,1);renderPromotions();mark();
    }
    const dpr=e.target.closest("[data-del-promo]");
    if(dpr&&hasPermission("promotions_manage")){data.promotions.splice(Number(dpr.dataset.delPromo),1);renderPromotions();mark()}

    const ta=e.target.closest("[data-toggle-admin]");if(ta&&adminRole==="super_admin")toggleAdmin(Number(ta.dataset.toggleAdmin),ta.dataset.next==="true");
    const ra=e.target.closest("[data-reset-admin]");if(ra&&adminRole==="super_admin")resetAdminPassword(Number(ra.dataset.resetAdmin));
    const sap=e.target.closest("[data-save-admin-permissions]");if(sap&&adminRole==="super_admin")saveAdminPermissions(Number(sap.dataset.saveAdminPermissions));
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
    const categoryId=$("#pCategoryId").value;
    const cat=categoryById(categoryId);
    if(!cat){toast("Select a product category");return null}
    const subcategoryId=$("#pSubcategoryId").value||"";
    const sub=subcategoryById(cat,subcategoryId);
    const raw=$("#pPrice").value.trim();
    const images=[...new Set($("#pImages").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
    const availability=$("#pAvailability").value==="out_of_stock"?"out_of_stock":"in_stock";
    return {
      id:existingId||slug(n),name:n,
      categoryId:cat.id,category:cat.name,
      subcategoryId:sub?.id||"",subcategory:sub?.name||"",
      price:raw===""?null:Number(raw),
      badge:$("#pBadge").value.trim(),
      description:$("#pDescription").value.trim(),
      image:images[0]||"",images,
      featured:$("#pFeatured").checked,
      availability,
      stock:availability==="out_of_stock"?"Out of Stock":"In Stock"
    };
  }

  function clearProductForm(){
    editingProductIndex=-1;
    ["pName","pPrice","pBadge","pDescription","pImages"].forEach(id=>$("#"+id).value="");
    $("#pFeatured").checked=false;
    $("#pAvailability").value="in_stock";
    if($("#pCategoryId").options.length)$("#pCategoryId").selectedIndex=0;
    renderSubcategorySelect();
    $("#addProductBtn").textContent="Add product";
    $("#cancelProductEditBtn").hidden=true;
  }

  function loadProductForm(i){
    const p=data.products[i];if(!p)return;editingProductIndex=i;
    $("#pName").value=p.name||"";
    $("#pCategoryId").value=p.categoryId||"";
    renderSubcategorySelect(p.subcategoryId||"");
    $("#pPrice").value=p.price==null?"":p.price;
    $("#pBadge").value=p.badge||"";
    $("#pAvailability").value=p.availability==="out_of_stock"?"out_of_stock":"in_stock";
    $("#pDescription").value=p.description||"";
    $("#pImages").value=productImages(p).join("\n");
    $("#pFeatured").checked=!!p.featured;
    $("#addProductBtn").textContent="Update product";
    $("#cancelProductEditBtn").hidden=false;
    $("#pName").focus();
    window.scrollTo({top:document.querySelector("[data-admin-section='products']").offsetTop-70,behavior:"smooth"});
  }

  $("#pCategoryId").addEventListener("change",()=>renderSubcategorySelect());
  $("#adminProductCategoryFilter").addEventListener("change",renderProducts);
  $("#cancelProductEditBtn").onclick=clearProductForm;

  $("#addProductBtn").onclick=async()=>{
    const editing=editingProductIndex>=0;
    if(editing&&!hasPermission("products_edit"))return toast("You do not have permission to edit products");
    if(!editing&&!hasPermission("products_add"))return toast("You do not have permission to add products");
    const existing=editing?data.products[editingProductIndex]?.id:"";
    const product=readProductForm(existing);if(!product)return;
    $("#addProductBtn").disabled=true;
    try{
      const result=editing
        ? await rpc("ganduvaru_admin_product_action",{p_token:sessionToken,p_action:"edit",p_product_id:existing,p_product:product})
        : await rpc("ganduvaru_admin_add_product",{p_token:sessionToken,p_product:product});
      if(!result?.ok)throw new Error(result?.message||"Could not save product");
      await loadCatalog();clearProductForm();renderAll();toast(editing?"Product updated":"Product published successfully");
    }catch(e){toast(e.message||"Could not save product")}
    finally{$("#addProductBtn").disabled=false}
  };

  $("#addCategoryBtn").onclick=()=>{
    if(!hasPermission("categories_manage"))return;
    const name=$("#newCategoryName").value.trim();
    if(name.length<2)return toast("Enter a category name");
    if(data.productCategories.some(x=>String(x.name).toLowerCase()===name.toLowerCase()))return toast("Category already exists");
    data.productCategories.push({id:"cat-"+slug(name),name,subcategories:[]});
    $("#newCategoryName").value="";renderCategories();mark();toast("Category added — publish changes to go live");
  };
  $("#newCategoryName").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#addCategoryBtn").click()}});

  $("#addPromoCategoryBtn").onclick=()=>{
    if(!hasPermission("promotions_manage"))return;
    const name=$("#promoCategoryName").value.trim();
    if(name.length<2)return toast("Enter a promotion category name");
    if(data.promotionCategories.some(x=>String(x.name).toLowerCase()===name.toLowerCase()))return toast("This promotion category already exists");
    data.promotionCategories.push({id:"promo-"+slug(name),name});
    $("#promoCategoryName").value="";
    renderPromotions();mark();toast("Promotion category added");
  };
  $("#promoCategoryName").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#addPromoCategoryBtn").click()}});
  $("#addPromoBtn").onclick=()=>{
    if(!hasPermission("promotions_manage"))return;
    const id=$("#promoProduct").value,categoryId=$("#promoCategorySelect").value;
    if(!id)return toast("Select a product");
    if(!categoryId)return toast("Create and select a promotion category");
    if(data.promotions.some(x=>x.productId===id&&x.categoryId===categoryId))return toast("This product is already in that promotion category");
    const cat=data.promotionCategories.find(x=>x.id===categoryId);
    data.promotions.unshift({productId:id,categoryId,label:cat?.name||"Promotion"});
    renderPromotions();mark();toast("Product added to promotion category");
  };

  $("#refreshOrdersBtn").onclick=loadOrders;

  async function createAdmin(){
    const username=$("#newAdminUsername").value.trim(),password=$("#newAdminPassword").value;
    const permissions=$$("#newAdminPermissions input:checked").map(x=>x.value);
    if(!username||password.length<8)return toast("Enter a username and password of at least 8 characters");
    if(!permissions.length)return toast("Select at least one access permission");
    $("#createAdminBtn").disabled=true;
    try{
      const result=await rpc("ganduvaru_admin_create_user_v2",{p_token:sessionToken,p_username:username,p_password:password,p_permissions:permissions});
      if(!result?.ok)throw new Error(result?.message||"Could not create admin");
      $("#newAdminUsername").value="";$("#newAdminPassword").value="";
      $$("#newAdminPermissions input").forEach(x=>x.checked=x.value==="products_add");
      await loadAdminUsers();toast("Admin created with selected access");
    }catch(e){toast(e.message||"Could not create admin")}
    finally{$("#createAdminBtn").disabled=false}
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
        adminRole=me.role;adminUsername=me.username;adminPermissions=Array.isArray(me.permissions)?me.permissions:[];
        sessionStorage.setItem("ganduvaru_admin_role",adminRole);sessionStorage.setItem("ganduvaru_admin_username",adminUsername);sessionStorage.setItem("ganduvaru_admin_permissions",JSON.stringify(adminPermissions));
        await loadCatalog();showAdmin();
      }catch(e){
        ["ganduvaru_admin_session","ganduvaru_admin_role","ganduvaru_admin_username","ganduvaru_admin_permissions"].forEach(k=>sessionStorage.removeItem(k));
        sessionToken="";adminRole="";adminUsername="";adminPermissions=[];showLogin()
      }
    }
  })();
})();