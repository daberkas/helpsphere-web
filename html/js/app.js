const API_URL = "https://api.daberkas.com/api";

const tokenKey = "helpsphere_token";

const btnShowLogin = document.getElementById("btnShowLogin");
const btnShowRegister = document.getElementById("btnShowRegister");
const btnLogout = document.getElementById("btnLogout");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const publicacionForm = document.getElementById("publicacionForm");

const messageBox = document.getElementById("messageBox");
const sessionStatus = document.getElementById("sessionStatus");

const categoriasContainer = document.getElementById("categoriasContainer");
const publicacionesContainer = document.getElementById("publicacionesContainer");
const categoriaSelect = document.getElementById("categoria");

const publicacionesCount = document.getElementById("publicacionesCount");
const categoriasCount = document.getElementById("categoriasCount");

function getToken() {
  return localStorage.getItem(tokenKey);
}

function setToken(token) {
  localStorage.setItem(tokenKey, token);
  updateSessionStatus();
}

function clearToken() {
  localStorage.removeItem(tokenKey);
  updateSessionStatus();
}

function showMessage(message, isError = false) {
  messageBox.textContent = message;
  messageBox.style.color = isError ? "#dc2626" : "#16a34a";
}

function updateSessionStatus() {
  const token = getToken();

  if (token) {
    sessionStatus.textContent = "Sesión iniciada. Puedes crear publicaciones.";
    btnLogout.classList.remove("hidden");
    btnShowLogin.classList.add("hidden");
    btnShowRegister.classList.add("hidden");
  } else {
    sessionStatus.textContent = "No has iniciado sesión.";
    btnLogout.classList.add("hidden");
    btnShowLogin.classList.remove("hidden");
    btnShowRegister.classList.remove("hidden");
  }
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Error HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

btnShowLogin.addEventListener("click", () => {
  loginForm.classList.toggle("hidden");
  registerForm.classList.add("hidden");
});

btnShowRegister.addEventListener("click", () => {
  registerForm.classList.toggle("hidden");
  loginForm.classList.add("hidden");
});

btnLogout.addEventListener("click", () => {
  clearToken();
  showMessage("Sesión cerrada correctamente.");
});

document.getElementById("btnScrollPublicaciones").addEventListener("click", () => {
  document.getElementById("publicacionesSection").scrollIntoView({
    behavior: "smooth"
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    email: document.getElementById("loginEmail").value,
    password: document.getElementById("loginPassword").value
  };

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(body)
    });

    setToken(data.idToken);
    showMessage("Inicio de sesión correcto.");
    loginForm.reset();
    loginForm.classList.add("hidden");
  } catch (error) {
    showMessage("Error al iniciar sesión. Revisa las credenciales.", true);
    console.error(error);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    nombre: document.getElementById("registerNombre").value,
    apellidos: document.getElementById("registerApellidos").value,
    email: document.getElementById("registerEmail").value,
    password: document.getElementById("registerPassword").value,
    zona: document.getElementById("registerZona").value
  };

  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(body)
    });

    setToken(data.idToken);
    showMessage("Registro completado correctamente.");
    registerForm.reset();
    registerForm.classList.add("hidden");
    await cargarPublicaciones();
  } catch (error) {
    showMessage("Error al registrar usuario.", true);
    console.error(error);
  }
});

async function cargarCategorias() {
  try {
    const categorias = await apiRequest("/categorias");

    categoriasContainer.innerHTML = "";
    categoriaSelect.innerHTML = "";

    categorias.forEach((categoria) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = categoria.nombre;
      categoriasContainer.appendChild(chip);

      const option = document.createElement("option");
      option.value = categoria.idCategoria;
      option.textContent = categoria.nombre;
      categoriaSelect.appendChild(option);
    });

    categoriasCount.textContent = categorias.length;
  } catch (error) {
    showMessage("No se pudieron cargar las categorías.", true);
    console.error(error);
  }
}

async function cargarPublicaciones() {
  try {
    const publicaciones = await apiRequest("/publicaciones");

    publicacionesContainer.innerHTML = "";

    if (!publicaciones.length) {
      publicacionesContainer.innerHTML = "<p>No hay publicaciones disponibles.</p>";
      publicacionesCount.textContent = "0";
      return;
    }

    publicaciones.forEach((publicacion) => {
      const card = document.createElement("article");
      card.className = "publicacion-card";

      card.innerHTML = `
        <h3>${publicacion.titulo}</h3>
        <p>${publicacion.descripcion}</p>

        <div class="badges">
          <span class="badge">${publicacion.tipoPublicacion}</span>
          <span class="badge estado">${publicacion.estado}</span>
          <span class="badge puntos">${publicacion.puntosEstimados} puntos</span>
        </div>

        <p><strong>Zona:</strong> ${publicacion.zona || "No indicada"}</p>
        <p><strong>Fecha:</strong> ${
          publicacion.fechaServicio
            ? new Date(publicacion.fechaServicio).toLocaleString("es-ES")
            : "Sin fecha"
        }</p>
      `;

      publicacionesContainer.appendChild(card);
    });

    publicacionesCount.textContent = publicaciones.length;
  } catch (error) {
    showMessage("No se pudieron cargar las publicaciones.", true);
    console.error(error);
  }
}

publicacionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!getToken()) {
    showMessage("Debes iniciar sesión para crear una publicación.", true);
    return;
  }

  const fechaServicioValue = document.getElementById("fechaServicio").value;

  const body = {
    tipoPublicacion: document.getElementById("tipoPublicacion").value,
    titulo: document.getElementById("titulo").value,
    descripcion: document.getElementById("descripcion").value,
    zona: document.getElementById("zona").value,
    puntosEstimados: Number(document.getElementById("puntosEstimados").value),
    estado: "ABIERTA",
    fechaCreacion: new Date().toISOString(),
    fechaServicio: fechaServicioValue
      ? new Date(fechaServicioValue).toISOString()
      : null,
    idUsuarioCreador: 1,
    idCategoria: Number(document.getElementById("categoria").value)
  };

  try {
    await apiRequest("/publicaciones", {
      method: "POST",
      body: JSON.stringify(body)
    });

    showMessage("Publicación creada correctamente.");
    publicacionForm.reset();
    await cargarPublicaciones();
  } catch (error) {
    showMessage("Error al crear la publicación.", true);
    console.error(error);
  }
});

document.getElementById("btnLoadCategorias").addEventListener("click", cargarCategorias);
document.getElementById("btnLoadPublicaciones").addEventListener("click", cargarPublicaciones);

document.addEventListener("DOMContentLoaded", async () => {
  updateSessionStatus();
  await cargarCategorias();
  await cargarPublicaciones();
});