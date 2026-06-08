// Configuración de la URL de la API según el entorno (local o producción)
const API_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "https://localhost:7264/api"
  : "https://api.daberkas.com/api";

const tokenKey = "helpsphere_token";
const userKey = "helpsphere_user";

let categoriasCache = [];
let publicacionesCache = [];
let solicitudesCache = [];

const $ = (id) => document.getElementById(id);

const els = {
  btnShowLogin: $("btnShowLogin"),
  btnShowRegister: $("btnShowRegister"),
  btnLogout: $("btnLogout"),
  btnScrollPublicaciones: $("btnScrollPublicaciones"),
  btnScrollPanel: $("btnScrollPanel"),
  loginForm: $("loginForm"),
  registerForm: $("registerForm"),
  publicacionForm: $("publicacionForm"),
  perfilForm: $("perfilForm"),
  valoracionForm: $("valoracionForm"),
  btnRegistrarValoracion: $("btnRegistrarValoracion"),
  valoracionPuntuacion: $("valoracionPuntuacion"),
  valoracionComentario: $("valoracionComentario"),
  messageBox: $("messageBox"),
  sessionStatus: $("sessionStatus"),
  categoriasContainer: $("categoriasContainer"),
  publicacionesContainer: $("publicacionesContainer"),
  solicitudesContainer: $("solicitudesContainer"),
  puntosContainer: $("puntosContainer"),
  perfilContainer: $("perfilContainer"),
  valoracionesContainer: $("valoracionesContainer"),
  auxContainer: $("auxContainer"),
  categoriaSelect: $("categoria"),
  filterCategoria: $("filterCategoria"),
  filterText: $("filterText"),
  filterTipo: $("filterTipo"),
  publicacionesCount: $("publicacionesCount"),
  categoriasCount: $("categoriasCount"),
  editPublicacionId: $("editPublicacionId"),
  btnCancelEdit: $("btnCancelEdit")
};

// Funciones auxiliares para gestionar la sesión del usuario en localStorage
function getToken() { return localStorage.getItem(tokenKey); }
function getUser() {
  try { return JSON.parse(localStorage.getItem(userKey)); }
  catch { return null; }
}
function setSession(token, usuario) {
  localStorage.setItem(tokenKey, token);
  if (usuario) localStorage.setItem(userKey, JSON.stringify(usuario));
  updateSessionStatus();
}
function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  updateSessionStatus();
}
function showMessage(message, isError = false) {
  els.messageBox.textContent = message;
  els.messageBox.style.color = isError ? "#dc2626" : "#16a34a";
}

function showToast(message, isError = false) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${isError ? "error" : "success"}`;

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 1500);
}

function setValoracionFormEnabled(enabled) {
  $("valoracionPublicacion").readOnly = true;
  $("valoracionReceptor").readOnly = true;

  els.valoracionPuntuacion.disabled = !enabled;
  els.valoracionComentario.disabled = !enabled;
  els.btnRegistrarValoracion.disabled = !enabled;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-ES");
}
function categoriaNombre(id) {
  const categoria = categoriasCache.find((c) =>
    Number(c.idCategoria ?? c.IdCategoria) === Number(id)
  );

  if (!categoria) {
    return `Categoría ${id}`;
  }

  return categoria.nombre ?? categoria.Nombre ?? `Categoría ${id}`;
}
function updateSessionStatus() {
  const token = getToken();
  const user = getUser();
  if (token) {
    const nombre = user?.nombre ? `${user.nombre} ${user.apellidos || ""}`.trim() : "usuario autenticado";
    els.sessionStatus.textContent = `Sesión iniciada como ${nombre}.`;
    els.btnLogout.classList.remove("hidden");
    els.btnShowLogin.classList.add("hidden");
    els.btnShowRegister.classList.add("hidden");
  } else {
    els.sessionStatus.textContent = "No has iniciado sesión.";
    els.btnLogout.classList.add("hidden");
    els.btnShowLogin.classList.remove("hidden");
    els.btnShowRegister.classList.remove("hidden");
  }
}

//Función genérica para hacer peticiones HTTP a la API REST con manejo de errores y token de autenticación
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return await response.json();
}

function requireLogin() {
  if (!getToken()) {
    showMessage("Debes iniciar sesión para realizar esta operación.", true);
    showToast("Debes iniciar sesión para realizar esta operación.", true);
    return false;
  }
  return true;
}

els.btnShowLogin.addEventListener("click", () => {
  els.loginForm.classList.toggle("hidden");
  els.registerForm.classList.add("hidden");
});
els.btnShowRegister.addEventListener("click", () => {
  els.registerForm.classList.toggle("hidden");
  els.loginForm.classList.add("hidden");
});
els.btnLogout.addEventListener("click", () => {
  clearSession();
  showMessage("Sesión cerrada correctamente.");
  showToast("Sesión cerrada correctamente.");
  renderPerfil();
  renderPuntos([]);
  els.solicitudesContainer.innerHTML = "";
  els.valoracionesContainer.innerHTML = "";
  els.auxContainer.innerHTML = "";
});
els.btnScrollPublicaciones.addEventListener("click", () => $("publicacionesSection").scrollIntoView({ behavior: "smooth" }));
els.btnScrollPanel.addEventListener("click", () => $("panel").scrollIntoView({ behavior: "smooth" }));

// Inicio de sesión mediante autenticación Firebase, obteniendo el token JWT del backend y almacenándolo en localStorage 
// para su uso en futuras peticiones a la API REST
els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = { email: $("loginEmail").value.trim(), password: $("loginPassword").value };
  try {
    const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(body) });
    setSession(data.idToken, data.usuario);
    showMessage("Inicio de sesión correcto.");
    showToast("Inicio de sesión correcto.");
    els.loginForm.reset();
    els.loginForm.classList.add("hidden");
    await Promise.allSettled([cargarPublicaciones(), cargarPerfil(), cargarPuntos(), cargarSolicitudes(), cargarValoraciones()]);
  } catch (error) {
    showMessage("Error al iniciar sesión. Revisa las credenciales.", true);
    showToast("Error al iniciar sesión. Revisa las credenciales.", true);
    console.error(error);
  }
});

// Registro de nuevo usuario en la plataforma mediante autenticación Firebase, obteniendo el token JWT del backend y 
// almacenándolo en localStorage para su uso en futuras peticiones a la API REST
els.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    nombre: $("registerNombre").value.trim(),
    apellidos: $("registerApellidos").value.trim(),
    email: $("registerEmail").value.trim(),
    password: $("registerPassword").value,
    zona: $("registerZona").value.trim()
  };
  try {
    const data = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(body) });
    setSession(data.idToken, data.usuario);
    showMessage("Registro completado correctamente.");
    showToast("Registro completado correctamente.");
    els.registerForm.reset();
    els.registerForm.classList.add("hidden");
    await Promise.allSettled([cargarPublicaciones(), cargarPerfil(), cargarPuntos()]);
  } catch (error) {
    showMessage("Error al registrar usuario.", true);
    showToast("Error al registrar usuario.", true);
    console.error(error);
  }
});

async function cargarCategorias() {
  try {
    categoriasCache = await apiRequest("/categorias");

    els.categoriasContainer.innerHTML = "";
    els.categoriaSelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    els.filterCategoria.innerHTML = '<option value="">Todas las categorías</option>';

    categoriasCache.forEach((categoria) => {
      const idCategoria = categoria.idCategoria ?? categoria.IdCategoria;
      const nombre = categoria.nombre ?? categoria.Nombre ?? `Categoría ${idCategoria}`;

      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = nombre;
      els.categoriasContainer.appendChild(chip);

      const optionForm = document.createElement("option");
      optionForm.value = idCategoria;
      optionForm.textContent = nombre;
      els.categoriaSelect.appendChild(optionForm);

      const optionFilter = document.createElement("option");
      optionFilter.value = idCategoria;
      optionFilter.textContent = nombre;
      els.filterCategoria.appendChild(optionFilter);
    });

    els.categoriasCount.textContent = categoriasCache.length;
  } catch (error) {
    showMessage("No se pudieron cargar las categorías.", true);
    showToast("No se pudieron cargar las categorías.", true);
    console.error(error);
  }
}

// Carga y representación de las publicaciones, con filtros de texto, categoría y tipo de publicación. 
// Se muestran botones de acción según el estado de la publicación y la relación del usuario con ella 
// (creador, participante aceptado, etc.)
async function cargarPublicaciones() {
  try {
    publicacionesCache = await apiRequest("/publicaciones");
    renderPublicaciones();
  } catch (error) {
    showMessage("No se pudieron cargar las publicaciones.", true);
    showToast("No se pudieron cargar las publicaciones.", true);
    console.error(error);
  }
}

function soyUsuarioAceptado(publicacion) {
  const user = getUser();
  if (!user) return false;

  return solicitudesCache.some((s) =>
    Number(s.idPublicacion) === Number(publicacion.idPublicacion) &&
    Number(s.idUsuarioSolicitante) === Number(user.idUsuario) &&
    s.estado === "ACEPTADA"
  );
}

function renderPublicaciones() {
  const texto = els.filterText.value.trim().toLowerCase();
  const categoria = els.filterCategoria.value;
  const tipo = els.filterTipo.value;
  const user = getUser();

  let publicaciones = publicacionesCache;
  if (texto) {
    publicaciones = publicaciones.filter((p) =>
      `${p.titulo} ${p.descripcion} ${p.zona}`.toLowerCase().includes(texto)
    );
  }
  if (categoria) publicaciones = publicaciones.filter((p) => Number(p.idCategoria) === Number(categoria));
  if (tipo) publicaciones = publicaciones.filter((p) => p.tipoPublicacion === tipo);

  els.publicacionesContainer.innerHTML = "";
  els.publicacionesCount.textContent = publicacionesCache.length;

  if (!publicaciones.length) {
    els.publicacionesContainer.innerHTML = '<article class="card"><p>No hay publicaciones disponibles con los filtros actuales.</p></article>';
    return;
  }

  publicaciones.forEach((p) => {
    const soyCreador = user && Number(user.idUsuario) === Number(p.idUsuarioCreador);
    const puedoValorar =
      p.estado === "COMPLETADA" &&
      (
        (p.tipoPublicacion === "SOLICITUD" && soyCreador) ||
        (p.tipoPublicacion === "OFERTA" && soyUsuarioAceptado(p))
      );
    const card = document.createElement("article");
    card.className = "publicacion-card";
    card.innerHTML = `
      <h3>${escapeHtml(p.titulo)}</h3>
      <p>${escapeHtml(p.descripcion)}</p>
      <div class="badges">
        <span class="badge">${escapeHtml(p.tipoPublicacion)}</span>
        <span class="badge estado">${escapeHtml(p.estado)}</span>
        <span class="badge puntos">${p.puntosEstimados} puntos</span>
        <span class="badge muted">${escapeHtml(categoriaNombre(p.idCategoria))}</span>
      </div>
      <p><strong>Zona:</strong> ${escapeHtml(p.zona || "No indicada")}</p>
      <p><strong>Fecha:</strong> ${formatDate(p.fechaServicio)}</p>
      <p><strong>ID publicación:</strong> ${p.idPublicacion} · <strong>Creador:</strong> ${p.idUsuarioCreador}</p>
      <div class="card-actions">
        ${getToken() && !soyCreador ? `<button class="btn btn-small btn-success" data-action="solicitar" data-id="${p.idPublicacion}">Solicitar participación</button>` : ""}
        ${soyCreador ? `<button class="btn btn-small btn-warning" data-action="editar" data-id="${p.idPublicacion}">Editar</button>` : ""}
        ${soyCreador ? `<button class="btn btn-small btn-danger" data-action="eliminar" data-id="${p.idPublicacion}">Eliminar</button>` : ""}
        ${puedoValorar ? `<button class="btn btn-small btn-primary" data-action="valorar" data-id="${p.idPublicacion}">Valorar usuario</button>` : ""}      </div>
    `;
    els.publicacionesContainer.appendChild(card);
  });
}

els.publicacionesContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  const publicacion = publicacionesCache.find((p) => Number(p.idPublicacion) === id);
  if (!publicacion) return;

  if (action === "solicitar") await solicitarParticipacion(id);
  if (action === "editar") prepararEdicion(publicacion);
  if (action === "eliminar") await eliminarPublicacion(id);
  if (action === "valorar") prepararValoracion(publicacion);
});

// Prepara el formulario de valoración para registrar una nueva valoración asociada a una publicación completada.
function prepararValoracion(publicacion) {
  const solicitudAceptada = solicitudesCache.find((s) =>
    Number(s.idPublicacion) === Number(publicacion.idPublicacion) &&
    s.estado === "ACEPTADA"
  );

  if (!solicitudAceptada) {
    showMessage("No existe una solicitud aceptada para esta publicación.", true);
    showToast("No existe una solicitud aceptada para esta publicación.", true);
    return;
  }

  $("valoracionPublicacion").value = publicacion.idPublicacion;
  if (publicacion.tipoPublicacion === "SOLICITUD") {
    $("valoracionReceptor").value = solicitudAceptada.idUsuarioSolicitante;
  } else if (publicacion.tipoPublicacion === "OFERTA") {
    $("valoracionReceptor").value = publicacion.idUsuarioCreador;
  }

  setValoracionFormEnabled(true);

  const nombreSolicitante = `${solicitudAceptada.nombreSolicitante || ""} ${solicitudAceptada.apellidosSolicitante || ""}`.trim();

  showMessage(
    `Valoración preparada para la publicación "${publicacion.titulo}" y el usuario ${nombreSolicitante || solicitudAceptada.idUsuarioSolicitante}.`
  );
  showToast(`Valoración preparada para la publicación "${publicacion.titulo}" y el usuario ${nombreSolicitante || solicitudAceptada.idUsuarioSolicitante}.`);

  $("valoracionPuntuacion").focus();

  els.valoracionForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Permite al usuario solicitar participación en una publicación, enviando un mensaje al creador. 
// Solo disponible para usuarios autenticados. Después de enviar la solicitud, se recargan las solicitudes 
// para actualizar su estado en la interfaz.
async function solicitarParticipacion(idPublicacion) {
  if (!requireLogin()) return;
  const mensaje = prompt("Mensaje para el creador de la publicación:", "Hola, me gustaría participar en esta ayuda.");
  if (mensaje === null) return;
  try {
    await apiRequest("/solicitudesparticipacion", {
      method: "POST",
      body: JSON.stringify({ mensaje, idPublicacion })
    });
    showMessage("Solicitud enviada correctamente.");
    showToast("Solicitud enviada correctamente.");
    await cargarSolicitudes();
  } catch (error) {
    showMessage("No se pudo enviar la solicitud.", true);
    showToast("No se pudo enviar la solicitud.", true);
    console.error(error);
  }
}

function prepararEdicion(p) {
  els.editPublicacionId.value = p.idPublicacion;
  $("titulo").value = p.titulo || "";
  $("descripcion").value = p.descripcion || "";
  $("tipoPublicacion").value = p.tipoPublicacion || "SOLICITUD";
  $("categoria").value = p.idCategoria || "";
  $("zona").value = p.zona || "";
  $("puntosEstimados").value = p.puntosEstimados || 0;
  $("estadoPublicacion").value = p.estado || "ABIERTA";
  $("fechaServicio").value = p.fechaServicio ? p.fechaServicio.slice(0, 16) : "";
  els.btnCancelEdit.classList.remove("hidden");
  els.publicacionForm.scrollIntoView({ behavior: "smooth" });
}

function limpiarFormularioPublicacion() {
  els.publicacionForm.reset();
  els.editPublicacionId.value = "";
  els.btnCancelEdit.classList.add("hidden");
}

els.btnCancelEdit.addEventListener("click", limpiarFormularioPublicacion);

els.publicacionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireLogin()) {
    limpiarFormularioPublicacion();
    return;
  }

  const id = els.editPublicacionId.value;
  const fechaServicioValue = $("fechaServicio").value;
  const body = {
    idPublicacion: id ? Number(id) : 0,
    tipoPublicacion: $("tipoPublicacion").value,
    titulo: $("titulo").value.trim(),
    descripcion: $("descripcion").value.trim(),
    zona: $("zona").value.trim(),
    puntosEstimados: Number($("puntosEstimados").value),
    estado: $("estadoPublicacion").value,
    fechaServicio: fechaServicioValue ? `${fechaServicioValue}:00` : null,
    idCategoria: Number($("categoria").value)
  };

  try {
    if (id) {
      await apiRequest(`/publicaciones/${id}`, { method: "PUT", body: JSON.stringify(body) });
      showMessage("Publicación actualizada correctamente.");
      showToast("Publicación actualizada correctamente.");
    } else {
      delete body.idPublicacion;
      await apiRequest("/publicaciones", { method: "POST", body: JSON.stringify(body) });
      showMessage("Publicación creada correctamente.");
      showToast("Publicación creada correctamente.");
    }
    limpiarFormularioPublicacion();
    await cargarSolicitudes();
    await cargarPublicaciones();
    await cargarValoraciones();

    if (id && body.estado === "COMPLETADA") {
      const publicacionActualizada = publicacionesCache.find((p) =>
        Number(p.idPublicacion) === Number(id)
      );

      if (publicacionActualizada) {
        prepararValoracion(publicacionActualizada);
      }
    }
  } catch (error) {
    showMessage("Error al guardar la publicación.", true);
    showToast("Error al guardar la publicación.", true);
    console.error(error);
  }
});

async function eliminarPublicacion(id) {
  if (!requireLogin()) return;
  if (!confirm("¿Seguro que quieres eliminar esta publicación?")) return;
  try {
    await apiRequest(`/publicaciones/${id}`, { method: "DELETE" });
    showMessage("Publicación eliminada correctamente.");
    showToast("Publicación eliminada correctamente.");
    await cargarPublicaciones();
  } catch (error) {
    showMessage("No se pudo eliminar la publicación.", true);
    showToast("No se pudo eliminar la publicación.", true);
    console.error(error);
  }
}

async function cargarSolicitudes() {
  if (!getToken()) {
    els.solicitudesContainer.innerHTML = '<article class="card"><p>Inicia sesión para ver tus solicitudes.</p></article>';
    return;
  }
  try {
    solicitudesCache = await apiRequest("/solicitudesparticipacion");
    renderSolicitudes(solicitudesCache);
  } catch (error) {
    els.solicitudesContainer.innerHTML = '<article class="card"><p>No se pudieron cargar las solicitudes.</p></article>';
    console.error(error);
  }
}

function renderSolicitudes(solicitudes) {
  els.solicitudesContainer.innerHTML = "";
  if (!solicitudes.length) {
    els.solicitudesContainer.innerHTML = '<article class="card"><p>No hay solicitudes asociadas a tu usuario.</p></article>';
    return;
  }
  solicitudes.forEach((s) => {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <h3>${escapeHtml(s.tituloPublicacion || `Solicitud #${s.idSolicitud}`)}</h3>
      <p>${escapeHtml(s.mensaje || "Sin mensaje")}</p>
      <div class="badges"><span class="badge estado">${escapeHtml(s.estado)}</span><span class="badge muted">Publicación ${s.idPublicacion}</span></div>
      <p><strong>Solicitante:</strong> ${
        escapeHtml(
          `${s.nombreSolicitante || ""} ${s.apellidosSolicitante || ""}`.trim()
          || `Usuario ${s.idUsuarioSolicitante}`
        )
      }</p>
      <p><strong>Fecha:</strong> ${formatDate(s.fechaSolicitud)}</p>
      <div class="card-actions">
        <button class="btn btn-small btn-success" data-solicitud="aceptada" data-id="${s.idSolicitud}">Aceptar</button>
        <button class="btn btn-small btn-warning" data-solicitud="rechazada" data-id="${s.idSolicitud}">Rechazar</button>
        <button class="btn btn-small btn-danger" data-solicitud="cancelar" data-id="${s.idSolicitud}">Cancelar</button>
      </div>
    `;
    els.solicitudesContainer.appendChild(card);
  });
}

els.solicitudesContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-solicitud]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.solicitud;
  if (action === "cancelar") return cancelarSolicitud(id);
  return actualizarSolicitud(id, action === "aceptada" ? "ACEPTADA" : "RECHAZADA");
});

async function actualizarSolicitud(id, estado) {
  // Solo el creador de la publicación puede aceptar o rechazar solicitudes, pero verificamos que el usuario esté logueado antes de hacer la petición
  if (!requireLogin()) return;
  try {
    await apiRequest(`/solicitudesparticipacion/${id}`, {
      method: "PUT",
      body: JSON.stringify({ idSolicitud: id, estado })
    });
    showMessage(`Solicitud ${estado.toLowerCase()} correctamente.`);
    showToast(`Solicitud ${estado.toLowerCase()} correctamente.`);
    await cargarSolicitudes();
    await cargarPublicaciones();
  } catch (error) {
    showMessage("No se pudo actualizar la solicitud. Solo el creador de la publicación puede aceptarla o rechazarla.", true);
    showToast("No se pudo actualizar la solicitud. Solo el creador de la publicación puede aceptarla o rechazarla.", true);
    console.error(error);
  }
}

async function cancelarSolicitud(id) {
  if (!requireLogin()) return;
  if (!confirm("¿Cancelar esta solicitud?")) return;
  try {
    await apiRequest(`/solicitudesparticipacion/${id}`, { method: "DELETE" });
    showMessage("Solicitud cancelada correctamente.");
    showToast("Solicitud cancelada correctamente.");
    await cargarSolicitudes();
    await cargarPublicaciones();
  } catch (error) {
    showMessage("No se pudo cancelar la solicitud. Solo el solicitante puede cancelarla.", true);
    showToast("No se pudo cancelar la solicitud. Solo el solicitante puede cancelarla.", true);
    console.error(error);
  }
}

// Consulta y actualización del perfil del usuario autenticado. Si el usuario no ha iniciado sesión, 
// se muestra un mensaje indicándolo.
async function cargarPerfil() {
  const user = getUser();
  if (!getToken() || !user?.idUsuario) {
    renderPerfil();
    return;
  }
  try {
    const perfil = await apiRequest(`/usuarios/${user.idUsuario}`);
    localStorage.setItem(userKey, JSON.stringify({ ...user, ...perfil }));
    renderPerfil(perfil);
  } catch (error) {
    renderPerfil(user);
    console.error(error);
  }
}

function renderPerfil(perfil = getUser()) {
  if (!perfil) {
    els.perfilContainer.innerHTML = '<p>Inicia sesión para consultar tu perfil.</p>';
    return;
  }
  els.perfilContainer.innerHTML = `
    <div class="info-row"><strong>ID</strong><span>${perfil.idUsuario}</span></div>
    <div class="info-row"><strong>Nombre</strong><span>${escapeHtml(perfil.nombre || "")}</span></div>
    <div class="info-row"><strong>Email</strong><span>${escapeHtml(perfil.email || "")}</span></div>
    <div class="info-row"><strong>Zona</strong><span>${escapeHtml(perfil.zona || "")}</span></div>
    <div class="info-row"><strong>Puntos</strong><span>${perfil.saldoPuntos ?? 0}</span></div>
    <div class="info-row"><strong>Reputación</strong><span>${perfil.reputacionMedia ?? 0}</span></div>
  `;
  $("perfilNombre").value = perfil.nombre || "";
  $("perfilApellidos").value = perfil.apellidos || "";
  $("perfilTelefono").value = perfil.telefono || "";
  $("perfilZona").value = perfil.zona || "";
  $("perfilDescripcion").value = perfil.descripcion || "";
}

els.perfilForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = getUser();
  if (!requireLogin() || !user?.idUsuario) return;
  const body = {
    idUsuario: user.idUsuario,
    nombre: $("perfilNombre").value.trim(),
    apellidos: $("perfilApellidos").value.trim(),
    telefono: $("perfilTelefono").value.trim(),
    fotoPerfil: user.fotoPerfil || null,
    zona: $("perfilZona").value.trim(),
    descripcion: $("perfilDescripcion").value.trim()
  };
  try {
    await apiRequest(`/usuarios/${user.idUsuario}`, { method: "PUT", body: JSON.stringify(body) });
    showMessage("Perfil actualizado correctamente.");
    showToast("Perfil actualizado correctamente.");
    await cargarPerfil();
  } catch (error) {
    showMessage("No se pudo actualizar el perfil.", true);
    showToast("No se pudo actualizar el perfil.", true);
    console.error(error);
  }
});

// Obtiene los movimientos de puntos asociados al usuario autenticado y los muestra en la interfaz. 
// Si el usuario no ha iniciado sesión, se muestra un mensaje indicándolo. Cada movimiento muestra su tipo, 
// cantidad de puntos y fecha. También se muestra el saldo actual de puntos del usuario.
async function cargarPuntos() {
  if (!getToken()) {
    renderPuntos([]);
    return;
  }
  try {
    const movimientos = await apiRequest("/movimientopuntos");
    renderPuntos(movimientos);
  } catch (error) {
    els.puntosContainer.innerHTML = '<p>No se pudieron cargar los movimientos.</p>';
    console.error(error);
  }
}

function renderPuntos(movimientos) {
  const user = getUser();
  if (!user) {
    els.puntosContainer.innerHTML = '<p>Inicia sesión para consultar tus puntos.</p>';
    return;
  }
  const rows = movimientos.map((m) => `
    <div class="info-row"><strong>${escapeHtml(m.tipoMovimiento)}</strong><span>${m.cantidad} puntos · ${formatDate(m.fechaMovimiento)}</span></div>
  `).join("");
  els.puntosContainer.innerHTML = `
    <div class="info-row"><strong>Saldo actual</strong><span>${user.saldoPuntos ?? 0}</span></div>
    ${rows || '<p>No hay movimientos registrados para este usuario.</p>'}
  `;
}

async function cargarValoraciones() {
  if (!getToken()) {
    els.valoracionesContainer.innerHTML = '<article class="card"><p>Inicia sesión para consultar valoraciones.</p></article>';
    return;
  }
  try {
    const valoraciones = await apiRequest("/valoraciones");
    renderValoraciones(valoraciones);
  } catch (error) {
    els.valoracionesContainer.innerHTML = '<article class="card"><p>No se pudieron cargar las valoraciones.</p></article>';
    console.error(error);
  }
}

function renderValoraciones(valoraciones) {
  els.valoracionesContainer.innerHTML = "";
  if (!valoraciones.length) {
    els.valoracionesContainer.innerHTML = '<article class="card"><p>No hay valoraciones asociadas a tu usuario.</p></article>';
    return;
  }
  valoraciones.forEach((v) => {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <h3>${escapeHtml(v.tituloPublicacion || `Valoración #${v.idValoracion}`)}</h3>
      <div class="badges">
        <span class="badge puntos">${v.puntuacion}/5</span>
        <span class="badge muted">Valoración #${v.idValoracion}</span>
      </div>
      <p>${escapeHtml(v.comentario || "Sin comentario")}</p>
      <p><strong>Emisor:</strong> ${
        escapeHtml(`${v.nombreEmisor || ""} ${v.apellidosEmisor || ""}`.trim() || `Usuario ${v.idUsuarioEmisor}`)
      }</p>
      <p><strong>Receptor:</strong> ${
        escapeHtml(`${v.nombreReceptor || ""} ${v.apellidosReceptor || ""}`.trim() || `Usuario ${v.idUsuarioReceptor}`)
      }</p>
      <p><strong>Fecha:</strong> ${formatDate(v.fechaValoracion)}</p>
    `;
    els.valoracionesContainer.appendChild(card);
  });
}

els.valoracionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const body = {
    puntuacion: Number($("valoracionPuntuacion").value),
    comentario: $("valoracionComentario").value.trim(),
    idPublicacion: Number($("valoracionPublicacion").value),
    idUsuarioReceptor: Number($("valoracionReceptor").value)
  };
  try {
    await apiRequest("/valoraciones", { method: "POST", body: JSON.stringify(body) });
    showMessage("Valoración registrada correctamente.");
    showToast("Valoración registrada correctamente.");
    els.valoracionForm.reset();
    setValoracionFormEnabled(false);
    await cargarValoraciones();
    await cargarPuntos();
    await cargarPerfil();
  } catch (error) {
    showMessage("No se pudo registrar la valoración.", true);
    showToast("No se pudo registrar la valoración.", true);
    console.error(error);
  }
});

// Funcionalidades exclusivas para administradores: gestión de usuarios, roles y categorías. 
// Solo los usuarios con rol de administrador pueden acceder a estas funcionalidades.
function esAdmin() {
  const user = getUser();
  return Number(user?.idRol) === 1;
}
async function cargarUsuarios() {
  if (!requireLogin()) return;

  if (!esAdmin()) {
    els.auxContainer.innerHTML = "";
    showMessage("Solo los administradores pueden consultar usuarios.", true);
    showToast("Solo los administradores pueden consultar usuarios.", true);
    return;
  }

  try {
    const usuarios = await apiRequest("/usuarios");
    renderUsuariosAdmin(usuarios);
  } catch (error) {
    showMessage("No se pudieron cargar los usuarios.", true);
    showToast("No se pudieron cargar los usuarios.", true);
    console.error(error);
  }
}
async function cargarRoles() {
  if (!requireLogin()) return;

  if (!esAdmin()) {
    els.auxContainer.innerHTML = "";
    showMessage("Solo los administradores pueden consultar roles.", true);
    showToast("Solo los administradores pueden consultar roles.", true);
    return;
  }

  try {
    const roles = await apiRequest("/roles");
    renderTable(roles, ["idRol", "nombreRol"]);
  } catch (error) {
    showMessage("No se pudieron cargar los roles.", true);
    showToast("No se pudieron cargar los roles.", true);
    console.error(error);
  }
}
function renderTable(rows, columns) {
  if (!rows.length) {
    els.auxContainer.innerHTML = '<div class="card"><p>No hay datos disponibles.</p></div>';
    return;
  }
  els.auxContainer.innerHTML = `
    <table>
      <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function renderUsuariosAdmin(usuarios) {
  els.auxContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>Activo</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${usuarios.map((u) => `
          <tr>
            <td>${u.idUsuario}</td>
            <td>${escapeHtml(`${u.nombre || ""} ${u.apellidos || ""}`.trim())}</td>
            <td>${escapeHtml(u.email || "")}</td>
            <td>${u.idRol === 1 ? "Administrador" : "Usuario"}</td>
            <td>${u.activo ? "Sí" : "No"}</td>
            <td>
              <button class="btn btn-small ${u.activo ? "btn-danger" : "btn-success"}"
                data-user-estado="${u.idUsuario}"
                data-activo="${!u.activo}">
                ${u.activo ? "Bloquear" : "Activar"}
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  els.auxContainer.querySelectorAll("[data-user-estado]").forEach((btn) => {
    btn.addEventListener("click", () =>
      cambiarEstadoUsuario(btn.dataset.userEstado, btn.dataset.activo === "true")
    );
  });
}

function renderAdminCategorias() {
  if (!esAdmin()) {
    els.auxContainer.innerHTML = "";
    showMessage("Solo los administradores pueden gestionar categorías.", true);
    showToast("Solo los administradores pueden gestionar categorías.", true);
    return;
  }

  els.auxContainer.innerHTML = `
    <div class="card">
      <h3>Gestión de categorías</h3>

      <form id="adminCategoriaForm" class="mini-form">
        <input type="text" id="adminCategoriaNombre" placeholder="Nombre de categoría" required />
        <input type="text" id="adminCategoriaDescripcion" placeholder="Descripción" />
        <button type="submit" class="btn btn-primary full">Añadir categoría</button>
      </form>

      <hr style="margin: 1rem 0;">

      ${categoriasCache.map((c) => `
        <div class="info-row">
          <strong>${escapeHtml(c.nombre ?? c.Nombre)}</strong>
          <span>
            ${escapeHtml(c.descripcion ?? c.Descripcion ?? "")}
            <button class="btn btn-small btn-danger" data-delete-categoria="${c.idCategoria ?? c.IdCategoria}">
              Eliminar
            </button>
          </span>
        </div>
      `).join("")}
    </div>
  `;

  $("adminCategoriaForm").addEventListener("submit", crearCategoriaAdmin);

  els.auxContainer.querySelectorAll("[data-delete-categoria]").forEach((btn) => {
    btn.addEventListener("click", () => eliminarCategoriaAdmin(btn.dataset.deleteCategoria));
  });
}

async function crearCategoriaAdmin(event) {
  event.preventDefault();

  if (!esAdmin()) return;

  const body = {
    nombre: $("adminCategoriaNombre").value.trim(),
    descripcion: $("adminCategoriaDescripcion").value.trim()
  };

  try {
    await apiRequest("/categorias", {
      method: "POST",
      body: JSON.stringify(body)
    });

    showMessage("Categoría creada correctamente.");
    showToast("Categoría creada correctamente.");
    await cargarCategorias();
    renderAdminCategorias();
  } catch (error) {
    showMessage("No se pudo crear la categoría.", true);
    showToast("No se pudo crear la categoría.", true);
    console.error(error);
  }
}

async function eliminarCategoriaAdmin(idCategoria) {
  if (!esAdmin()) return;

  if (!confirm("¿Seguro que quieres eliminar esta categoría?")) return;

  try {
    await apiRequest(`/categorias/${idCategoria}`, {
      method: "DELETE"
    });

    showMessage("Categoría eliminada correctamente.");
    showToast("Categoría eliminada correctamente.");
    await cargarCategorias();
    await cargarPublicaciones();
    renderAdminCategorias();
  } catch (error) {
    showMessage("No se pudo eliminar la categoría. Puede tener publicaciones asociadas.", true);
    showToast("No se pudo eliminar la categoría. Puede tener publicaciones asociadas.", true);
    console.error(error);
  }
}

async function cambiarEstadoUsuario(idUsuario, activo) {
  if (!esAdmin()) return;

  if (!confirm(activo ? "¿Activar este usuario?" : "¿Bloquear este usuario?")) return;

  try {
    await apiRequest(`/usuarios/${idUsuario}/estado`, {
      method: "PUT",
      body: JSON.stringify({ idUsuario: Number(idUsuario), activo })
    });

    showMessage(activo ? "Usuario activado correctamente." : "Usuario bloqueado correctamente.");
    showToast(activo ? "Usuario activado correctamente." : "Usuario bloqueado correctamente.");
    await cargarUsuarios();
  } catch (error) {
    showMessage("No se pudo cambiar el estado del usuario.", true);
    showToast("No se pudo cambiar el estado del usuario.", true);
    console.error(error);
  }
}

els.filterText.addEventListener("input", renderPublicaciones);
els.filterCategoria.addEventListener("change", renderPublicaciones);
els.filterTipo.addEventListener("change", renderPublicaciones);
$("btnClearFilters").addEventListener("click", () => {
  els.filterText.value = "";
  els.filterCategoria.value = "";
  els.filterTipo.value = "";
  renderPublicaciones();
});
$("btnLoadCategorias").addEventListener("click", cargarCategorias);
$("btnLoadPublicaciones").addEventListener("click", cargarPublicaciones);
$("btnLoadSolicitudes").addEventListener("click", cargarSolicitudes);
$("btnLoadPerfil").addEventListener("click", cargarPerfil);
$("btnLoadPuntos").addEventListener("click", cargarPuntos);
$("btnLoadValoraciones").addEventListener("click", cargarValoraciones);
$("btnLoadUsuarios").addEventListener("click", cargarUsuarios);
$("btnLoadRoles").addEventListener("click", cargarRoles);
$("btnLoadAdminCategorias").addEventListener("click", renderAdminCategorias);

//Inicialización de la aplicación: se actualiza el estado de sesión, se cargan las categorías y publicaciones 
// para mostrar en la interfaz. También se cargan las solicitudes, puntos y valoraciones asociadas al usuario autenticado, 
// aunque no es necesario esperar a que se completen para mostrar la interfaz principal.
document.addEventListener("DOMContentLoaded", async () => {
  updateSessionStatus();
  setValoracionFormEnabled(false);
  await cargarCategorias();
  await cargarPublicaciones();
  renderPerfil();
  await Promise.allSettled([cargarSolicitudes(), cargarPuntos(), cargarValoraciones()]);
});
