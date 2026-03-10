// app.js — Módulo compartido por todas las páginas de CarQuest
// Gestiona: autenticación, carga de usuario, ganar XP

const API = '/api';

function obtToken() { return localStorage.getItem('cq_token'); }
function obtUsuari() { return JSON.parse(localStorage.getItem('cq_usuario') || 'null'); }

// Redirige a login si no hay sesión activa
function requireAuth() {
    if (!obtToken() || !obtUsuari()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Calcula el rango y progreso según XP
function calcularRangInfo(xp) {
    const rangs = [
        { nom: 'Conductor Novato',     emoji: '🙂',  min: 0,     max: 500  },
        { nom: 'Conductor Intermedio',  emoji: '🚗',  min: 500,   max: 2000 },
        { nom: 'Piloto Seguro',        emoji: '🛣️', min: 2000,  max: 5000 },
        { nom: 'Piloto Experto',       emoji: '👑',  min: 5000,  max: 10000},
        { nom: 'Piloto Maestro',       emoji: '🏆',  min: 10000, max: 10000},
    ];
    const actual = rangs.findLast(r => xp >= r.min) || rangs[0];
    const seguent = rangs[rangs.indexOf(actual) + 1];
    const progres = seguent
        ? Math.round(((xp - actual.min) / (seguent.min - actual.min)) * 100)
        : 100;
    return { actual, seguent, progres };
}

// Actualiza todos los elementos de la UI con los datos del usuario
function actualitzarUIUsuari(user) {
    // Sidebar
    document.querySelectorAll('.js-sidebar-nom').forEach(el => el.textContent = user.nombre);
    document.querySelectorAll('.js-sidebar-info').forEach(el => el.textContent = `${user.xp} XP · Nivel ${user.nivel}`);
    // Genéricos
    document.querySelectorAll('.js-nom').forEach(el => el.textContent = user.nombre);
    document.querySelectorAll('.js-xp').forEach(el => el.textContent = user.xp);
    document.querySelectorAll('.js-rang').forEach(el => el.textContent = user.rang);
    document.querySelectorAll('.js-nivel').forEach(el => el.textContent = user.nivel);
    document.querySelectorAll('.js-monedes').forEach(el => el.textContent = user.monedes || 0);
    // Progreso
    const info = calcularRangInfo(user.xp);
    document.querySelectorAll('.js-progres-pct').forEach(el => el.textContent = `${info.progres}%`);
    document.querySelectorAll('.js-progres-fill').forEach(el => el.style.width = `${info.progres}%`);
    document.querySelectorAll('.js-rang-seguent').forEach(el => el.textContent = info.seguent ? info.seguent.nom : '¡Rango máximo!');
    document.querySelectorAll('.js-rang-actual').forEach(el => el.textContent = info.actual.nom);
}

// Carga el usuario desde la API y actualiza la UI
async function carregarUsuari() {
    const token = obtToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API}/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('cq_token');
            localStorage.removeItem('cq_usuario');
            window.location.href = 'index.html';
            return null;
        }
        const user = await res.json();
        localStorage.setItem('cq_usuario', JSON.stringify(user));
        actualitzarUIUsuari(user);
        return user;
    } catch (e) {
        const cached = obtUsuari();
        if (cached) actualitzarUIUsuari(cached);
        return cached;
    }
}

// Envía XP ganado a la base de datos
async function guanyarXP(xp, tipus, nom, puntuacio = 0) {
    const token = obtToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API}/user/xp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ xp_ganado: xp, tipus, nom, puntuacio })
        });
        const data = await res.json();
        const user = obtUsuari();
        if (user && data.xp !== undefined) {
            user.xp   = data.xp;
            user.nivel = data.nivel;
            user.rang  = data.rang;
            localStorage.setItem('cq_usuario', JSON.stringify(user));
            actualitzarUIUsuari(user);
        }
        return data;
    } catch (e) {
        console.error('Error ganando XP:', e);
        return null;
    }
}

// Cerrar sesión
function tancarSessio() {
    localStorage.removeItem('cq_token');
    localStorage.removeItem('cq_usuario');
    window.location.href = 'index.html';
}

// Inicializar sidebar móvil (común a todas las páginas)
function initSidebar() {
    const btn     = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (btn) {
        btn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }
}
