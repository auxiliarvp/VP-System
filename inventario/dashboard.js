// dashboard.js
// Utiliza window.db definido en connection.js

// Métricas
const totalProvidersEl   = document.getElementById('totalProviders');
const totalProductsEl    = document.getElementById('totalProducts');
const topProviderNameEl  = document.getElementById('topProviderName');
const topProviderSpendEl = document.getElementById('topProviderSpend');
const topProductNameEl   = document.getElementById('topProductName');
const topProductConsumeEl= document.getElementById('topProductConsume');

// Contextos de gráficas
const ctxProv    = document.getElementById('productsByProviderChart').getContext('2d');
const ctxTopProv = document.getElementById('topProvidersChart').getContext('2d');
const ctxTopProd = document.getElementById('topProductsChart').getContext('2d');

/**
 * Carga órdenes (suponiendo colección "orders" con campos
 * providerId, productId y amount)
 */
async function fetchOrders() {
  const snap = await db.collection('orders').get();
  return snap.docs.map(d => d.data());
}

/**
 * Actualiza métricas: totales + top proveedor/producto
 */
async function updateMetrics() {
  // Totales
  const provSnap = await db.collection('providers').get();
  totalProvidersEl.textContent = provSnap.size;

  const prodSnap = await db.collection('products').get();
  totalProductsEl.textContent = prodSnap.size;

  // Consumos
  const orders = await fetchOrders();
  const spendByProv = {};
  const consumeByProd = {};
  orders.forEach(o => {
    if (o.providerId && typeof o.amount === 'number') {
      spendByProv[o.providerId] = (spendByProv[o.providerId]||0) + o.amount;
    }
    if (o.productId && typeof o.amount === 'number') {
      consumeByProd[o.productId] = (consumeByProd[o.productId]||0) + o.amount;
    }
  });

  // Top proveedor
  const provEntries = Object.entries(spendByProv).sort((a,b)=>b[1]-a[1]);
  if (provEntries.length) {
    const [provId, amt] = provEntries[0];
    const doc = await db.collection('providers').doc(provId).get();
    topProviderNameEl.textContent  = doc.exists ? doc.data().name : '—';
    topProviderSpendEl.textContent = `Q${amt.toFixed(2)}`;
  }

  // Top producto
  const prodEntries = Object.entries(consumeByProd).sort((a,b)=>b[1]-a[1]);
  if (prodEntries.length) {
    const [prodId, amt] = prodEntries[0];
    const doc = await db.collection('products').doc(prodId).get();
    topProductNameEl.textContent    = doc.exists ? doc.data().name : '—';
    topProductConsumeEl.textContent = `Q${amt.toFixed(2)}`;
  }
}

/**
 * Dibuja un bar chart de productos por proveedor
 */
async function renderProductsByProvider() {
  const provSnap = await db.collection('providers').orderBy('name').get();
  const labels = [], data = [];
  for (let d of provSnap.docs) {
    labels.push(d.data().name);
    const cnt = (await db.collection('products')
      .where('providerId','==',d.id).get()).size;
    data.push(cnt);
  }
  new Chart(ctxProv, {
    type: 'bar',
    data: { labels, datasets: [{ label:'Productos', data }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

/**
 * Dibuja el top 5 de proveedores por gasto
 */
async function renderTopProvidersChart() {
  const orders = await fetchOrders();
  const spendByProv = {};
  orders.forEach(o => {
    if (o.providerId && typeof o.amount === 'number') {
      spendByProv[o.providerId] = (spendByProv[o.providerId]||0) + o.amount;
    }
  });
  const top5 = Object.entries(spendByProv)
    .sort((a,b)=>b[1]-a[1]).slice(0,5);
  const labels = [], data = [];
  for (let [id, amt] of top5) {
    const doc = await db.collection('providers').doc(id).get();
    labels.push(doc.exists?doc.data().name:'—');
    data.push(amt);
  }
  new Chart(ctxTopProv, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Gasto', data }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

/**
 * Dibuja el top 5 de productos por consumo
 */
async function renderTopProductsChart() {
  const orders = await fetchOrders();
  const consumeByProd = {};
  orders.forEach(o => {
    if (o.productId && typeof o.amount === 'number') {
      consumeByProd[o.productId] = (consumeByProd[o.productId]||0) + o.amount;
    }
  });
  const top5 = Object.entries(consumeByProd)
    .sort((a,b)=>b[1]-a[1]).slice(0,5);
  const labels = [], data = [];
  for (let [id, amt] of top5) {
    const doc = await db.collection('products').doc(id).get();
    labels.push(doc.exists?doc.data().name:'—');
    data.push(amt);
  }
  new Chart(ctxTopProd, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Consumo', data }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

/**
 * Exporta proveedores y productos a CSV
 */
async function exportCSV() {
  const provSnap = await db.collection('providers').orderBy('name').get();
  const prodSnap = await db.collection('products').orderBy('name').get();
  const headers = ['tipo','id','nombre','email','telefono','presentacion','proveedorId','createdAt'];
  const fmt = ts => ts&&ts.toDate?ts.toDate().toLocaleString('es-ES'):'';
  const rows = [];
  provSnap.forEach(d=>{
    const c=d.data();
    rows.push(['Proveedor',d.id,c.name,c.email||'',c.phone||'','','',fmt(c.createdAt)]);
  });
  prodSnap.forEach(d=>{
    const c=d.data();
    rows.push(['Producto',d.id,c.name,'','',c.presentation,c.providerId||'',fmt(c.createdAt)]);
  });
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  const csv=[headers.join(','),...rows.map(r=>r.map(esc).join(','))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='export_inventario.csv'; a.click();
  URL.revokeObjectURL(url);
}

// Inicialización
window.addEventListener('DOMContentLoaded', async ()=>{
  await updateMetrics();
  renderProductsByProvider();
  renderTopProvidersChart();
  renderTopProductsChart();
});
