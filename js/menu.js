document.addEventListener('DOMContentLoaded', () => {
  const sidebar    = document.getElementById('sidebarMenu');
  const btnToggle  = document.getElementById('sidebarToggle');
  const links      = sidebar.querySelectorAll('a[data-target]');
  const containers = document.querySelectorAll('.content-container');
  const logoutBtn  = document.getElementById('logoutBtn');
  const userSpan   = document.getElementById('currentUser');

  // 1. Verificar sesión
  const usuario = localStorage.getItem('usuarioLogueado');
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }
  userSpan.textContent = usuario;

  // 2. Mostrar primer contenedor
  containers.forEach((c, i) => {
    c.classList.toggle('active', i === 0);
  });

  // 3. Navegación interna
  links.forEach(link =>
    link.addEventListener('click', e => {
      e.preventDefault();
      const t = link.dataset.target;
      containers.forEach(c =>
        c.classList.toggle('active', c.id === t)
      );
    })
  );

  // 4. Toggle sidebar
  btnToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // 5. Cerrar sesión
  logoutBtn.addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'login.html';
  });
});
