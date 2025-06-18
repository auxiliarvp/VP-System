/**********************************************************
 * facturas.js  –  Tabla de facturas
 **********************************************************/

/**********************************************************
 * VARIABLES GLOBALES
 **********************************************************/
let userRole = null;
let userSucursalId = null;
let loggedInUsername = null;
let invoicesUnsubscribe = null;

/**********************************************************
 * DOMContentLoaded
 **********************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await initUser();
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    await loadSucursalesForAdmin();
    await loadProvidersForAdmin();
  }
  attachInvoicesListener();
});

/**********************************************************
 * initUser
 **********************************************************/
async function initUser() {
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    await Swal.fire({ icon: "warning", title: "Sin sesión", text: "Redirigiendo…" });
    window.location.href = "login.html";
    return;
  }
  document.getElementById("loggedInUser").textContent = "Usuario: " + loggedInUsername;

  const snap = await db
    .collection("usuarios")
    .where("username", "==", loggedInUsername)
    .limit(1)
    .get();

  if (snap.empty) {
    await Swal.fire({ icon: "error", title: "Usuario no encontrado" });
    window.location.href = "login.html";
    return;
  }
  const data = snap.docs[0].data();
  userRole = data.rol;
  userSucursalId = data.sucursalId;
}

/**********************************************************
 * Filtros (admin)
 **********************************************************/
async function loadSucursalesForAdmin() {
  const sel = document.getElementById("sucursalFilter");
  sel.innerHTML = `<option value="all">Todas</option>`;
  const snap = await db.collection("sucursales").get();
  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
  });
}

async function loadProvidersForAdmin() {
  const sel = document.getElementById("providerFilter");
  sel.innerHTML = `<option value="all">Todos</option>`;
  const snap = await db.collection("orders").get();
  const providers = new Set();
  snap.forEach(d => {
    const p = d.data().providerName;
    if (p) providers.add(p);
  });
  providers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

/**********************************************************
 * Listener principal
 **********************************************************/
function attachInvoicesListener() {
  if (invoicesUnsubscribe) invoicesUnsubscribe();

  let query = db.collection("orders");

  // Filtros por rol / sucursal / proveedor
  if (userRole !== "administrador") {
    query = query.where("sucursalId", "==", userSucursalId);
  } else {
    const suc = document.getElementById("sucursalFilter").value;
    if (suc !== "all") query = query.where("sucursalId", "==", suc);

    const prov = document.getElementById("providerFilter").value;
    if (prov !== "all") query = query.where("providerName", "==", prov);
  }

  // Orden
  const sort = document.getElementById("sortOrder").value;
  query = sort === "masReciente"
    ? query.orderBy("timestamp", "desc")
    : query.orderBy("timestamp", "asc");

  invoicesUnsubscribe = query.onSnapshot(
    snap => renderInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => Swal.fire({ icon: "error", title: "Error", text: err.message })
  );
}

/**********************************************************
 * Renderizar a tabla
 **********************************************************/
function renderInvoices(orders) {
  const tbody = document.getElementById("invoiceTableBody");
  tbody.innerHTML = "";

  // Filtros de texto / fecha
  const invSearch   = document.getElementById("invoiceSearch").value.trim();
  const orderSearch = document.getElementById("orderIdSearch").value.trim();
  const dateSearch  = document.getElementById("dateSearch").value;

  orders.forEach(order => {
    if (!order.invoices || order.invoices.length === 0) return;

    order.invoices.forEach(inv => {
      if (invSearch   && !String(inv.invoiceNumber).includes(invSearch)) return;
      if (orderSearch && !String(order.orderId).includes(orderSearch))  return;
      if (dateSearch  && inv.invoiceDate !== dateSearch)                return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${inv.invoiceNumber}</td>
        <td>${inv.invoiceDate}</td>
        <td>${order.providerName}</td>
        <td>${order.sucursalName}</td>
        <td>${order.orderId}</td>
        <td>${order.invoiceTotal ?? "—"}</td>
        <td><button class="table-btn" data-o='${order.id}' data-n='${inv.invoiceNumber}'>Detalle</button></td>
      `;
      tbody.appendChild(tr);
    });
  });

  // Sin resultados
  if (!tbody.hasChildNodes()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" style="text-align:center;color:#6c757d;">Sin resultados…</td>`;
    tbody.appendChild(tr);
  }
}

/**********************************************************
 * Delegación de clic en botones de la tabla
 **********************************************************/
document.getElementById("invoiceTableBody").addEventListener("click", async e => {
  if (!e.target.matches(".table-btn")) return;

  const orderId   = e.target.dataset.o;
  const invNumber = e.target.dataset.n;

  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) {
    Swal.fire({ icon: "error", title: "Pedido no encontrado" });
    return;
  }
  const order = doc.data();
  const inv   = order.invoices.find(i => String(i.invoiceNumber) === String(invNumber));
  if (!inv) {
    Swal.fire({ icon: "error", title: "Factura no encontrada" });
    return;
  }
  showInvoiceDetails(inv, order);
});

/**********************************************************
 * Modal
 **********************************************************/
function showInvoiceDetails(inv, order) {
  const det = document.getElementById("invoiceDetails");
  det.innerHTML = `
    <p><strong>N° Factura:</strong> ${inv.invoiceNumber}</p>
    <p><strong>Fecha:</strong> ${inv.invoiceDate}</p>
    <p><strong>Proveedor:</strong> ${order.providerName}</p>
    <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
    <p><strong>ID Pedido:</strong> ${order.orderId}</p>
    <p><strong>Total Factura (pedido):</strong> Q${order.invoiceTotal ?? "—"}</p>
    ${order.mismatchComment ? `<p style="color:red;"><strong>Comentario:</strong> ${order.mismatchComment}</p>` : ""}
    <button id="goToOrderBtn">Ir al Pedido</button>
  `;
  document.getElementById("goToOrderBtn").onclick = () => {
    window.location.href = `pedidos.html#${order.orderId}`;
  };
  document.getElementById("invoiceDetailsModal").style.display = "block";
}

function closeInvoiceDetailsModal() {
  document.getElementById("invoiceDetailsModal").style.display = "none";
  document.getElementById("invoiceDetails").innerHTML = "";
}

/**********************************************************
 * Navegación
 **********************************************************/
function goToMainMenu() {
  window.location.href = "../index.html";
}

/**********************************************************
 * Recargar con filtros
 **********************************************************/
function reloadInvoices() {
  attachInvoicesListener();
}
