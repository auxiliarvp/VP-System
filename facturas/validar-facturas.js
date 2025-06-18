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

  document.getElementById('saveValidateBtn').onclick = saveAndValidate;
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
 * Listener de facturas pendientes
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

      /* ─ Convierte lo que venga en invoices a un array ─ */
      let invoicesArr = [];
      if(Array.isArray(o.invoices))               invoicesArr = o.invoices;
      else if(o.invoices && typeof o.invoices==='object')
        invoicesArr = Object.values(o.invoices);

      invoicesArr.forEach((inv,i)=>{
        if(inv.validated) return;

        if(invSearch && !String(inv.invoiceNumber).includes(invSearch)) return;
        if(ordSearch && !String(o.orderId).includes(ordSearch))        return;

        rows.push({orderId:d.id, order:o, idx:i, inv});
      });
    });

    renderRows(rows);
  },err=>Swal.fire({icon:'error',title:'Error',text:err.message}));
}

/**********************************************************
 * Render tabla
 **********************************************************/
function renderRows(rows){
  const tbody=document.getElementById('pendingBody');
  tbody.innerHTML='';

  if(rows.length===0){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#6c757d;">Sin facturas pendientes…</td></tr>';
    return;
  }

  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${r.inv.invoiceNumber}</td>
      <td>${r.inv.invoiceDate}</td>
      <td>${r.order.providerName}</td>
      <td>${r.order.sucursalName}</td>
      <td>${r.order.orderId}</td>
      <td>${r.order.invoiceTotal??'—'}</td>
      <td>
        <button class="table-btn edit" data-o="${r.orderId}" data-i="${r.idx}">Validar</button>
        <button class="table-btn view" data-o="${r.orderId}" data-i="${r.idx}">Ver</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/**********************************************************
 * Delegación de clics
 **********************************************************/
document.getElementById('pendingBody').addEventListener('click', e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const orderId = btn.dataset.o;
  const idx     = Number(btn.dataset.i);

  if(btn.classList.contains('view')) return openDetail(orderId,idx);
  if(btn.classList.contains('edit')) return openEdit(orderId,idx);
});

/**********************************************************
 * MODAL – VER
 **********************************************************/
async function openDetail(orderId,idx){
  const doc=await db.collection('orders').doc(orderId).get();
  if(!doc.exists) return;
  const order=doc.data();
  const invArr = Array.isArray(order.invoices) ? order.invoices : Object.values(order.invoices||{});
  const inv  = invArr[idx];

  document.getElementById('detailContent').innerHTML=`
    <p><strong>N° Factura:</strong> ${inv.invoiceNumber}</p>
    <p><strong>Fecha:</strong> ${inv.invoiceDate}</p>
    <p><strong>Proveedor:</strong> ${order.providerName}</p>
    <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
    <p><strong>ID Pedido:</strong> ${order.orderId}</p>
    <p><strong>Total factura (pedido):</strong> Q${order.invoiceTotal??'—'}</p>
  `;
  document.getElementById('detailModal').style.display='block';
}
function closeModal(){ document.getElementById('detailModal').style.display='none'; }

/**********************************************************
 * MODAL – EDITAR Y VALIDAR
 **********************************************************/
async function openEdit(orderId,idx){
  const doc=await db.collection('orders').doc(orderId).get();
  if(!doc.exists) return;

  const invArr = Array.isArray(doc.data().invoices)
                ? doc.data().invoices
                : Object.values(doc.data().invoices||{});
  const inv = invArr[idx];

  document.getElementById('editOrderId').value = orderId;
  document.getElementById('editIdx').value     = idx;

  document.getElementById('editNumber').value  = inv.invoiceNumber;
  document.getElementById('editDate').value    = inv.invoiceDate;
  document.getElementById('editTotal').value   = doc.data().invoiceTotal || '';

  document.getElementById('editModal').style.display='block';
}
function closeEditModal(){ document.getElementById('editModal').style.display='none'; }

/* Guardar cambios y marcar como validada */
async function saveAndValidate(){
  const orderId = document.getElementById('editOrderId').value;
  const idx     = Number(document.getElementById('editIdx').value);
  const newNum  = document.getElementById('editNumber').value.trim();
  const newDate = document.getElementById('editDate').value;
  const newTot  = parseFloat(document.getElementById('editTotal').value) || 0;

  if(!newNum || !newDate){
    Swal.fire({icon:'warning',title:'Campos obligatorios'}); return;
  }

  try{
    await db.collection('orders').doc(orderId).update({
      [`invoices.${idx}.invoiceNumber`] : newNum,
      [`invoices.${idx}.invoiceDate`]   : newDate,
      invoiceTotal                      : newTot,
      [`invoices.${idx}.validated`]     : true,
      [`invoices.${idx}.validatedBy`]   : loggedUser,
      [`invoices.${idx}.validatedAt`]   : firebase.firestore.FieldValue.serverTimestamp()
    });
    Swal.fire({icon:'success',title:'Factura validada'});
    closeEditModal();
  }catch(err){
    Swal.fire({icon:'error',title:'Error',text:err.message});
  }
}

/**********************************************************
 * helper debounce
 **********************************************************/
function debounce(fn,ms){
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); };
}
