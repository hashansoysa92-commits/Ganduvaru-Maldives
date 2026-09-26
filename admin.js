(() => {
  const CFG=window.GANDUVARU_CONFIG.github, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let token="", data=null, fileSha="", dirty=false;
  const api="https://api.github.com/repos/"+CFG.owner+"/"+CFG.repo+"/contents/"+CFG.catalogPath;
  function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2300)}
  function mark(){dirty=true;$("#changeStatus").textContent="Unsaved changes.";$("#changeStatus").style.color="#f0d89c"}
  function clean(){dirty=false;$("#changeStatus").textContent="All changes published.";$("#changeStatus").style.color="#93d9ad"}
  function slug(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")+"-"+Date.now().toString(36)}
  async function gh(url,opt={}){const r=await fetch(url,{...opt,headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28",...(opt.headers||{})}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||"GitHub request failed");return r.json()}
  function decode(s){return decodeURIComponent(escape(atob(s.replace(/\n/g,""))))}
  function encode(s){return btoa(unescape(encodeURIComponent(s)))}
  async function login(){
    token=$("#tokenInput").value.trim();if(!token){toast("Enter a GitHub token");return}
    try{const f=await gh(api+"?ref="+CFG.branch);fileSha=f.sha;data=JSON.parse(decode(f.content));sessionStorage.setItem("ganduvaru_admin_token",token);$("#loginBox").hidden=true;$("#adminApp").hidden=false;renderAll();toast("Admin connected")}
    catch(e){toast(e.message)}
  }
  function renderAll(){
    $("#siteAnnouncement").value=data.site.announcement||"";$("#siteHeroTitle").value=data.site.heroTitle||"";$("#siteHeroSubtitle").value=data.site.heroSubtitle||"";$("#siteAboutTitle").value=data.site.aboutTitle||"";$("#siteAboutText").value=data.site.aboutText||"";$("#siteOrderWhatsApp").value=data.site.orderWhatsApp||"";
    $("#pStore").innerHTML=data.stores.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join("");
    renderTabs();renderProducts();renderStores();
  }
  function renderTabs(){$("#tabsList").innerHTML=data.tabs.map((t,i)=>'<div class="admin-row"><div><strong>'+t.label+'</strong><small>'+t.href+'</small></div><button class="danger-btn" data-del-tab="'+i+'">Remove</button></div>').join("")}
  function renderProducts(){$("#productsList").innerHTML=data.products.map((p,i)=>'<div class="admin-row"><div><strong>'+p.name+'</strong><small>'+p.category+' · '+(p.price==null?"Ask for price":"MVR "+p.price)+'</small></div><button class="danger-btn" data-del-product="'+i+'">Remove</button></div>').join("")}
  function renderStores(){
    $("#storesList").innerHTML=data.stores.map((s,i)=>'<div class="admin-row" style="display:block"><strong>'+s.name+'</strong><div class="form-grid" style="margin-top:10px">'+
      '<label>Name<input data-store-field="'+i+':name" value="'+esc(s.name)+'"></label>'+
      '<label>Phone<input data-store-field="'+i+':phone" value="'+esc(s.phone||"")+'"></label>'+
      '<label>WhatsApp<input data-store-field="'+i+':whatsapp" value="'+esc(s.whatsapp||"")+'"></label>'+
      '<label>Email<input data-store-field="'+i+':email" value="'+esc(s.email||"")+'"></label>'+
      '<label class="span-2">Address<input data-store-field="'+i+':address" value="'+esc(s.address||"")+'"></label>'+
      '<label class="span-2">Summary<textarea rows="2" data-store-field="'+i+':summary">'+esc(s.summary||"")+'</textarea></label>'+
      '<label class="span-2">Facebook<input data-store-field="'+i+':facebook" value="'+esc(s.facebook||"")+'"></label></div></div>').join("")
  }
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
  function syncContent(){data.site.announcement=$("#siteAnnouncement").value;data.site.heroTitle=$("#siteHeroTitle").value;data.site.heroSubtitle=$("#siteHeroSubtitle").value;data.site.aboutTitle=$("#siteAboutTitle").value;data.site.aboutText=$("#siteAboutText").value;data.site.orderWhatsApp=$("#siteOrderWhatsApp").value}
  async function save(){
    syncContent();
    try{
      const body={message:"Update storefront content from Ganduvaru Admin",content:encode(JSON.stringify(data,null,2)),sha:fileSha,branch:CFG.branch};
      const r=await gh(api,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});fileSha=r.content.sha;clean();toast("Published to GitHub")}
    catch(e){toast(e.message)}
  }
  document.addEventListener("input",e=>{
    if(!data)return;
    if(e.target.closest(".admin-section[data-admin-section='content']"))mark();
    if(e.target.dataset.storeField){const [i,k]=e.target.dataset.storeField.split(":");data.stores[Number(i)][k]=e.target.value;mark()}
  });
  document.addEventListener("click",e=>{
    const tab=e.target.closest("[data-admin-tab]");if(tab){$$("[data-admin-tab]").forEach(x=>x.classList.toggle("active",x===tab));$$("[data-admin-section]").forEach(x=>x.classList.toggle("active",x.dataset.adminSection===tab.dataset.adminTab))}
    const dt=e.target.closest("[data-del-tab]");if(dt){data.tabs.splice(Number(dt.dataset.delTab),1);renderTabs();mark()}
    const dp=e.target.closest("[data-del-product]");if(dp){data.products.splice(Number(dp.dataset.delProduct),1);renderProducts();mark()}
  });
  $("#loginBtn").onclick=login;
  $("#addTabBtn").onclick=()=>{const l=$("#tabLabel").value.trim(),h=$("#tabHref").value.trim();if(!l||!h)return toast("Enter label and link");data.tabs.push({label:l,href:h});$("#tabLabel").value="";$("#tabHref").value="";renderTabs();mark()};
  $("#addProductBtn").onclick=()=>{const n=$("#pName").value.trim();if(!n)return toast("Enter product name");const raw=$("#pPrice").value.trim();data.products.unshift({id:slug(n),name:n,store:$("#pStore").value,category:$("#pCategory").value.trim()||"Other",price:raw===""?null:Number(raw),badge:$("#pBadge").value.trim(),description:$("#pDescription").value.trim(),image:$("#pImage").value.trim(),featured:$("#pFeatured").checked,stock:$("#pStock").value.trim()||"Ask for stock"});["pName","pCategory","pPrice","pBadge","pDescription","pImage","pStock"].forEach(id=>$("#"+id).value="");$("#pFeatured").checked=false;renderProducts();mark();toast("Product added")};
  $("#saveBtn").onclick=save;
  const saved=sessionStorage.getItem("ganduvaru_admin_token");if(saved){$("#tokenInput").value=saved;login()}
})();