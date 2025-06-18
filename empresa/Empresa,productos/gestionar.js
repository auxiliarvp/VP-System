// ¡db viene de ../../database/connection.js!

function getSelectedRowIds(tableSel) {
  return Array.from(
    document.querySelectorAll(`${tableSel} .row-select:checked`)
  ).map(cb => cb.dataset.id);
}

function attachRowSelection(tableSel, allSel, editBtn, delBtn) {
  const table   = document.querySelector(tableSel);
  const chkAll  = document.querySelector(allSel);
  const btnE    = document.querySelector(editBtn);
  const btnD    = document.querySelector(delBtn);

  function updateBtns() {
    const n = getSelectedRowIds(tableSel).length;
    btnE.disabled = n !== 1;
    btnD.disabled = n === 0;
  }

  chkAll.addEventListener('change', () => {
    table.querySelectorAll('.row-select').forEach(cb => cb.checked = chkAll.checked);
    updateBtns();
  });

  table.addEventListener('change', e => {
    if (e.target.matches('.row-select')) updateBtns();
  });
}

function showAddProviderForm() { document.getElementById('addProviderModal').style.display = 'flex'; }
function showAddProductForm()  { loadProviderOptions(); document.getElementById('addProductModal').style.display = 'flex'; }
function closeModal(id)        { document.getElementById(id).style.display = 'none'; }

async function loadProviders() {
  const snap = await db.collection('providers').get();
  const tb   = document.querySelector('#providersTable tbody');
  tb.innerHTML = '';
  snap.forEach(doc => {
    const r = tb.insertRow();
    r.insertCell(0).innerHTML = `<input type="checkbox" class="row-select" data-id="${doc.id}">`;
    r.insertCell(1).textContent = doc.data().name;
  });
  attachRowSelection('#providersTable','#selectAllProviders','#editProviderBtn','#deleteProviderBtn');
}

async function addProvider() {
  const name = document.getElementById('providerName').value.trim();
  if (!name) return alert('El nombre no puede ir vacío');
  await db.collection('providers').add({ ...Object.fromEntries(
    ['providerName','providerAddress','providerPhone','providerEmail',
     'providerPaymentTerms','sellerName','sellerPhone','chiefSellerName',
     'chiefSellerPhone','creditPersonName','creditPersonPhone',
     'providerType','preferredPaymentMethod']
    .map(id=>[ id.replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,''),
                document.getElementById(id).value ])
  ), additionalNotes: document.getElementById('additionalNotes').value });
  closeModal('addProviderModal');
  loadProviders();
}

function editSelectedProvider() {
  const sel = getSelectedRowIds('#providersTable');
  if (sel.length !== 1) return alert('Selecciona exactamente un proveedor');
  showEditProviderForm(sel[0]);
}

async function showEditProviderForm(id) {
  const doc = await db.collection('providers').doc(id).get();
  if (!doc.exists) return alert('No encontrado');
  const p = doc.data();
  document.getElementById('editProviderId').value = id;
  Object.entries(p).forEach(([k,v]) => {
    const el = document.getElementById('edit'+ k.charAt(0).toUpperCase()+k.slice(1));
    if (el) el.value = v;
  });
  document.getElementById('editProviderModal').style.display = 'flex';
}

async function updateProvider() {
  const id = document.getElementById('editProviderId').value;
  const data = {};
  ['Name','Address','Phone','Email','PaymentTerms','SellerName',
   'SellerPhone','ChiefSellerName','ChiefSellerPhone',
   'CreditPersonName','CreditPersonPhone','Type',
   'PreferredPaymentMethod','AdditionalNotes']
    .forEach(suffix => {
      const el = document.getElementById('edit'+suffix);
      if (el) data[suffix.charAt(0).toLowerCase()+suffix.slice(1)] = el.value;
    });
  await db.collection('providers').doc(id).update(data);
  closeModal('editProviderModal');
  loadProviders();
}

async function deleteSelectedProvider() {
  const sel = getSelectedRowIds('#providersTable');
  if (!sel.length) return alert('Selecciona al menos uno');
  if (!confirm('Eliminar los seleccionados?')) return;
  await Promise.all(sel.map(id=>db.collection('providers').doc(id).delete()));
  loadProviders();
}

function filterProviders() {
  const f = document.getElementById('providerSearchInput').value.toUpperCase();
  document.querySelectorAll('#providersTable tbody tr').forEach(tr=>{
    tr.style.display = tr.cells[1].textContent.toUpperCase().includes(f)? '':'none';
  });
}

// — Productos similares —
async function loadProducts() {
  const snap = await db.collection('products').get();
  const tb   = document.querySelector('#productsTable tbody');
  tb.innerHTML = '';
  for(const doc of snap.docs) {
    const p = doc.data();
    const prov = await db.collection('providers').doc(p.providerId).get();
    const name = prov.exists?prov.data().name:'—';
    const r = tb.insertRow();
    r.insertCell(0).innerHTML = `<input type="checkbox" class="row-select" data-id="${doc.id}">`;
    r.insertCell(1).textContent = p.name;
    r.insertCell(2).textContent = p.presentation;
    r.insertCell(3).textContent = name;
  }
  attachRowSelection('#productsTable','#selectAllProducts','#editProductBtn','#deleteProductBtn');
}

async function addProduct() {
  const name = document.getElementById('productName').value.trim();
  const pres = document.getElementById('productPresentation').value.trim();
  const pid  = document.getElementById('providerSelect').value;
  if (!name||!pres||!pid) return alert('Completa todos los campos');
  await db.collection('products').add({ name, presentation: pres, providerId: pid });
  closeModal('addProductModal');
  loadProducts();
}

function editSelectedProduct() {
  const sel = getSelectedRowIds('#productsTable');
  if (sel.length !==1) return alert('Selecciona uno');
  showEditProductForm(sel[0]);
}

async function showEditProductForm(id) {
  const doc = await db.collection('products').doc(id).get();
  if (!doc.exists) return alert('No encontrado');
  const p = doc.data();
  document.getElementById('editProductId').value = id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editProductPresentation').value = p.presentation;
  document.getElementById('editProductModal').style.display = 'flex';
}

async function updateProduct() {
  const id = document.getElementById('editProductId').value;
  await db.collection('products').doc(id).update({
    name: document.getElementById('editProductName').value,
    presentation: document.getElementById('editProductPresentation').value
  });
  closeModal('editProductModal');
  loadProducts();
}

async function deleteSelectedProduct() {
  const sel = getSelectedRowIds('#productsTable');
  if (!sel.length) return alert('Selecciona al menos uno');
  if (!confirm('Eliminar seleccionados?')) return;
  await Promise.all(sel.map(id=>db.collection('products').doc(id).delete()));
  loadProducts();
}

function filterProductsByName() {
  const f = document.getElementById('productSearchInput').value.toUpperCase();
  document.querySelectorAll('#productsTable tbody tr').forEach(tr=>{
    tr.style.display = tr.cells[1].textContent.toUpperCase().includes(f)?'':'none';
  });
}

function filterProductsByProvider() {
  const f = document.getElementById('productProviderFilter').value;
  document.querySelectorAll('#productsTable tbody tr').forEach(tr=>{
    tr.style.display = (!f||tr.getAttribute('data-provider-id')===f)?'':'none';
  });
}

async function loadProviderOptions() {
  const sel  = document.getElementById('providerSelect');
  const filt = document.getElementById('productProviderFilter');
  sel.innerHTML = '';
  filt.innerHTML = '<option value="">Todos los proveedores</option>';
  const snap = await db.collection('providers').get();
  snap.forEach(doc=>{
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
    filt.appendChild(opt.cloneNode(true));
  });
}

// On load
window.addEventListener('DOMContentLoaded', ()=>{
  loadProviders();
  loadProducts();
  loadProviderOptions();
});
