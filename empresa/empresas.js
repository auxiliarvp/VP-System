// empresas.js – 20-Jun-2025
// NOTA: La inicialización de Firebase y la variable `db` vienen de connection.js

const $ = s => document.querySelector(s);

// — Helpers de selección de filas —
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
    const was = tr.classList.contains('selected');
    tbl.querySelectorAll('tbody tr.selected').forEach(r=>r.classList.remove('selected'));
    if (!was) tr.classList.add('selected');
    toggleBtns(tableSel, viewBtn, editBtn, delBtn);
  });
}

// — Auditoría —
const audit = (act, col, id, data={}) =>
  db.collection('auditLog').add({
    user: firebase.auth().currentUser?.email || 'anon',
    act, col, id, data,
    at: firebase.firestore.FieldValue.serverTimestamp()
  });

// — Validaciones —
function isValidEmail(e){ return /^\S+@\S+\.\S+$/.test(e); }
function isValidPhone(p){ return /^\d{7,}$/.test(p); }

// ====================== EMPRESAS ======================
async function loadCompanies() {
  const snap = await db.collection('empresas').orderBy('name').get();
  const tb = $('#companiesTable tbody'); tb.innerHTML = '';
  snap.forEach(d => {
    const v = d.data();
    const r = tb.insertRow();
    r.dataset.id = d.id;
    r.insertCell().textContent = v.name;
    r.insertCell().textContent = v.address || '—';
    r.insertCell().textContent = v.phone   || '—';
    r.insertCell().textContent = v.email   || '—';
    r.insertCell().textContent = v.creationDate || '—';
    r.insertCell().textContent = v.description  || '—';
    r.insertCell().textContent = v.status;
  });
}
function showAddCompanyForm(){ showModal('addCompanyModal'); }
async function addCompany() {
  const name  = $('#companyName').value.trim();
  const email = $('#companyEmail').value.trim();
  const phone = $('#companyPhone').value.trim();
  if (!name)
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  if (email && !isValidEmail(email))
    return Swal.fire({ icon:'error', title:'Error', text:'Email inválido.' });
  if (phone && !isValidPhone(phone))
    return Swal.fire({ icon:'error', title:'Error', text:'Teléfono inválido.' });

  const { isConfirmed } = await Swal.fire({
    title: '¿Guardar empresa?', icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  const payload = {
    name,
    address: $('#companyAddress').value.trim(),
    phone, email,
    creationDate: $('#companyCreationDate').value,
    description: $('#companyDescription').value.trim(),
    status: $('#companyStatus').value
  };
  try {
    const ref = await db.collection('empresas').add(payload);
    audit('create','empresas',ref.id,{ name });
    Swal.fire({ icon:'success', title:'Guardado', timer:1500, showConfirmButton:false });
    closeModal('addCompanyModal');
    loadCompanies();
    loadCompanyOptions(); 
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar.' });
  }
}

async function viewSelectedCompany() {
  const sel = getSelIds('#companiesTable');
  if (sel.length !== 1)
    return Swal.fire({ icon:'warning', title:'Atención', text: sel.length ? 'Selecciona solo una.' : 'Selecciona al menos una.' });
  const doc = await db.collection('empresas').doc(sel[0]).get();
  if (!doc.exists) return;
  const d = doc.data();
  const ul = $('#companyDetailsList'); ul.innerHTML = '';
  const labels = { name:'Nombre', address:'Dirección', phone:'Teléfono', email:'Email', creationDate:'Creado', description:'Descripción', status:'Estado' };
  for (const k in labels) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.innerHTML = `<strong>${labels[k]}</strong><span>${d[k]||'—'}</span>`;
    ul.appendChild(li);
  }
  showModal('viewCompanyModal');
}

async function editSelectedCompany() {
  const sel = getSelIds('#companiesTable');
  if (sel.length !== 1)
    return Swal.fire({ icon:'warning', title:'Atención', text: sel.length ? 'Selecciona solo una.' : 'Selecciona al menos una.' });
  const doc = await db.collection('empresas').doc(sel[0]).get();
  if (!doc.exists) return;
  const v = doc.data();
  $('#editCompanyId').value            = doc.id;
  $('#editCompanyName').value          = v.name;
  $('#editCompanyAddress').value       = v.address || '';
  $('#editCompanyPhone').value         = v.phone   || '';
  $('#editCompanyEmail').value         = v.email   || '';
  $('#editCompanyCreationDate').value  = v.creationDate || '';
  $('#editCompanyDescription').value   = v.description  || '';
  $('#editCompanyStatus').value        = v.status;
  showModal('editCompanyModal');
}

async function updateCompany() {
  const id   = $('#editCompanyId').value;
  const name = $('#editCompanyName').value.trim();
  if (!name)
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  if ($('#editCompanyEmail').value && !isValidEmail($('#editCompanyEmail').value))
    return Swal.fire({ icon:'error', title:'Error', text:'Email inválido.' });

  const { isConfirmed } = await Swal.fire({
    title: 'Guardar cambios?', icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  const data = {
    name,
    address: $('#editCompanyAddress').value.trim(),
    phone:   $('#editCompanyPhone').value.trim(),
    email:   $('#editCompanyEmail').value.trim(),
    creationDate: $('#editCompanyCreationDate').value,
    description:  $('#editCompanyDescription').value.trim(),
    status:       $('#editCompanyStatus').value
  };
  try {
    await db.collection('empresas').doc(id).update(data);
    audit('update','empresas',id,data);
    Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
    closeModal('editCompanyModal');
    loadCompanies();
    loadCompanyOptions();
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo actualizar.' });
  }
}

async function deleteSelectedCompany() {
  const sel = getSelIds('#companiesTable');
  if (!sel.length)
    return Swal.fire({ icon:'warning', title:'Atención', text:'Selecciona al menos una.' });

  const { isConfirmed } = await Swal.fire({
    title: `¿Eliminar ${sel.length} empresa(s)?`, icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  try {
    await Promise.all(sel.map(id => db.collection('empresas').doc(id).delete()));
    sel.forEach(id => audit('delete','empresas',id));
    Swal.fire({ icon:'success', title:'Eliminado', timer:1200, showConfirmButton:false });
    loadCompanies();
    loadCompanyOptions();
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo eliminar.' });
  }
}

function filterCompanies() {
  const f = $('#companySearchInput').value.toUpperCase();
  document.querySelectorAll('#companiesTable tbody tr')
    .forEach(tr =>
      tr.style.display = tr.cells[0].textContent.toUpperCase().includes(f) ? '' : 'none'
    );
}

// ====================== SUCURSALES ======================
async function loadBranches() {
  const filtro = $('#branchCompanyFilter').value;
  let query = db.collection('sucursales');
  if (filtro) query = query.where('empresaId','==',filtro);
  const snap = await query.orderBy('name').get();

  // precarga nombres de empresa
  const emps = {};
  (await db.collection('empresas').get()).forEach(d => emps[d.id] = d.data().name);

  const tb = $('#branchesTable tbody'); tb.innerHTML = '';
  snap.forEach(d => {
    const v = d.data();
    const r = tb.insertRow();
    r.dataset.id        = d.id;
    r.dataset.empresaId = v.empresaId;
    r.insertCell().textContent = v.name;
    r.insertCell().textContent = v.address     || '—';
    r.insertCell().textContent = v.phone       || '—';
    r.insertCell().textContent = v.email       || '—';
    r.insertCell().textContent = v.creationDate|| '—';
    r.insertCell().textContent = v.manager     || '—';
    r.insertCell().textContent = v.description || '—';
    r.insertCell().textContent = v.status;
    r.insertCell().textContent = emps[v.empresaId] || '—';
  });
}

function showAddBranchForm(){ showModal('addBranchModal'); }
async function addBranch() {
  const name = $('#branchName').value.trim();
  const emp  = $('#companySelect').value;
  if (!name)
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  if (!emp)
    return Swal.fire({ icon:'error', title:'Error', text:'Selecciona una empresa.' });

  const { isConfirmed } = await Swal.fire({
    title: '¿Guardar sucursal?', icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  const payload = {
    name,
    address: $('#branchAddress').value.trim(),
    phone:   $('#branchPhone').value.trim(),
    email:   $('#branchEmail').value.trim(),
    creationDate: $('#branchCreationDate').value,
    manager:       $('#branchManager').value.trim(),
    description:   $('#branchDescription').value.trim(),
    status:        $('#branchStatus').value,
    empresaId:     emp
  };
  try {
    const ref = await db.collection('sucursales').add(payload);
    audit('create','sucursales',ref.id,{ name });
    Swal.fire({ icon:'success', title:'Guardado', timer:1500, showConfirmButton:false });
    closeModal('addBranchModal');
    loadBranches();
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar.' });
  }
}

async function viewSelectedBranch() {
  const sel = getSelIds('#branchesTable');
  if (sel.length !== 1)
    return Swal.fire({ icon:'warning', title:'Atención', text:'Selecciona una sucursal.' });

  const doc = await db.collection('sucursales').doc(sel[0]).get();
  if (!doc.exists) return;
  const d = doc.data();
  const ul = $('#branchDetailsList'); ul.innerHTML = '';

  const labels = {
    name:'Nombre', address:'Dirección', phone:'Teléfono',
    email:'Email', creationDate:'Creado', manager:'Encargado',
    description:'Descripción', status:'Estado', empresaId:'Empresa'
  };
  // precarga nombres
  const emps = {};
  (await db.collection('empresas').get()).forEach(e => emps[e.id] = e.data().name);

  for (const k in labels) {
    let val = d[k] || '—';
    if (k === 'empresaId') val = emps[val] || '—';
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.innerHTML = `<strong>${labels[k]}</strong><span>${val}</span>`;
    ul.appendChild(li);
  }
  showModal('viewBranchModal');
}

async function editSelectedBranch() {
  const sel = getSelIds('#branchesTable');
  if (sel.length !== 1)
    return Swal.fire({ icon:'warning', title:'Atención', text:'Selecciona una sucursal.' });

  const doc = await db.collection('sucursales').doc(sel[0]).get();
  if (!doc.exists) return;
  const v = doc.data();
  $('#editBranchId').value            = doc.id;
  $('#editBranchName').value          = v.name;
  $('#editBranchAddress').value       = v.address     || '';
  $('#editBranchPhone').value         = v.phone       || '';
  $('#editBranchEmail').value         = v.email       || '';
  $('#editBranchCreationDate').value  = v.creationDate|| '';
  $('#editBranchManager').value       = v.manager     || '';
  $('#editBranchDescription').value   = v.description || '';
  $('#editBranchStatus').value        = v.status;
  $('#editCompanySelect').value       = v.empresaId;
  showModal('editBranchModal');
}

async function updateBranch() {
  const id   = $('#editBranchId').value;
  const name = $('#editBranchName').value.trim();
  const emp  = $('#editCompanySelect').value;
  if (!name)
    return Swal.fire({ icon:'error', title:'Error', text:'El nombre es obligatorio.' });
  if (!emp)
    return Swal.fire({ icon:'error', title:'Error', text:'Selecciona una empresa.' });

  const { isConfirmed } = await Swal.fire({
    title: 'Guardar cambios?', icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  const data = {
    name,
    address: $('#editBranchAddress').value.trim(),
    phone:   $('#editBranchPhone').value.trim(),
    email:   $('#editBranchEmail').value.trim(),
    creationDate: $('#editBranchCreationDate').value,
    manager:       $('#editBranchManager').value.trim(),
    description:   $('#editBranchDescription').value.trim(),
    status:        $('#editBranchStatus').value,
    empresaId:     emp
  };
  try {
    await db.collection('sucursales').doc(id).update(data);
    audit('update','sucursales',id,data);
    Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
    closeModal('editBranchModal');
    loadBranches();
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo actualizar.' });
  }
}

async function deleteSelectedBranch() {
  const sel = getSelIds('#branchesTable');
  if (!sel.length)
    return Swal.fire({ icon:'warning', title:'Atención', text:'Selecciona al menos una sucursal.' });

  const { isConfirmed } = await Swal.fire({
    title: `¿Eliminar ${sel.length} sucursal(es)?`, icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar', cancelButtonText: 'No'
  });
  if (!isConfirmed) return;

  try {
    await Promise.all(sel.map(id => db.collection('sucursales').doc(id).delete()));
    sel.forEach(id => audit('delete','sucursales',id));
    Swal.fire({ icon:'success', title:'Eliminado', timer:1200, showConfirmButton:false });
    loadBranches();
  } catch(e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error', text:'No se pudo eliminar.' });
  }
}

// — Filtros —
function filterBranchesByName() {
  const f = $('#branchSearchInput').value.toUpperCase();
  document.querySelectorAll('#branchesTable tbody tr')
    .forEach(tr =>
      tr.style.display = tr.cells[0].textContent.toUpperCase().includes(f) ? '' : 'none'
    );
}
function filterBranchesByCompany() {
  const cid = $('#branchCompanyFilter').value;
  document.querySelectorAll('#branchesTable tbody tr')
    .forEach(tr =>
      tr.style.display = !cid || tr.dataset.empresaId === cid ? '' : 'none'
    );
}

// — Carga opciones de empresa para filtros y selects —
async function loadCompanyOptions() {
  const selAdd  = $('#companySelect');
  const selFilt = $('#branchCompanyFilter');
  selAdd.innerHTML  = '';
  selFilt.innerHTML = '<option value="">Todas las empresas</option>';
  const snap = await db.collection('empresas').orderBy('name').get();
  snap.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.data().name;
    selAdd.appendChild(opt);
    selFilt.appendChild(opt.cloneNode(true));
  });
}

// — Modales —
function showModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'flex';
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

// — Inicialización —
window.addEventListener('DOMContentLoaded', () => {
  loadCompanies();
  loadBranches();
  loadCompanyOptions();
  makeRowsSelectable('#companiesTable','#viewCompanyBtn','#editCompanyBtn','#deleteCompanyBtn');
  makeRowsSelectable('#branchesTable','#viewBranchBtn','#editBranchBtn','#deleteBranchBtn');
});
