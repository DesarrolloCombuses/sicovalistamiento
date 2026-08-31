(function () {
  "use strict";

  const ACTIVIDADES = {
    1: "Fugas del motor",
    2: "Tension correas",
    3: "Ajuste de tapas",
    4: "Aceite motor / transmision / frenos",
    5: "Agua limpiaparabrisas",
    6: "Aditivos radiador",
    7: "Filtros humedos y secos",
    8: "Bateria",
    9: "Llantas",
    10: "Equipo de carretera",
    11: "Botiquin"
  };

  // Alistamientos adicionales del programa oficial de Calisoft (NO reglamentarios).
  // IMPORTANTE: por ahora solo se capturan en la interfaz; TODAVIA NO se transmiten
  // a SICOV, porque falta confirmar como los recibe el API (ver captura del payload).
  const ACTIVIDADES_ADICIONALES = {
    a1: "Limpia Brisas",
    a2: "Cinturones de Seguridad",
    a3: "Luces Externas, Internas y Direccionales",
    a4: "Espejos y Retrovisores"
  };

  const VEHICULOS = [
    ["EQS895", "703"], ["KTN914", "707"], ["KTO209", "708"], ["KTO226", "709"],
    ["KTN494", "705"], ["WDX622", "714"], ["KTN495", "715"], ["NNN476", "710"],
    ["EQR790", "717"], ["NNN528", "718"], ["TRN968", "719"], ["NNN561", "720"],
    ["EQS922", "721"], ["NNN559", "722"], ["FVY522", "723"], ["NNN893", "724"],
    ["EQS921", "725"], ["NNN638", "726"], ["NNN680", "727"], ["KTN496", "728"],
    ["NNL187", "729"], ["FWL901", "730"], ["EQS897", "731"], ["NNN709", "732"],
    ["WMR005", "733"], ["NNN758", "734"], ["KTN493", "735"], ["NNN785", "736"],
    ["NNN894", "737"], ["NNN895", "738"], ["NNN896", "739"], ["NNN897", "740"],
    ["NNN898", "741"], ["FVY442", "742"], ["NNN892", "743"], ["WDY573", "744"],
    ["NNN891", "745"], ["KTN491", "746"], ["WMQ966", "747"], ["FWK018", "748"],
    ["FWM088", "749"], ["NNN593", "750"], ["NNN890", "751"], ["WMR096", "752"],
    ["NNN889", "753"], ["NNN888", "754"], ["NNN887", "755"], ["PXK160", "756"],
    ["KTO059", "757"], ["KTO271", "758"], ["SWX672", "759"]
  ];

  const ACTIVITY_TO_COLUMN = {
    1: "FugasMotor",
    2: "TensionCorreas",
    3: "AjusteTapas",
    4: "NivelesAceite",
    5: "Limpiaparabrisas",
    6: "AditivosRadiador",
    7: "Filtros",
    8: "Bateria",
    9: "Llantas",
    10: "EquipoCarretera",
    11: "Botiquin"
  };

  const TOTAL_ACTIVIDADES = Object.keys(ACTIVIDADES).length;
  let supabase;

  const state = {
    vehiculos: [],
    vehiculosMap: {},
    conductoresMap: {},
    selectedVehicle: null,
    existingDailyRecord: null,
    driverValidated: false,
    debounceTimer: null,
    isSubmitting: false,
    online: true
  };

  const DOM = {};
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      cacheDom();
      bindEvents();
      handleNetworkChange();
      initSupabase();
      const internetOk = await ensureInternet("No hay conexion a internet.");
      if (!internetOk) return;
      crearCheckboxes();
      crearCheckboxesAdicionales();
      actualizarGuiaFormulario();
      await cargarConductoresCsv();
      await cargarVehiculos();
      DOM.placaSelect.focus();
    } catch (error) {
      console.error(error);
      alert("Configuracion invalida del sistema. Revisa config.js.");
    }
  }

  function cacheDom() {
    DOM.placaSelect = document.getElementById("placaSelect");
    DOM.placasList = document.getElementById("placasList");
    DOM.placaMsg = document.getElementById("placaMsg");
    DOM.doc = document.getElementById("doc");
    DOM.nombre = document.getElementById("nombre");
    DOM.lista = document.getElementById("lista");
    DOM.listaAdicionales = document.getElementById("listaAdicionales");
    DOM.selectAllAdicionalesBtn = document.getElementById("selectAllAdicionalesBtn");
    DOM.submitBtn = document.getElementById("submitBtn");
    DOM.vehicleCard = document.getElementById("vehicleCard");
    DOM.displayPlaca = document.getElementById("displayPlaca");
    DOM.loadingModal = document.getElementById("loadingModal");
    DOM.loadingStatus = document.getElementById("loadingStatus");
    DOM.successModal = document.getElementById("successModal");
    DOM.errorModal = document.getElementById("errorModal");
    DOM.errorMessage = document.getElementById("errorMessage");
    DOM.closeSuccessBtn = document.getElementById("closeSuccessBtn");
    DOM.closeErrorBtn = document.getElementById("closeErrorBtn");
    DOM.networkAlert = document.getElementById("networkAlert");
    DOM.dailyAlert = document.getElementById("dailyAlert");
    DOM.selectAllBtn = document.getElementById("selectAllBtn");
    DOM.checkCounter = document.getElementById("checkCounter");
    DOM.stepVehicle = document.getElementById("stepVehicle");
    DOM.stepDriver = document.getElementById("stepDriver");
    DOM.stepChecklist = document.getElementById("stepChecklist");
    DOM.guideProgress = document.getElementById("guideProgress");
    DOM.guideText = document.getElementById("guideText");
  }

  function bindEvents() {
    DOM.placaSelect.addEventListener("input", onSeleccionarPlaca);
    DOM.placaSelect.addEventListener("blur", onBlurPlaca);
    DOM.doc.addEventListener("input", manejarBusquedaConductor);
    DOM.submitBtn.addEventListener("click", enviar);
    DOM.selectAllBtn.addEventListener("click", toggleSeleccionarTodas);
    DOM.selectAllAdicionalesBtn.addEventListener("click", toggleSeleccionarTodasAdicionales);
    DOM.closeSuccessBtn.addEventListener("click", cerrarModales);
    DOM.closeErrorBtn.addEventListener("click", cerrarModales);
    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);
  }

  function initSupabase() {
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
      throw new Error("Falta configurar datos de conexion en config.js.");
    }
    supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  }

  async function cargarVehiculos() {
    state.vehiculos = VEHICULOS.map(function (v) {
      return { placa: v[0], interno: v[1] };
    }).sort(function (a, b) {
      return a.placa.localeCompare(b.placa);
    });

    // El mapa se indexa por PLACA (identificador que usa SICOV). El interno se
    // conserva en cada entrada solo para guardarlo en la base; no se muestra.
    state.vehiculosMap = {};
    DOM.placasList.innerHTML = "";
    DOM.placaSelect.value = "";

    state.vehiculos.forEach(function (v) {
      state.vehiculosMap[v.placa] = { interno: v.interno, placa: v.placa };
      const option = document.createElement("option");
      option.value = v.placa;
      DOM.placasList.appendChild(option);
    });
  }

  async function cargarConductoresCsv() {
    const url = window.SUPABASE_CONFIG.conductoresCsvUrl;
    if (!url) throw new Error("Falta conductoresCsvUrl en config.js.");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo descargar CSV de conductores.");

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    if (!rows || rows.length === 0) throw new Error("CSV de conductores vacio.");

    const headers = rows[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
    const idxCedula = headers.indexOf("cedula");
    const idxNombre = headers.indexOf("nombre");
    const idxStatus = headers.indexOf("status");
    if (idxCedula < 0 || idxNombre < 0 || idxStatus < 0) {
      throw new Error("El CSV debe incluir columnas: cedula, nombre, status.");
    }

    state.conductoresMap = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const cedula = sanitizeDigits(row[idxCedula]);
      const nombre = String(row[idxNombre] || "").trim();
      const status = String(row[idxStatus] || "").trim().toUpperCase();
      if (!cedula || !nombre) continue;
      state.conductoresMap[cedula] = { cedula: cedula, nombre: nombre, status: status };
    }
  }

  function crearCheckboxes() {
    DOM.lista.innerHTML = "";
    Object.keys(ACTIVIDADES).forEach(function (id) {
      const checkItem = document.createElement("label");
      checkItem.className = "check-item";
      checkItem.innerHTML =
        "<span>" + escapeHtml(ACTIVIDADES[id]) + "</span>" +
        '<input class="form-check-input" type="checkbox" name="actividad" value="' + id + '">';
      const checkbox = checkItem.querySelector('input[name="actividad"]');
      checkbox.addEventListener("change", actualizarGuiaFormulario);
      DOM.lista.appendChild(checkItem);
    });
  }

  function crearCheckboxesAdicionales() {
    DOM.listaAdicionales.innerHTML = "";
    Object.keys(ACTIVIDADES_ADICIONALES).forEach(function (id) {
      const checkItem = document.createElement("label");
      checkItem.className = "check-item";
      checkItem.innerHTML =
        "<span>" + escapeHtml(ACTIVIDADES_ADICIONALES[id]) + "</span>" +
        '<input class="form-check-input" type="checkbox" name="adicional" value="' + id + '">';
      DOM.listaAdicionales.appendChild(checkItem);
    });
  }

  function obtenerAdicionalesSeleccionadas() {
    return Array.from(document.querySelectorAll('input[name="adicional"]:checked'))
      .map(function (cb) { return cb.value; });
  }

  async function onSeleccionarPlaca() {
    const placa = normalizarPlaca(DOM.placaSelect.value);
    const vehiculo = state.vehiculosMap[placa];
    if (!vehiculo) {
      state.selectedVehicle = null;
      state.existingDailyRecord = null;
      DOM.vehicleCard.style.display = "none";
      setDailyAlert(null);
      // Solo avisa cuando ya escribio una placa completa (6+) que no existe;
      // mientras escribe (parcial) no molesta.
      setPlacaMsg(placa.length >= 6 ? "Placa no registrada en la flota." : "", "error");
      actualizarGuiaFormulario();
      return;
    }

    // Al reconocer la placa, normaliza el campo a la forma canonica (mayusculas).
    DOM.placaSelect.value = vehiculo.placa;
    state.selectedVehicle = vehiculo;
    setPlacaMsg("Placa reconocida.", "ok");
    DOM.displayPlaca.textContent = vehiculo.placa;
    DOM.vehicleCard.style.display = "grid";
    await validarAlistamientoDiario(vehiculo.interno);
    actualizarGuiaFormulario();
    setTimeout(function () { DOM.doc.focus(); }, 60);
  }

  // Al salir del campo, si quedo texto que no corresponde a una placa real, avisa.
  function onBlurPlaca() {
    const placa = normalizarPlaca(DOM.placaSelect.value);
    if (placa && !state.vehiculosMap[placa]) {
      setPlacaMsg("Placa no registrada en la flota.", "error");
    }
  }

  // mensaje bajo el campo de placa. tipo: "error" | "ok" | "" (limpia)
  function setPlacaMsg(texto, tipo) {
    DOM.placaMsg.textContent = texto || "";
    DOM.placaMsg.className = "input-msg" + (texto && tipo ? " " + tipo : "");
    if (texto && tipo === "error") {
      DOM.placaSelect.classList.add("is-invalid");
    } else {
      DOM.placaSelect.classList.remove("is-invalid");
    }
  }

  function manejarBusquedaConductor(e) {
    clearTimeout(state.debounceTimer);
    DOM.nombre.value = "";
    state.driverValidated = false;
    DOM.doc.value = sanitizeDigits(e.target.value);
    actualizarGuiaFormulario();
    if (DOM.doc.value.length < 4) return;

    state.debounceTimer = setTimeout(function () {
      buscarConductor(DOM.doc.value);
    }, 280);
  }

  async function buscarConductor(cedula) {
    const conductor = state.conductoresMap[cedula];
    if (!conductor) {
      state.driverValidated = false;
      actualizarGuiaFormulario();
      showToast("Documento no registrado.", "error");
      return;
    }
    if (String(conductor.status || "").toUpperCase() !== "ENABLED") {
      state.driverValidated = false;
      actualizarGuiaFormulario();
      showToast("Conductor inactivo.", "warning");
      return;
    }
    DOM.nombre.value = conductor.nombre || "";
    state.driverValidated = !!DOM.nombre.value;
    actualizarGuiaFormulario();
    if (state.driverValidated) showToast("Conductor validado.", "success");
  }

  function obtenerActividadesSeleccionadas() {
    return Array.from(document.querySelectorAll('input[name="actividad"]:checked'))
      .map(function (cb) { return parseInt(cb.value, 10); });
  }

  function validarFormulario() {
    if (!state.selectedVehicle) {
      showToast("Paso 1: selecciona un vehiculo.", "warning");
      return false;
    }
    if (!DOM.doc.value.trim() || !DOM.nombre.value.trim() || !state.driverValidated) {
      showToast("Paso 2: valida un conductor activo.", "warning");
      return false;
    }
    if (obtenerActividadesSeleccionadas().length !== TOTAL_ACTIVIDADES) {
      showToast("Paso 3: debes marcar todas las actividades.", "warning");
      return false;
    }
    if (state.existingDailyRecord) {
      showToast("Este vehiculo ya tiene alistamiento en la jornada actual.", "warning");
      return false;
    }
    return true;
  }

  async function enviar() {
    if (state.isSubmitting) return;
    if (!validarFormulario()) return;

    // El candado se cierra ANTES de cualquier await. Si se cerrara despues, un
    // segundo clic entraria por la ventana que abren las llamadas de red de
    // abajo (el flag seguiria en false y el boton activo) y se enviarian dos
    // alistamientos a SICOV.
    state.isSubmitting = true;
    DOM.submitBtn.disabled = true;
    DOM.submitBtn.textContent = "Procesando...";
    mostrarModal("loading");
    setLoadingStatus("Verificando conexion...");

    const internetOk = await ensureInternet("Sin internet. No se puede enviar.");
    if (!internetOk) return cancelarEnvio();

    setLoadingStatus("Verificando alistamiento del dia...");
    const estadoDiario = await validarAlistamientoDiario(state.selectedVehicle.interno, true);
    if (estadoDiario === "DUPLICADO") {
      showToast("Este vehiculo ya fue alistado hoy.", "warning");
      return cancelarEnvio();
    }
    if (estadoDiario !== "LIBRE") {
      showToast("No se pudo verificar si el vehiculo ya fue alistado. Intenta de nuevo.", "error");
      return cancelarEnvio();
    }

    setLoadingStatus("Enviando a SICOV...");
    const actividades = obtenerActividadesSeleccionadas();
    const flags = {
      FugasMotor: 0, TensionCorreas: 0, AjusteTapas: 0, NivelesAceite: 0,
      Limpiaparabrisas: 0, AditivosRadiador: 0, Filtros: 0, Bateria: 0,
      Llantas: 0, EquipoCarretera: 0, Botiquin: 0
    };
    actividades.forEach(function (id) {
      const col = ACTIVITY_TO_COLUMN[id];
      if (col) flags[col] = 1;
    });

    const payloadSicov = {
      placa: state.selectedVehicle.placa,
      interno: state.selectedVehicle.interno,
      tipoIdentificacionResponsable: 1,
      numeroIdentificacionResponsable: DOM.doc.value.trim(),
      nombreResponsable: DOM.nombre.value.trim(),
      tipoIdentificacionConductor: 1,
      numeroIdentificacionConductor: DOM.doc.value.trim(),
      nombresConductor: DOM.nombre.value.trim(),
      detalleActividades: "Alistamiento Web - Sistema Movil",
      actividades: actividades
    };

    // Alistamientos adicionales: se capturan pero NO se transmiten todavia.
    // Cuando confirmemos el formato del API (captura del payload de Calisoft),
    // aqui se agregara el campo correcto a payloadSicov. Ejemplo tentativo:
    //   payloadSicov.actividadesAdicionales = adicionales;
    const adicionales = obtenerAdicionalesSeleccionadas();
    void adicionales;

    const resultadoSicov = await enviarASicov(payloadSicov);

    const registro = {
      FechaHora: new Date().toISOString(),
      NumeroInterno: state.selectedVehicle.interno,
      Placa: state.selectedVehicle.placa,
      Documento: DOM.doc.value.trim(),
      NombreConductor: DOM.nombre.value.trim(),
      FugasMotor: flags.FugasMotor,
      TensionCorreas: flags.TensionCorreas,
      AjusteTapas: flags.AjusteTapas,
      NivelesAceite: flags.NivelesAceite,
      Limpiaparabrisas: flags.Limpiaparabrisas,
      AditivosRadiador: flags.AditivosRadiador,
      Filtros: flags.Filtros,
      Bateria: flags.Bateria,
      Llantas: flags.Llantas,
      EquipoCarretera: flags.EquipoCarretera,
      Botiquin: flags.Botiquin,
      DetalleActividades: "Alistamiento Web - Sistema Movil",
      EstadoEnvio: resultadoSicov.ok ? "OK" : resultadoSicov.estado,
      RespuestaSICOV: toShortText(resultadoSicov.respuesta),
      ErrorSheet: resultadoSicov.ok ? null : toShortText(resultadoSicov.error)
    };

    // Se guarda siempre, incluso si SICOV fallo: solo las filas con EstadoEnvio='OK'
    // cuentan como alistamiento; el resto queda como rastro para diagnostico.
    setLoadingStatus("Guardando registro...");
    const res = await supabase.from("preoperacionales_sicov").insert(registro);

    if (!resultadoSicov.ok) {
      finalizarEnvioConError(mensajeErrorSicov(resultadoSicov));
      return;
    }
    if (res.error) {
      finalizarEnvioConError(res.error.message);
      return;
    }

    document.getElementById("okPlaca").textContent = registro.Placa;
    document.getElementById("okNombre").textContent = registro.NombreConductor;
    document.getElementById("okFecha").textContent = new Date().toLocaleString("es-CO");
    document.getElementById("okSicov").textContent = extraerIdAlistamiento(resultadoSicov.respuesta);
    resetFormulario();
    mostrarModal("success");

    state.isSubmitting = false;
    DOM.submitBtn.textContent = "Enviar Alistamiento";
    actualizarGuiaFormulario();
  }

  // Devuelve "LIBRE" | "DUPLICADO" | "ERROR". Nunca "LIBRE" cuando no se pudo
  // verificar: un envio duplicado en SICOV no se puede deshacer.
  async function validarAlistamientoDiario(interno, silent) {
    const internetOk = await ensureInternet("Sin internet para validar alistamiento diario.", true);
    if (!internetOk) {
      state.existingDailyRecord = null;
      setDailyAlert(null);
      actualizarGuiaFormulario();
      return "ERROR";
    }

    const rango = getOperationalWindowBogota();
    const res = await supabase
      .from("preoperacionales_sicov")
      .select("FechaHora,NombreConductor,Placa")
      .eq("NumeroInterno", interno)
      .eq("EstadoEnvio", "OK")
      .gte("FechaHora", rango.startIso)
      .lt("FechaHora", rango.endIso)
      .order("FechaHora", { ascending: false })
      .limit(1);

    if (res.error) {
      state.existingDailyRecord = null;
      setDailyAlert(null);
      if (!silent) showToast("No se pudo validar el estado diario del vehiculo.", "error");
      actualizarGuiaFormulario();
      return "ERROR";
    }

    if (res.data && res.data.length > 0) {
      state.existingDailyRecord = res.data[0];
      setDailyAlert("✓ Este vehiculo YA tiene alistamiento hecho hoy. Ultimo: " + formatDateTime(state.existingDailyRecord.FechaHora) + ".");
      actualizarGuiaFormulario();
      return "DUPLICADO";
    }

    state.existingDailyRecord = null;
    setDailyAlert(null);
    actualizarGuiaFormulario();
    return "LIBRE";
  }

  // Dia calendario en hora Bogota (medianoche a medianoche). Colombia no tiene
  // horario de verano, asi que el offset fijo de -5 es exacto todo el ano.
  // 00:00 Bogota (UTC-5) = 05:00 UTC del mismo dia.
  function getOperationalWindowBogota() {
    const bogotaOffsetMs = 5 * 60 * 60 * 1000;
    const nowUtcMs = Date.now();
    const pseudoBogota = new Date(nowUtcMs - bogotaOffsetMs);
    const year = pseudoBogota.getUTCFullYear();
    const month = pseudoBogota.getUTCMonth();
    const day = pseudoBogota.getUTCDate();

    const startUtcMs = Date.UTC(year, month, day, 5, 0, 0, 0);
    return {
      startIso: new Date(startUtcMs).toISOString(),
      endIso: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  function handleNetworkChange() {
    state.online = navigator.onLine;
    if (state.online) {
      DOM.networkAlert.classList.add("d-none");
      DOM.networkAlert.textContent = "";
    } else {
      DOM.networkAlert.classList.remove("d-none");
      DOM.networkAlert.textContent = "Sin internet. Verifica la conexion para consultar y enviar alistamientos.";
    }
  }

  async function ensureInternet(message, silent) {
    if (!navigator.onLine) {
      handleNetworkChange();
      if (!silent) showToast(message || "Sin internet.");
      return false;
    }
    const ok = await pingSupabase();
    if (!ok) {
      DOM.networkAlert.classList.remove("d-none");
      DOM.networkAlert.textContent = "No se pudo conectar con el servidor. Revisa internet y vuelve a intentar.";
      if (!silent) showToast(message || "Sin conexion con servidor.");
      return false;
    }
    DOM.networkAlert.classList.add("d-none");
    DOM.networkAlert.textContent = "";
    return true;
  }

  async function pingSupabase() {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 5000);
    try {
      await fetch(String(window.SUPABASE_CONFIG.url).replace(/\/+$/, "") + "/rest/v1/", {
        method: "GET",
        headers: { apikey: String(window.SUPABASE_CONFIG.anonKey || "") },
        signal: controller.signal
      });
      return true;
    } catch (_e) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // Suelta el candado cuando se aborta antes de enviar (sin modal de error).
  function cancelarEnvio() {
    cerrarModales();
    state.isSubmitting = false;
    DOM.submitBtn.textContent = "Enviar Alistamiento";
    actualizarGuiaFormulario();
  }

  function setLoadingStatus(text) {
    if (DOM.loadingStatus) DOM.loadingStatus.textContent = text;
  }

  // Saca el numero de radicado que devuelve SICOV, para mostrarlo como comprobante.
  function extraerIdAlistamiento(respuesta) {
    try {
      const j = JSON.parse(respuesta);
      const id = (j && j.sicovResponse && j.sicovResponse.idAlistamiento) || (j && j.idAlistamiento);
      return id ? String(id) : "Registrado";
    } catch (_e) {
      return "Registrado";
    }
  }

  function mensajeErrorSicov(resultado) {
    const detalle = resultado.error || resultado.respuesta || "";
    if (resultado.estado === "TIMEOUT") {
      return "SICOV no respondio a tiempo. El alistamiento PUEDE haber quedado registrado en SICOV. " +
        "Verifica en SICOV antes de reintentar, para no duplicarlo.";
    }
    return "No fue posible enviar a SICOV. El alistamiento NO quedo registrado. " + detalle;
  }

  function finalizarEnvioConError(msg) {
    state.isSubmitting = false;
    DOM.submitBtn.textContent = "Enviar Alistamiento";
    DOM.errorMessage.textContent = msg || "Error desconocido.";
    mostrarModal("error");
    actualizarGuiaFormulario();
  }

  function resetFormulario() {
    DOM.placaSelect.value = "";
    setPlacaMsg("");
    DOM.doc.value = "";
    DOM.nombre.value = "";
    DOM.vehicleCard.style.display = "none";
    state.selectedVehicle = null;
    state.existingDailyRecord = null;
    state.driverValidated = false;
    setDailyAlert(null);
    document.querySelectorAll('input[name="actividad"]').forEach(function (cb) { cb.checked = false; });
    document.querySelectorAll('input[name="adicional"]').forEach(function (cb) { cb.checked = false; });
  }

  function mostrarModal(tipo) {
    cerrarModales();
    if (tipo === "loading") DOM.loadingModal.style.display = "flex";
    if (tipo === "success") DOM.successModal.style.display = "flex";
    if (tipo === "error") DOM.errorModal.style.display = "flex";
  }

  function cerrarModales() {
    DOM.loadingModal.style.display = "none";
    DOM.successModal.style.display = "none";
    DOM.errorModal.style.display = "none";
  }

  function setDailyAlert(text) {
    if (!text) {
      DOM.dailyAlert.classList.add("d-none");
      DOM.dailyAlert.textContent = "";
      return;
    }
    DOM.dailyAlert.classList.remove("d-none");
    DOM.dailyAlert.textContent = text;
  }

  // tipo: "error" | "warning" | "success" | undefined (neutro)
  function showToast(message, tipo) {
    const toast = document.createElement("div");
    toast.className = "toast" + (tipo ? " " + tipo : "");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2800);
  }

  function toggleSeleccionarTodas() {
    const checks = document.querySelectorAll('input[name="actividad"]');
    const allSelected = obtenerActividadesSeleccionadas().length === TOTAL_ACTIVIDADES;
    checks.forEach(function (cb) { cb.checked = !allSelected; });
    actualizarGuiaFormulario();
  }

  function toggleSeleccionarTodasAdicionales() {
    const checks = document.querySelectorAll('input[name="adicional"]');
    const total = Object.keys(ACTIVIDADES_ADICIONALES).length;
    const allSelected = obtenerAdicionalesSeleccionadas().length === total;
    checks.forEach(function (cb) { cb.checked = !allSelected; });
  }

  function actualizarGuiaFormulario() {
    const hasVehicle = !!state.selectedVehicle;
    const hasDriver = !!state.driverValidated && !!DOM.doc.value.trim() && !!DOM.nombre.value.trim();
    const selectedCount = obtenerActividadesSeleccionadas().length;
    const fullChecklist = selectedCount === TOTAL_ACTIVIDADES;
    const bloqueadoPorDia = !!state.existingDailyRecord;

    DOM.checkCounter.textContent = selectedCount + "/" + TOTAL_ACTIVIDADES + " seleccionadas";
    DOM.selectAllBtn.textContent = fullChecklist ? "Desmarcar todas" : "Seleccionar todas";

    DOM.stepVehicle.className = "badge " + (hasVehicle ? "text-bg-success" : "text-bg-secondary");
    DOM.stepDriver.className = "badge " + (hasDriver ? "text-bg-success" : "text-bg-secondary");
    DOM.stepChecklist.className = "badge " + (fullChecklist ? "text-bg-success" : "text-bg-secondary");

    let completed = 0;
    if (hasVehicle) completed += 1;
    if (hasDriver) completed += 1;
    if (fullChecklist) completed += 1;

    DOM.guideProgress.style.width = Math.round((completed / 3) * 100) + "%";
    if (completed === 0) DOM.guideText.textContent = "1/3 Selecciona un vehiculo";
    if (completed === 1) DOM.guideText.textContent = hasVehicle ? "2/3 Valida el conductor" : "1/3 Selecciona un vehiculo";
    if (completed === 2) DOM.guideText.textContent = "3/3 Marca todas las actividades";
    if (completed === 3) DOM.guideText.textContent = "Formulario completo: listo para enviar";

    if (!state.isSubmitting) {
      DOM.submitBtn.disabled = bloqueadoPorDia || !(hasVehicle && hasDriver && fullChecklist);
    }
  }

  function sanitizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  // Normaliza la placa escrita o pegada: mayusculas y sin espacios ni signos.
  function normalizarPlaca(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function formatDateTime(value) {
    try {
      return new Date(value).toLocaleString("es-CO", { hour12: false });
    } catch (_e) {
      return String(value);
    }
  }

  function toShortText(value) {
    if (value == null) return null;
    const str = String(value);
    return str.length <= 900 ? str : str.slice(0, 900) + "...";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseCsv(text) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .filter(function (line) { return line.trim().length > 0; });

    return lines.map(function (line) {
      return line.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(function (cell) {
        const value = String(cell || "").trim();
        if (value.startsWith("\"") && value.endsWith("\"")) {
          return value.slice(1, -1).replace(/""/g, "\"");
        }
        return value;
      });
    });
  }

  async function enviarASicov(payload) {
    const url = String(window.SUPABASE_CONFIG.sicovDispatchUrl || "").trim();
    const key = String(window.SUPABASE_CONFIG.sicovDispatchKey || "").trim();
    const timeoutMs = Number(window.SUPABASE_CONFIG.sicovTimeoutMs || 25000);
    if (!url) return { ok: false, estado: "ERROR_CONFIG", error: "Falta configurar sicovDispatchUrl en config.js." };

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      if (key) {
        headers.apikey = key;
        headers.Authorization = "Bearer " + key;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const bodyText = await response.text();
      let bodyJson = null;
      try { bodyJson = JSON.parse(bodyText); } catch (_e) { bodyJson = null; }

      if (!response.ok) return { ok: false, estado: "ERROR_SICOV", respuesta: bodyText, error: "HTTP " + response.status + " " + response.statusText };
      if (bodyJson && (bodyJson.error || bodyJson.success === false || bodyJson.ok === false)) {
        return { ok: false, estado: "ERROR_SICOV", respuesta: bodyText, error: bodyJson.error || bodyJson.message || "Respuesta de error desde dispatch SICOV." };
      }
      return { ok: true, estado: "OK", respuesta: bodyText || "OK" };
    } catch (error) {
      const esTimeout = !!(error && error.name === "AbortError");
      return {
        ok: false,
        // TIMEOUT es ambiguo: SICOV pudo haber procesado el envio despues de que
        // el cliente abortó. No se puede asumir que el alistamiento no quedó.
        estado: esTimeout ? "TIMEOUT" : "ERROR_CONEXION",
        error: esTimeout ? "Timeout al enviar a SICOV." : String(error && error.message ? error.message : error)
      };
    } finally {
      clearTimeout(timer);
    }
  }
})();
