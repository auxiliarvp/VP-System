// dashboard.js
// Usa window.db expuesto por connection.js

const totalProvidersEl   = document.getElementById('totalProviders');
const totalProductsEl    = document.getElementById('totalProducts');
const topProviderNameEl  = document.getElementById('topProviderName');
const topProviderSpendEl = document.getElementById('topProviderSpend');
const topProductNameEl   = document.getElementById('topProductName');
const topProductConsumeEl= document.getElementById('topProductConsume');

const ctxTopProv = document.getElementById('topProvidersChart').getContext('2d');
const ctxTopProd = document.getElementById('topProductsChart').getContext('2d');

/** Trae todas las órdenes de gasto/consumo */
async function fetchOrders() {
  const snap = await db.collection('orders').get();
  return snap.docs.map(d => d.data());
}

/** Actualiza métricas principales */
async function updateMetrics() {
  const provSnap = await db.collection('providers').get();
  totalProvidersEl.textContent = provSnap.size;

  const prodSnap = await db.collection('products').get();
  totalProductsEl.textContent = prodSnap.size;

  const orders = await fetchOrders();
  const spendByProv = {}, consumeByProd = {};

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

/** Dibuja Top 5 proveedores por gasto */
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
  for (const [id, amt] of top5) {
    const doc = await db.collection('providers').doc(id).get();
    labels.push(doc.exists ? doc.data().name : '—');
    data.push(amt);
  }
  new Chart(ctxTopProv, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Gasto', data }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

/** Dibuja Top 5 productos por consumo */
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
  for (const [id, amt] of top5) {
    const doc = await db.collection('products').doc(id).get();
    labels.push(doc.exists ? doc.data().name : '—');
    data.push(amt);
  }
  new Chart(ctxTopProd, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Consumo', data }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

// Inicialización
window.addEventListener('DOMContentLoaded', async () => {
  await updateMetrics();
  renderTopProvidersChart();
  renderTopProductsChart();
});
