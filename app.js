const $=s=>document.querySelector(s);
let isAdmin=false, categories=[];

async function api(url,opt={}){const r=await fetch(url,opt);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Request failed");return d}

async function init(){
  const s=await api("/api/session"); isAdmin=s.admin;
  categories=await api("/api/categories");
  renderCats(); await load();
  $("#adminBtn").textContent=isAdmin?"Admin Panel":"Admin Login";
}
function renderCats(){
  $("#category").innerHTML='<option value="">All Categories</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
async function load(){
  const q=$("#search").value.trim(), category=$("#category").value;
  const [orders,stats]=await Promise.all([api(`/api/orders?q=${encodeURIComponent(q)}&category=${category}`),api("/api/stats")]);
  $("#total").textContent=stats.total;
  $("#cards").innerHTML=orders.length?orders.map(o=>`
    <article class="card">
      <span class="tag">${esc(o.category)}</span>
      <h3>${esc(o.title)}</h3>
      <div class="meta"><b>Order No:</b> ${esc(o.order_no||"—")}<br><b>Date:</b> ${esc(o.order_date||"—")}<br><b>File:</b> ${esc(o.original_name)}</div>
      ${o.description?`<p class="meta">${esc(o.description)}</p>`:""}
      <div class="actions">
        <a class="btn" href="/api/file/${o.id}" target="_blank">View PDF</a>
        <a class="btn" href="/api/download/${o.id}">Download</a>
        ${isAdmin?`<button class="btn danger" onclick="delOrder(${o.id})">Delete</button>`:""}
      </div>
    </article>`).join(""):`<div class="card"><b>No documents found.</b><p class="meta">Try another category or keyword.</p></div>`;
}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

$("#search").addEventListener("input",load);
$("#category").addEventListener("change",load);

$("#adminBtn").onclick=async()=>{
  if(isAdmin){showAdmin();return}
  openModal(`<h2>Admin Login</h2><form class="form" id="loginForm">
    <input name="username" placeholder="Username" required>
    <input name="password" type="password" placeholder="Password" required>
    <button>Login</button></form>`);
  $("#loginForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});isAdmin=true;closeModal();$("#adminBtn").textContent="Admin Panel";await load()}catch(x){alert(x.message)}}
};

function showAdmin(){
 openModal(`<h2>Admin Panel</h2>
 <form class="form" id="uploadForm" enctype="multipart/form-data">
 <input name="title" placeholder="Order / Notification Title" required>
 <input name="order_no" placeholder="Order No. / Memo No.">
 <input name="order_date" type="date">
 <select name="category_id" required>${categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
 <textarea name="description" placeholder="Short description / purpose"></textarea>
 <input name="pdf" type="file" accept="application/pdf" required>
 <button>Upload PDF</button></form>
 <hr>
 <form class="form" id="catForm"><input name="name" placeholder="New category name" required><button>Add Category</button></form>
 <hr><button class="btn" id="logout">Logout</button>`);
 $("#uploadForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/orders",{method:"POST",body:new FormData(e.target)});alert("PDF uploaded successfully");closeModal();await init()}catch(x){alert(x.message)}};
 $("#catForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});alert("Category added");await init();showAdmin()}catch(x){alert(x.message)}};
 $("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});isAdmin=false;closeModal();$("#adminBtn").textContent="Admin Login";await load()};
}
async function delOrder(id){if(!confirm("Delete this document?"))return;try{await api("/api/orders/"+id,{method:"DELETE"});await load()}catch(x){alert(x.message)}}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
init();
