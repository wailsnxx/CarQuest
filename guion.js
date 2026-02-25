// Elementos del DOM
const formularioInicio = document.getElementById('formularioInicio');
const formularioRegistro = document.getElementById('formularioRegistro');
const elementoFormularioInicio = document.getElementById('elementoFormularioInicio');
const elementoFormularioRegistro = document.getElementById('elementoFormularioRegistro');
const entradaContraseñaRegistro = document.getElementById('contraseñaRegistro');
const notificacion = document.getElementById('notificacion');

// Cambiar entre formularios de inicio y registro
function alternarFormularios() {
    formularioInicio.classList.toggle('activo');
    formularioRegistro.classList.toggle('activo');
    limpiarTodosErrores();
    elementoFormularioInicio.reset();
    elementoFormularioRegistro.reset();
}

// Alternar visibilidad de contraseña
function alternarVisibilidadContraseña(idEntrada) {
    const entrada = document.getElementById(idEntrada);
    entrada.type = entrada.type === 'password' ? 'text' : 'password';
}

// Mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'exito', duracion = 3000) {
    notificacion.textContent = mensaje;
    notificacion.className = `notificacion visible ${tipo}`;

    setTimeout(() => {
        notificacion.classList.add('ocultar');
        setTimeout(() => {
            notificacion.classList.remove('visible', 'ocultar');
        }, 300);
    }, duracion);
}

// Limpiar todos los errores
function limpiarTodosErrores() {
    document.querySelectorAll('.mensaje-error').forEach(elemento => {
        elemento.textContent = '';
    });
}

// Validaciones de Inicio de Sesión
function validarFormularioInicio(email, contraseña) {
    let esValido = true;
    limpiarTodosErrores();

    // Validar email
    if (!email) {
        document.getElementById('errorEmailInicio').textContent = 'El email es requerido';
        esValido = false;
    } else if (!esEmailValido(email)) {
        document.getElementById('errorEmailInicio').textContent = 'Ingresa un email válido';
        esValido = false;
    }

    // Validar contraseña
    if (!contraseña) {
        document.getElementById('errorContraseñaInicio').textContent = 'La contraseña es requerida';
        esValido = false;
    } else if (contraseña.length < 6) {
        document.getElementById('errorContraseñaInicio').textContent = 'La contraseña debe tener al menos 6 caracteres';
        esValido = false;
    }

    return esValido;
}

// Validaciones de Registro
function validarFormularioRegistro(nombre, email, contraseña, confirmarContraseña, aceptarTerminos) {
    let esValido = true;
    limpiarTodosErrores();

    // Validar nombre
    if (!nombre) {
        document.getElementById('errorNombreRegistro').textContent = 'El nombre es requerido';
        esValido = false;
    } else if (nombre.length < 3) {
        document.getElementById('errorNombreRegistro').textContent = 'El nombre debe tener al menos 3 caracteres';
        esValido = false;
    }

    // Validar email
    if (!email) {
        document.getElementById('errorEmailRegistro').textContent = 'El email es requerido';
        esValido = false;
    } else if (!esEmailValido(email)) {
        document.getElementById('errorEmailRegistro').textContent = 'Ingresa un email válido';
        esValido = false;
    }

    // Validar contraseña
    if (!contraseña) {
        document.getElementById('errorContraseñaRegistro').textContent = 'La contraseña es requerida';
        esValido = false;
    } else if (!esContraseñaValida(contraseña)) {
        document.getElementById('errorContraseñaRegistro').textContent = 'La contraseña no cumple con los requisitos';
        esValido = false;
    }

    // Validar confirmación de contraseña
    if (!confirmarContraseña) {
        document.getElementById('errorConfirmarContraseñaRegistro').textContent = 'Debe confirmar la contraseña';
        esValido = false;
    } else if (contraseña !== confirmarContraseña) {
        document.getElementById('errorConfirmarContraseñaRegistro').textContent = 'Las contraseñas no coinciden';
        esValido = false;
    }

    // Validar términos
    if (!aceptarTerminos) {
        mostrarNotificacion('Debes aceptar los términos y condiciones', 'advertencia');
        esValido = false;
    }

    return esValido;
}

// Validar formato de email
function esEmailValido(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Validar fortaleza de contraseña
function esContraseñaValida(contraseña) {
    const tieneLongitud = contraseña.length >= 8;
    const tieneMayuscula = /[A-Z]/.test(contraseña);
    const tieneMinuscula = /[a-z]/.test(contraseña);
    const tieneNumero = /[0-9]/.test(contraseña);

    return tieneLongitud && tieneMayuscula && tieneMinuscula && tieneNumero;
}

// Actualizar requisitos de contraseña en tiempo real
function actualizarRequisitosContraseña(contraseña) {
    const requisitos = {
        longitud: contraseña.length >= 8,
        mayuscula: /[A-Z]/.test(contraseña),
        minuscula: /[a-z]/.test(contraseña),
        numero: /[0-9]/.test(contraseña)
    };

    document.getElementById('req-longitud').classList.toggle('valido', requisitos.longitud);
    document.getElementById('req-mayuscula').classList.toggle('valido', requisitos.mayuscula);
    document.getElementById('req-minuscula').classList.toggle('valido', requisitos.minuscula);
    document.getElementById('req-numero').classList.toggle('valido', requisitos.numero);

    return requisitos;
}

// Event Listeners
entradaContraseñaRegistro.addEventListener('input', (evento) => {
    actualizarRequisitosContraseña(evento.target.value);
});

// ============================================================
// API helpers
// ============================================================
const API = '/api';

function guardarSesion(token, usuario) {
    localStorage.setItem('cq_token', token);
    localStorage.setItem('cq_usuario', JSON.stringify(usuario));
}

// Enviar formulario de Inicio de Sesión
elementoFormularioInicio.addEventListener('submit', async function(evento) {
    evento.preventDefault();

    const email = document.getElementById('emailInicio').value.trim();
    const contraseña = document.getElementById('contraseñaInicio').value;

    if (!validarFormularioInicio(email, contraseña)) return;

    mostrarNotificacion('Iniciando sesión...', 'info');

    try {
        const respuesta = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: contraseña })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mostrarNotificacion(datos.error || 'Error al iniciar sesión', 'error');
            return;
        }

        guardarSesion(datos.token, datos.usuario);
        mostrarNotificacion(`¡Bienvenido ${datos.usuario.nombre}!`, 'exito');

        setTimeout(() => {
            window.location.href = 'inici.html';
        }, 1000);
    } catch (err) {
        mostrarNotificacion('No se pudo conectar al servidor', 'error');
    }
});

// Enviar formulario de Registro
elementoFormularioRegistro.addEventListener('submit', async function(evento) {
    evento.preventDefault();

    const nombre = document.getElementById('nombreRegistro').value.trim();
    const email = document.getElementById('emailRegistro').value.trim();
    const contraseña = document.getElementById('contraseñaRegistro').value;
    const confirmarContraseña = document.getElementById('confirmarContraseñaRegistro').value;
    const aceptarTerminos = document.getElementById('aceptarTerminos').checked;

    if (!validarFormularioRegistro(nombre, email, contraseña, confirmarContraseña, aceptarTerminos)) return;

    mostrarNotificacion('Creando cuenta...', 'info');

    try {
        const respuesta = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password: contraseña })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mostrarNotificacion(datos.error || 'Error al registrarse', 'error');
            return;
        }

        guardarSesion(datos.token, datos.usuario);
        mostrarNotificacion(`¡Cuenta creada! Bienvenido ${datos.usuario.nombre}`, 'exito');
        elementoFormularioRegistro.reset();
        limpiarTodosErrores();

        setTimeout(() => {
            window.location.href = 'inici.html';
        }, 1500);
    } catch (err) {
        mostrarNotificacion('No se pudo conectar al servidor', 'error');
    }
});

// Inicializar requisitos de contraseña vacíos
actualizarRequisitosContraseña('');
