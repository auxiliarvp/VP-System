// bodegapedidos.js
// Lógica completa e independiente para la página “Pedidos Bodega”

/**********************************************************
 * VARIABLES GLOBALES
 **********************************************************/
let userSucursalId = null;
let loggedInUsername = null;
let userRole = null;
let userPermissions = {};
let logoBase64 = "";
let bodegaUnsubscribe = null;
let currentOrderForStatusChange = null;

// Se ejecuta al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initUserAndSucursal();
    setupAdminFilters();
    loadLogo();
    attachBodegaEnvioListener();
  } catch (e) {
    console.error(e);
  }
});

/**********************************************************
 * INICIALIZAR USUARIO, SUCURSAL Y PERMISOS
 **********************************************************/
async function initUserAndSucursal() {
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    await Swal.fire({
      icon: "warning",
      title: "No hay usuario logueado",
      text: "Redirigiendo a login..."
    });
    window.location.href = "../login.html";
    throw new Error("Sin usuario logueado");
  }
  const loggedDiv = document.getElementById("loggedInUser");
  if (loggedDiv) loggedDiv.textContent = "Usuario: " + loggedInUsername;

  const snap = await db
    .collection("usuarios")
    .where("username", "==", loggedInUsername)
    .limit(1)
    .get();
  if (snap.empty) {
    await Swal.fire({
      icon: "error",
      title: "Usuario no encontrado",
      text: "Inicia sesión de nuevo."
    });
    window.location.href = "../login.html";
    throw new Error("Usuario no encontrado");
  }
  const data = snap.docs[0].data();
  userSucursalId = data.sucursalId;
  userRole = data.rol;
  userPermissions = data.permisos || {};
}

/**********************************************************
 * CONFIGURAR FILTROS DE ADMIN (muestra el panel y carga opciones)
 **********************************************************/
function setupAdminFilters() {
  const panel = document.getElementById("adminFilterContainer");
  if (panel && userRole === "administrador") {
    panel.style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }
}
async function loadSucursalesForAdmin() {
  const sel = document.getElementById("sucursalFilter");
  if (!sel) return;
  sel.innerHTML = `<option value="all">Todas las sucursales</option>`;
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
  if (!sel) return;
  sel.innerHTML = `<option value="all">Todos los Proveedores</option>`;
  const snap = await db.collection("orders").get();
  const provSet = new Set();
  snap.forEach(doc => {
    const p = doc.data().providerName;
    if (p) provSet.add(p);
  });
  provSet.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

/**********************************************************
 * CARGAR LOGO EN BASE64
 **********************************************************/
function loadLogo() {
  const img = new Image();
  img.src = "../../resources/images/logo.png";
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL("image/png");
  };
  img.onerror = () =>
    console.error("No se pudo cargar ../../resources/images/logo.png");
}

/**********************************************************
 * VOLVER AL MENÚ PRINCIPAL
 **********************************************************/
function goToMainMenu() {
  window.location.href = "../index.html";
}

/**********************************************************
 * RECARGAR AL CAMBIAR FILTROS
 **********************************************************/
function reloadOrders() {
  attachBodegaEnvioListener();
}

/**********************************************************
 * ESCUCHA EN TIEMPO REAL: destino "Bodega", estado "bodegaEnvioPedido"
 **********************************************************/
function attachBodegaEnvioListener() {
  if (bodegaUnsubscribe) bodegaUnsubscribe();

  let query = db
    .collection("orders")
    .where("destination", "==", "Bodega")
    .where("status", "==", "bodegaEnvioPedido");

  if (userRole !== "administrador") {
    query = query.where("sucursalId", "==", userSucursalId);
  } else {
    const suc = document.getElementById("sucursalFilter")?.value;
    if (suc && suc !== "all") query = query.where("sucursalId", "==", suc);
    const prov = document.getElementById("providerFilter")?.value;
    if (prov && prov !== "all") query = query.where("providerName", "==", prov);
  }

  const sortVal = document.getElementById("sortOrder")?.value || "masReciente";
  query =
    sortVal === "masReciente"
      ? query.orderBy("timestamp", "desc")
      : query.orderBy("timestamp", "asc");

  bodegaUnsubscribe = query.onSnapshot(
    snap => {
      const cont = document.getElementById("bodegaOrdersCards");
      cont.innerHTML = "";
      snap.forEach(doc => {
        cont.appendChild(createOrderCard(doc.id, doc.data()));
      });
    },
    err => Swal.fire({ icon: "error", title: "Error", text: err.message })
  );
}

/**********************************************************
 * CREAR TARJETA DE PEDIDO
 **********************************************************/
function createOrderCard(id, order) {
  const card = document.createElement("div");
  card.className = "order-card";

  let html = `
    <h3>Pedido ID: ${escapeHtml(order.orderId)}</h3>
    <p>Proveedor: ${escapeHtml(order.providerName)}</p>
    <p>Sucursal: ${escapeHtml(order.sucursalName)}</p>
    <p>Fecha: ${escapeHtml(order.orderDate)}</p>
    <div class="order-status">${generateProgressBar(order)}</div>
    <button onclick="showOrderDetails('${id}')">Detalles</button>
  `;
  if (userRole === "administrador") {
    html += `<button onclick="openChangeStatusModal('${id}')">Cambiar Estado</button>`;
  }
  card.innerHTML = html;
  return card;
}

/**********************************************************
 * BARRA DE PROGRESO
 **********************************************************/
function generateProgressBar(order) {
  const flow = [
    { key: "pending", label: "Pendiente" },
    { key: "pedidoTomado", label: "Tomado" },
    { key: "pedidoEnBodega", label: "En Bodega" },
    { key: "bodegaEnvioPedido", label: "Envío Bodega" },
    { key: "sucursalRecibioPedido", label: "Completado" }
  ];
  return createProgressBarHTML(flow, order.status);
}
function createProgressBarHTML(flow, current) {
  const idx = flow.findIndex(s => s.key === current);
  let html = '<div class="progress-container">';
  flow.forEach((st, i) => {
    const cls = i < idx ? "completed" : i === idx ? "current" : "";
    html += `
      <div class="progress-step ${cls}">
        <div class="step-number">${i+1}</div>
        <div class="step-label">${st.label}</div>
      </div>
      ${i<flow.length-1?`<div class="progress-line ${i<idx?"completed":""}"></div>`:""}
    `;
  });
  html += "</div>";
  return html;
}

/**********************************************************
 * MODALES: cambiar estado, detalles
 **********************************************************/
function openChangeStatusModal(id) {
  currentOrderForStatusChange = id;
  document.getElementById("changeStatusModal").style.display = "block";
}
function closeChangeStatusModal() {
  document.getElementById("changeStatusModal").style.display = "none";
  currentOrderForStatusChange = null;
}
function changeOrderStatusManually(newStatus) {
  if (!currentOrderForStatusChange) {
    return Swal.fire({ icon: "error", title: "Error", text: "Selecciona un pedido." });
  }
  Swal.fire({
    title: `Cambiar a '${newStatus}'?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(currentOrderForStatusChange).update({ status: newStatus });
        Swal.fire({ icon: "success", title: "Estado actualizado" });
        closeChangeStatusModal();
      } catch (e) {
        Swal.fire({ icon: "error", title: "Error", text: e.message });
      }
    }
  });
}

function showOrderDetails(id) {
  db.collection("orders").doc(id).get().then(d => {
    if (!d.exists) return Swal.fire({ icon: "error", title: "No encontrado" });
    const o = d.data();
    const modal = document.getElementById("orderDetailsModal");
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="closeOrderDetailsModal()">&times;</span>
        <h2>Detalles del Pedido</h2>
        <p><strong>ID:</strong> ${escapeHtml(o.orderId)}</p>
        <p><strong>Proveedor:</strong> ${escapeHtml(o.providerName)}</p>
        <p><strong>Sucursal:</strong> ${escapeHtml(o.sucursalName)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(o.orderDate)}</p>
      </div>
    `;
    modal.style.display = "block";
  });
}
function closeOrderDetailsModal() {
  document.getElementById("orderDetailsModal").style.display = "none";
}

/**********************************************************
 * UTIL: escapar HTML
 **********************************************************/
function escapeHtml(str="") {
  return str.replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[m]);
}
