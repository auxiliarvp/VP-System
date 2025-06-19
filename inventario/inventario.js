/* ===============================================================
   inventario.js – 20-Jun-2025
   Modificado: precarga en editar proveedor; labels en español; 
   modales centrados y fijos (display:flex + align/justify)
   =============================================================== */
const $ = s => document.querySelector(s);

/* ------------------ Selección de filas (única y toggling) ------------------ */
function getSelIds(tableSel) {
  return [...document.querySelectorAll(`${tableSel} tbody tr.selected`)]
    .map(tr => tr.dataset.id);
}

function toggleBtns(tableSel, viewBtn, editBtn, delBtn) {
  const n = getSelIds(tableSel).length;
  $(viewBtn).disabled = $(editBtn).disabled = !(n === 1);
  $(delBtn).disabled = (n === 0);
}

function makeRowsSelectable(tableSel, viewBtn, editBtn, delBtn) {
  const tbl = document.querySelector(tableSel);
  tbl.querySelector('tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const already = tr.classList.contains('selected');
    tbl.querySelectorAll('tbody tr.selected').forEach(row =>
      row.classList.remove('selected')
    );
    if (!already) tr.classList.add('selected');
    toggleBtns(tableSel, viewBtn, editBtn, delBtn);
  });
}

/* ------------------ Auditoría ------------------ */
const audit = (act, col, id, data = {}) =>
  db.collection('auditLog').add({
    user: firebase.auth().currentUser?.email || 'anon',
    act, col, id, data,
    at: firebase.firestore.FieldValue.serverTimestamp()
  });

/* ------------- Helpers de validación ------------- */
function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}
function isValidPhone(tel) {
  return /^\d{7,}$/.test(tel);
}

/* ==================  PROVEEDORES  ================ */
async function loadProviders() {
  const snap = await db.collection('providers').orderBy('name').get();
  const tb = $('#providersTable tbody');
  tb.innerHTML = '';
  snap.forEach(d => {
    const r = tb.insertRow();
    r.dataset.id = d.id;
    r.insertCell().textContent = d.data().name;
  });
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function showAddProviderForm() {
  showModal('addProviderModal');
}

async function addProvider() {
  const name  = $('#providerName')?.value.trim() || '';
  const email = $('#providerEmail')?.value.trim() || '';
  const phone = $('#providerPhone')?.value.trim() || '';

  if (!name) {
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  }
  if (email && !isValidEmail(email)) {
    return Swal.fire({ icon:'error', title:'Error', text:'Formato de email inválido.' });
  }
  if (phone && !isValidPhone(phone)) {
    return Swal.fire({ icon:'error', title:'Error', text:'El teléfono debe tener al menos 7 dígitos.' });
  }

  const { isConfirmed } = await Swal.fire({
    title: '¿Deseas guardar este proveedor?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  });
  if (!isConfirmed) return;

  const fields = [
    'providerAddress','providerPaymentTerms','sellerName','sellerPhone',
    'chiefSellerName','chiefSellerPhone','creditPersonName','creditPersonPhone',
    'providerType','preferredPaymentMethod'
  ];
  const data = Object.fromEntries(fields.map(f => [f, $('#'+f)?.value.trim() || '']));
  Object.assign(data, {
    name,
    email,
    phone,
    additionalNotes: $('#additionalNotes')?.value.trim() || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  try {
    const ref = await db.collection('providers').add(data);
    audit('create','providers',ref.id,{name});
    Swal.fire({ icon:'success', title:'Proveedor guardado', timer:1500, showConfirmButton:false });
    closeModal('addProviderModal');
    loadProviders();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar. Intenta de nuevo.' });
  }
}

async function viewSelectedProvider() {
  const sel = getSelIds('#providersTable');
  if (sel.length !== 1) {
    return Swal.fire({
      icon:'warning',
      title:'Atención',
      text: sel.length === 0 ? 'Debes seleccionar un proveedor.' : 'Solo puedes ver uno a la vez.'
    });
  }
  showProviderDetails(sel[0]);
}

async function showProviderDetails(id) {
  const ul = document.getElementById('providerDetailsList');
  if (!ul) {
    console.error('showProviderDetails: elemento #providerDetailsList no encontrado');
    return;
  }
  try {
    const doc = await db.collection('providers').doc(id).get();
    if (!doc.exists) return;
    const data = doc.data();

    const labels = {
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      providerAddress: 'Dirección',
      providerPaymentTerms: 'Términos de pago',
      sellerName: 'Vendedor',
      sellerPhone: 'Tel. Vendedor',
      chiefSellerName: 'Jefe de Ventas',
      chiefSellerPhone: 'Tel. Jefe Ventas',
      creditPersonName: 'Contacto Créditos',
      creditPersonPhone: 'Tel. Créditos',
      providerType: 'Tipo',
      preferredPaymentMethod: 'Método de pago',
      additionalNotes: 'Notas',
      createdAt: 'Creado'
    };

    ul.innerHTML = '';
    for (const key of Object.keys(labels)) {
      const label = labels[key];
      let val = data[key];
      if (key === 'createdAt' && val && val.toDate) {
        val = val.toDate().toLocaleString('es-ES');
      }
      if (!val) val = '—';
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between';
      li.innerHTML = `<strong>${label}</strong><span>${val}</span>`;
      ul.appendChild(li);
    }

    showModal('viewProviderModal');
  } catch (err) {
    console.error('Error en showProviderDetails:', err);
  }
}

async function editSelectedProvider() {
  const sel = getSelIds('#providersTable');
  if (sel.length !== 1) {
    return Swal.fire({
      icon:'warning',
      title:'Atención',
      text: sel.length === 0 ? 'Debes seleccionar un proveedor.' : 'Solo puedes editar uno a la vez.'
    });
  }
  showEditProviderForm(sel[0]);
}

async function showEditProviderForm(id) {
  const d = await db.collection('providers').doc(id).get();
  if (!d.exists) return;
  const data = d.data();

  $('#editProviderId').value               = id;
  $('#editProviderName').value             = data.name || '';
  $('#editProviderAddress').value          = data.providerAddress || '';
  $('#editProviderPhone').value            = data.phone || '';
  $('#editProviderEmail').value            = data.email || '';
  $('#editProviderPaymentTerms').value     = data.providerPaymentTerms || '';
  $('#editSellerName').value               = data.sellerName || '';
  $('#editSellerPhone').value              = data.sellerPhone || '';
  $('#editChiefSellerName').value          = data.chiefSellerName || '';
  $('#editChiefSellerPhone').value         = data.chiefSellerPhone || '';
  $('#editCreditPersonName').value         = data.creditPersonName || '';
  $('#editCreditPersonPhone').value        = data.creditPersonPhone || '';
  $('#editProviderType').value             = data.providerType || '';
  $('#editPreferredPaymentMethod').value   = data.preferredPaymentMethod || '';
  $('#editAdditionalNotes').value          = data.additionalNotes || '';

  showModal('editProviderModal');
}

async function updateProvider() {
  const id = $('#editProviderId')?.value;
  const name = $('#editProviderName')?.value.trim() || '';
  const email = $('#editProviderEmail')?.value.trim() || '';

  if (!name) {
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  }
  if (email && !isValidEmail(email)) {
    return Swal.fire({ icon:'error', title:'Error', text:'Formato de email inválido.' });
  }

  const { isConfirmed } = await Swal.fire({
    title: 'Guardar cambios al proveedor?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  });
  if (!isConfirmed) return;

  const data = {
    name:                      $('#editProviderName').value.trim(),
    providerAddress:           $('#editProviderAddress').value.trim(),
    phone:                     $('#editProviderPhone').value.trim(),
    email:                     $('#editProviderEmail').value.trim(),
    providerPaymentTerms:      $('#editProviderPaymentTerms').value.trim(),
    sellerName:                $('#editSellerName').value.trim(),
    sellerPhone:               $('#editSellerPhone').value.trim(),
    chiefSellerName:           $('#editChiefSellerName').value.trim(),
    chiefSellerPhone:          $('#editChiefSellerPhone').value.trim(),
    creditPersonName:          $('#editCreditPersonName').value.trim(),
    creditPersonPhone:         $('#editCreditPersonPhone').value.trim(),
    providerType:              $('#editProviderType').value.trim(),
    preferredPaymentMethod:    $('#editPreferredPaymentMethod').value.trim(),
    additionalNotes:           $('#editAdditionalNotes').value.trim()
  };

  try {
    await db.collection('providers').doc(id).update(data);
    audit('update','providers',id,data);
    Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
    closeModal('editProviderModal');
    loadProviders();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo actualizar.' });
  }
}

async function deleteSelectedProvider() {
  const sel = getSelIds('#providersTable');
  if (!sel.length) {
    return Swal.fire({
      icon:'warning',
      title:'Atención',
      text: 'Debes seleccionar al menos un proveedor para eliminar.'
    });
  }
  const { isConfirmed } = await Swal.fire({
    title: `¿Eliminar ${sel.length} proveedor(es)?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });
  if (!isConfirmed) return;
  try {
    await Promise.all(sel.map(id => db.collection('providers').doc(id).delete()));
    sel.forEach(id => audit('delete','providers',id));
    Swal.fire({ icon:'success', title:'Eliminado', timer:1200, showConfirmButton:false });
    loadProviders();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo eliminar.' });
  }
}

function filterProviders() {
  const f = $('#providerSearchInput')?.value.toUpperCase() || '';
  document.querySelectorAll('#providersTable tbody tr').forEach(tr => {
    tr.style.display = tr.cells[0].textContent.toUpperCase().includes(f) ? '' : 'none';
  });
}

/* ==================  PRODUCTOS  ================== */
async function loadProducts() {
  const snap = await db.collection('products').orderBy('name').get();
  const tb = $('#productsTable tbody');
  tb.innerHTML = '';
  for (const doc of snap.docs) {
    const p = doc.data();
    const provDoc = p.providerId
      ? await db.collection('providers').doc(p.providerId).get()
      : null;
    const provName = provDoc?.exists ? provDoc.data().name : '—';
    const r = tb.insertRow();
    r.dataset.id = doc.id;
    r.dataset.providerId = p.providerId;
    r.insertCell().textContent = p.name;
    r.insertCell().textContent = p.presentation;
    r.insertCell().textContent = provName;
  }
}

function showAddProductForm() {
  showModal('addProductModal');
}

async function addProduct() {
  const name = $('#productName')?.value.trim() || '';
  const pres = $('#productPresentation')?.value.trim() || '';
  const pid  = $('#providerSelect')?.value || '';

  if (!name || !pres || !pid) {
    return Swal.fire({ icon:'error', title:'Error', text:'Todos los campos son obligatorios.' });
  }

  const { isConfirmed } = await Swal.fire({
    title: '¿Agregar este producto?', icon: 'question',
    showCancelButton: true, confirmButtonText: 'Sí, agregar', cancelButtonText: 'Cancelar'
  });
  if (!isConfirmed) return;

  const payload = {
    name,
    presentation: pres,
    providerId: pid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    const ref = await db.collection('products').add(payload);
    audit('create','products',ref.id,{name});
    Swal.fire({ icon:'success', title:'Producto agregado', timer:1500, showConfirmButton:false });
    closeModal('addProductModal');
    loadProducts();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo agregar producto.' });
  }
}

async function viewSelectedProduct() {
  const sel = getSelIds('#productsTable');
  if (sel.length !== 1) {
    return Swal.fire({
      icon:'warning', title:'Atención',
      text: sel.length === 0 ? 'Debes seleccionar un producto.' : 'Solo puedes ver uno a la vez.'
    });
  }
  showProductDetails(sel[0]);
}

async function showProductDetails(id) {
  const ul = document.getElementById('productDetailsList');
  if (!ul) {
    console.error('showProductDetails: elemento #productDetailsList no encontrado');
    return;
  }
  try {
    const doc = await db.collection('products').doc(id).get();
    if (!doc.exists) return;
    const data = doc.data();

    let provName = '—';
    if (data.providerId) {
      const pv = await db.collection('providers').doc(data.providerId).get();
      if (pv.exists) provName = pv.data().name;
    }

    const items = [
      { label: 'Nombre',       value: data.name || '—' },
      { label: 'Presentación', value: data.presentation || '—' },
      { label: 'Proveedor',    value: provName },
      {
        label: 'Creado',
        value: data.createdAt && data.createdAt.toDate
          ? data.createdAt.toDate().toLocaleString('es-ES')
          : '—'
      }
    ];

    ul.innerHTML = '';
    items.forEach(({label, value}) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between';
      li.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
      ul.appendChild(li);
    });

    showModal('viewProductModal');
  } catch (err) {
    console.error('Error en showProductDetails:', err);
  }
}

async function editSelectedProduct() {
  const sel = getSelIds('#productsTable');
  if (sel.length !== 1) {
    return Swal.fire({
      icon:'warning', title:'Atención',
      text: sel.length === 0 ? 'Debes seleccionar un producto.' : 'Solo puedes editar uno a la vez.'
    });
  }
  showEditProductForm(sel[0]);
}

async function showEditProductForm(id) {
  const d = await db.collection('products').doc(id).get();
  if (!d.exists) return;
  $('#editProductId').value = id;
  $('#editProductName').value = d.data().name;
  $('#editProductPresentation').value = d.data().presentation;
  showModal('editProductModal');
}

async function updateProduct() {
  const id   = $('#editProductId')?.value;
  const data = {
    name:         $('#editProductName')?.value.trim() || '',
    presentation: $('#editProductPresentation')?.value.trim() || ''
  };
  try {
    await db.collection('products').doc(id).update(data);
    audit('update','products',id,data);
    Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
    closeModal('editProductModal');
    loadProducts();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo actualizar.' });
  }
}

async function deleteSelectedProduct() {
  const sel = getSelIds('#productsTable');
  if (!sel.length) {
    return Swal.fire({
      icon:'warning',
      title:'Atención',
      text: 'Debes seleccionar al menos un producto para eliminar.'
    });
  }
  const { isConfirmed } = await Swal.fire({
    title: `¿Eliminar ${sel.length} producto(s)?`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
  });
  if (!isConfirmed) return;
  try {
    await Promise.all(sel.map(id => db.collection('products').doc(id).delete()));
    sel.forEach(id => audit('delete','products',id));
    Swal.fire({ icon:'success', title:'Eliminado', timer:1200, showConfirmButton:false });
    loadProducts();
  } catch (err) {
    console.error(err);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo eliminar.' });
  }
}

function filterProductsByName() {
  const f = $('#productSearchInput')?.value.toUpperCase() || '';
  document.querySelectorAll('#productsTable tbody tr').forEach(tr => {
    tr.style.display = tr.cells[0].textContent.toUpperCase().includes(f) ? '' : 'none';
  });
}

function filterProductsByProvider() {
  const pid = $('#productProviderFilter')?.value || '';
  document.querySelectorAll('#productsTable tbody tr').forEach(tr => {
    tr.style.display = !pid || tr.dataset.providerId === pid ? '' : 'none';
  });
}

async function loadProviderOptions() {
  const sel  = document.getElementById('providerSelect');
  const filt = document.getElementById('productProviderFilter');
  if (!sel || !filt) return;
  sel.innerHTML = '';
  filt.innerHTML = '<option value="">Todos los proveedores</option>';
  try {
    const snap = await db.collection('providers').orderBy('name').get();
    snap.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.data().name;
      sel.appendChild(o);
      filt.appendChild(o.cloneNode(true));
    });
  } catch (err) {
    console.error('Error cargando providers para select:', err);
  }
}

/* ------------------ INIT ------------------ */
window.addEventListener('DOMContentLoaded', () => {
  loadProviders();
  loadProducts();
  loadProviderOptions();

  makeRowsSelectable(
    '#providersTable',
    '#viewProviderBtn',
    '#editProviderBtn',
    '#deleteProviderBtn'
  );
  makeRowsSelectable(
    '#productsTable',
    '#viewProductBtn',
    '#editProductBtn',
    '#deleteProductBtn'
  );
});
