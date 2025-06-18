/**********************************************************
 * VARIABLES GLOBALES
 **********************************************************/
let loggedUser   = null;
let userRole     = null;
let userSucursal = null;
let unsubscribe  = null;

/**********************************************************
 * INICIO
 **********************************************************/
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await initUser();
  attachListener();

  document.getElementById('reloadBtn').onclick  = attachListener;
  document.getElementById('invoiceSearch').oninput =
  document.getElementById('orderSearch').oninput   = debounce(attachListener, 350);
}

/**********************************************************
 * Datos usuario
 **********************************************************/
async function initUser() {
  loggedUser = localStorage.getItem('usuarioLogueado');
  if(!loggedUser){
    await Swal.fire({icon:'warning',title:'Sesión terminada'});
    location.href='login.html'; return;
  }
  const snap = await db.collection('usuarios')
                       .where('username','==',loggedUser)
                       .limit(1).get();
  if(snap.empty){ location.href='login.html'; return; }
  const data = snap.docs[0].data();
  userRole     = data.rol;
  userSucursal = data.sucursalId;
}

/**********************************************************
 * Listener de facturas validadas
 **********************************************************/
function attachListener(){
  if(unsubscribe) unsubscribe();

  let q = db.collection('orders');
  if(userRole!=='administrador'){ q = q.where('sucursalId','==',userSucursal); }
  q = q.orderBy('timestamp','desc');

  unsubscribe = q.onSnapshot(ss=>{
    const rows=[];
    const invSearch = document.getElementById('invoiceSearch').value.trim();
    const ordSearch = document.getElementById('orderSearch').value.trim();

    ss.forEach(d=>{
      const o = d.data();

      let invoicesArr=[];
      if(Array.isArray(o.invoices)) invoicesArr=o.invoices;
      else if(o.invoices && typeof o.invoices==='object')
        invoicesArr=Object.values(o.invoices);

      invoicesArr.forEach((inv,i)=>{
        if(!inv.validated) return;

        if(invSearch && !String(inv.invoiceNumber).includes(invSearch)) return;
        if(ordSearch && !String(o.orderId).includes(ordSearch))        return;

        rows.push({orderId:d.id, order:o, idx:i, inv});
      });
    });

    renderRows(rows);
  },err=>Swal.fire({icon:'error',title:'Error',text:err.message}));
}

/**********************************************************
 * Renderiza tabla
 **********************************************************/
function renderRows(rows){
  const tbody=document.getElementById('validatedBody');
  tbody.innerHTML='';

  if(rows.length===0){
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:#6c757d;">Sin facturas validadas…</td></tr>';
    return;
  }

  rows.forEach(r=>{
    const valDate = r.inv.validatedAt ? new Date(r.inv.validatedAt.toDate()).toLocaleString() : '—';

    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${r.inv.invoiceNumber}</td>
      <td>${r.inv.invoiceDate}</td>
      <td>${r.order.providerName}</td>
      <td>${r.order.sucursalName}</td>
      <td>${r.order.orderId}</td>
      <td>${r.order.invoiceTotal??'—'}</td>
      <td>${r.inv.validatedBy??'—'}</td>
      <td>${valDate}</td>
      <td><button class="table-btn view" data-o="${r.orderId}" data-i="${r.idx}">Ver</button></td>`;
    tbody.appendChild(tr);
  });
}

/**********************************************************
 * Delegación para ver detalle
 **********************************************************/
document.getElementById('validatedBody').addEventListener('click', async e=>{
  if(!e.target.classList.contains('view')) return;
  openDetail(e.target.dataset.o, Number(e.target.dataset.i));
});

/**********************************************************
 * Modal detalle
 **********************************************************/
async function openDetail(orderId,idx){
  const doc=await db.collection('orders').doc(orderId).get();
  if(!doc.exists) return;
  const order=doc.data();

  const invoicesArr = Array.isArray(order.invoices)
    ? order.invoices
    : Object.values(order.invoices||{});
  const inv = invoicesArr[idx];

  const valDate = inv.validatedAt ? new Date(inv.validatedAt.toDate()).toLocaleString() : '—';

  document.getElementById('detailContent').innerHTML=`
    <p><strong>N° Factura:</strong> ${inv.invoiceNumber}</p>
    <p><strong>Fecha:</strong> ${inv.invoiceDate}</p>
    <p><strong>Proveedor:</strong> ${order.providerName}</p>
    <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
    <p><strong>ID Pedido:</strong> ${order.orderId}</p>
    <p><strong>Total factura (pedido):</strong> Q${order.invoiceTotal??'—'}</p>
    <p><strong>Validado por:</strong> ${inv.validatedBy??'—'}</p>
    <p><strong>Fecha validación:</strong> ${valDate}</p>`;
  document.getElementById('detailModal').style.display='block';
}
function closeModal(){ document.getElementById('detailModal').style.display='none'; }

/**********************************************************
 * helper
 **********************************************************/
function debounce(fn,ms){
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); };
}
