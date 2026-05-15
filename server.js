const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Cargar banco de preguntas DGT (2947 preguntas oficiales)
const todasPreguntes = JSON.parse(fs.readFileSync(path.join(__dirname, 'preguntes_dgt.json'), 'utf8'));

// Cargar normas de conducción
const NORMAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'normas.json'), 'utf8'));

// Normalizar formato: { pregunta, opcions:[a,b,c], correcta:0|1|2, explicacio }
const PREGUNTES_DGT = todasPreguntes
    .filter(q => q.question && q['a.'] && q['b.'] && q['c.'])
    .map(q => {
        const bits = q.correct.trim().split(' ').map(Number);
        const correcta = bits.indexOf(1);
        return {
            pregunta:   q.question,
            opcions:    [q['a.'], q['b.'], q['c.']],
            correcta:   correcta >= 0 ? correcta : 0,
            explicacio: q.explanation || '',
            img:        q.img || null
        };
    });

console.log(`📚 ${PREGUNTES_DGT.length} preguntas DGT cargadas`);

// ============================================================
// RETOS DIARIOS — configuración y helpers
// ============================================================
const RETOS_POOL = [
    // tipo: tests_totals — completar N tests (aprobados o suspendidos)
    { id:1, tipo:'tests_totals',  titulo:'Un test al día',      descripcion:'Completa 1 test de teoría',  objetivo:1, xp:50,  monedes:10, icona:'📋', link:'tests.html' },
    { id:2, tipo:'tests_totals',  titulo:'Sesión de tests',     descripcion:'Completa 3 tests de teoría', objetivo:3, xp:150, monedes:30, icona:'📝', link:'tests.html' },
    { id:3, tipo:'tests_totals',  titulo:'Estudiante dedicado', descripcion:'Completa 5 tests de teoría', objetivo:5, xp:250, monedes:60, icona:'📚', link:'tests.html' },
    // tipo: tests_aprovats — aprobar N tests
    { id:4, tipo:'tests_aprovats',titulo:'Primera victoria',    descripcion:'Aprueba 1 test de teoría',   objetivo:1, xp:100, monedes:25, icona:'🏆', link:'tests.html' },
    { id:5, tipo:'tests_aprovats',titulo:'Pasa los tests',      descripcion:'Aprueba 2 tests de teoría',  objetivo:2, xp:200, monedes:50, icona:'✅', link:'tests.html' },
    { id:6, tipo:'tests_aprovats',titulo:'Sin errores',         descripcion:'Aprueba 3 tests de teoría',  objetivo:3, xp:300, monedes:75, icona:'⭐', link:'tests.html' },
    // tipo: jocs — completar N minijuegos
    { id:7, tipo:'jocs',          titulo:'A jugar',             descripcion:'Completa 1 minijuego',       objetivo:1, xp:75,  monedes:15, icona:'🎯', link:'jocs.html' },
    { id:8, tipo:'jocs',          titulo:'Juega y aprende',     descripcion:'Completa 2 minijuegos',      objetivo:2, xp:100, monedes:20, icona:'🎮', link:'jocs.html' },
    { id:9, tipo:'jocs',          titulo:'Maestro del volante', descripcion:'Completa 3 minijuegos',      objetivo:3, xp:150, monedes:40, icona:'🏁', link:'jocs.html' },
];

// Selecciona 3 retos del día (uno de cada tipo) basándose en la fecha
function seleccionarRetosDia(fecha) {
    const day = Math.floor(new Date(fecha + 'T00:00:00Z').getTime() / 86400000);
    const idx = day % 3;
    return [RETOS_POOL[idx], RETOS_POOL[3 + idx], RETOS_POOL[6 + idx]];
}

// Actualiza el progreso de los retos activos del usuario según el tipo de actividad
async function actualizarProgresRetos(userId, tipus) {
    const avui = new Date().toISOString().slice(0, 10);
    const retosHoy = seleccionarRetosDia(avui);
    const completados = [];

    for (const reto of retosHoy) {
        const aplica =
            (reto.tipo === 'tests_totals'  && (tipus === 'test' || tipus === 'test_suspens')) ||
            (reto.tipo === 'tests_aprovats' && tipus === 'test') ||
            (reto.tipo === 'jocs'           && tipus === 'joc');
        if (!aplica) continue;

        // Crear fila si no existe
        await pool.query(
            `INSERT INTO user_retos_diarios (user_id, fecha, reto_config_id)
             VALUES ($1, $2, $3) ON CONFLICT (user_id, fecha, reto_config_id) DO NOTHING`,
            [userId, avui, reto.id]
        );

        // Leer estado actual
        const row = await pool.query(
            `SELECT progres, completat FROM user_retos_diarios
             WHERE user_id = $1 AND fecha = $2 AND reto_config_id = $3`,
            [userId, avui, reto.id]
        );
        if (!row.rows.length || row.rows[0].completat) continue;

        const nuevoProgres = row.rows[0].progres + 1;
        const ahoraCompletado = nuevoProgres >= reto.objetivo;

        await pool.query(
            `UPDATE user_retos_diarios
             SET progres = $1, completat = $2, recompensa_dada = $3
             WHERE user_id = $4 AND fecha = $5 AND reto_config_id = $6`,
            [nuevoProgres, ahoraCompletado, ahoraCompletado, userId, avui, reto.id]
        );

        if (ahoraCompletado) {
            await pool.query(
                `UPDATE users
                 SET xp      = xp + $1,
                     nivel   = GREATEST(1, FLOOR((xp + $1) / 1000) + 1),
                     rang    = update_rang(xp + $1),
                     monedes = monedes + $2
                 WHERE id = $3`,
                [reto.xp, reto.monedes, userId]
            );
            completados.push({ titulo: reto.titulo, xp: reto.xp, monedes: reto.monedes });
        }
    }

    // Comprobar bonus (todos los 3 retos completados)
    if (completados.length > 0) {
        const tot = await pool.query(
            `SELECT COUNT(*) FROM user_retos_diarios
             WHERE user_id = $1 AND fecha = $2 AND completat = true`,
            [userId, avui]
        );
        if (parseInt(tot.rows[0].count) >= 3) {
            const ins = await pool.query(
                `INSERT INTO user_bonus_diario (user_id, fecha)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id`,
                [userId, avui]
            );
            if (ins.rows.length > 0) {
                await pool.query(
                    `UPDATE users SET xp = xp + 300, monedes = monedes + 50 WHERE id = $1`,
                    [userId]
                );
                completados.push({ titulo: '¡Bonus diario!', xp: 300, monedes: 50, bonus: true });
            }
        }
    }

    return completados;
}

// Primera mitad dividida en tests de 30 preguntas
const meitat = Math.floor(PREGUNTES_DGT.length / 2);
const TESTS_NORMALS = [];
for (let i = 0; i < meitat; i += 30) {
    TESTS_NORMALS.push(PREGUNTES_DGT.slice(i, i + 30));
}
console.log(`📋 ${TESTS_NORMALS.length} tests numerados creados (${meitat} preguntas)`);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// PostgreSQL connection (Neon)
// ============================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }  // required for Neon
});

async function initDB() {
    // Columnas de racha que pueden no existir en la tabla users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS racha INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ultima_activitat DATE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS monedes INTEGER NOT NULL DEFAULT 0`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_retos_diarios (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER NOT NULL,
            fecha           DATE    NOT NULL,
            reto_config_id  INTEGER NOT NULL,
            progres         INTEGER NOT NULL DEFAULT 0,
            completat       BOOLEAN NOT NULL DEFAULT FALSE,
            recompensa_dada BOOLEAN NOT NULL DEFAULT FALSE,
            UNIQUE(user_id, fecha, reto_config_id)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_bonus_diario (
            user_id INTEGER NOT NULL,
            fecha   DATE    NOT NULL,
            PRIMARY KEY (user_id, fecha)
        )
    `);
    console.log('✅ Tablas y columnas listas');
}

pool.connect()
    .then(() => { console.log('✅ Conectado a PostgreSQL (Neon)'); return initDB(); })
    .catch(err => console.error('❌ Error conectando a la DB:', err.message));

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));  // serve HTML files

// ============================================================
// Auth middleware: verifica el JWT en rutas protegidas
// ============================================================
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];  // "Bearer <token>"
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
}

// ============================================================
// RUTAS DE AUTENTICACIÓN
// ============================================================

// POST /api/auth/register — crear cuenta nueva
app.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        // Verificar si el email ya existe
        const existe = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existe.rows.length > 0) {
            return res.status(409).json({ error: 'Este email ya está registrado' });
        }

        // Hashear contraseña
        const hash = await bcrypt.hash(password, 10);

        // Insertar usuario
        const result = await pool.query(
            'INSERT INTO users (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email, xp, nivel, rang',
            [nombre, email, hash]
        );

        const usuario = result.rows[0];
        const token = jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, usuario });
    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/auth/login — iniciar sesión
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        const usuario = result.rows[0];
        const coincide = await bcrypt.compare(password, usuario.password);

        if (!coincide) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        const token = jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // No enviamos el hash de la contraseña al cliente
        const { password: _, ...usuarioSinPassword } = usuario;
        res.json({ token, usuario: usuarioSinPassword });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// RUTAS DE USUARIO (protegidas)
// ============================================================

// GET /api/user/me — obtener datos del usuario actual
app.get('/api/user/me', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, email, xp, nivel, rang, avatar, monedes, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/user/xp — añadir XP al usuario (al completar test/juego)
app.post('/api/user/xp', verificarToken, async (req, res) => {
    const { xp_ganado, tipus, nom, puntuacio } = req.body;
    if (!xp_ganado || xp_ganado < 0) return res.status(400).json({ error: 'XP inválido' });

    try {
        const avui = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

        // Solo los tests (no juegos) actualizan la racha
        const esTest = tipus === 'test' || tipus === 'test_suspens';

        // Leer racha actual
        const userRes = await pool.query(
            'SELECT racha, ultima_activitat FROM users WHERE id = $1',
            [req.user.id]
        );
        const { racha: rachaActual, ultima_activitat } = userRes.rows[0];
        // pg v8 devuelve DATE como string "YYYY-MM-DD"
        const ultimaStr = ultima_activitat ? String(ultima_activitat).slice(0, 10) : null;

        let novaRacha = rachaActual;
        let novaUltimaActivitat = ultima_activitat;

        if (esTest) {
            if (ultimaStr === avui) {
                // Ya hizo un test hoy → racha sin cambio
                novaRacha = rachaActual;
            } else {
                const ahir = new Date(avui + 'T00:00:00Z');
                ahir.setUTCDate(ahir.getUTCDate() - 1);
                const ahirStr = ahir.toISOString().slice(0, 10);
                // Si hizo test ayer → +1; si lleva más días sin test → reinicia a 1
                novaRacha = ultimaStr === ahirStr ? rachaActual + 1 : 1;
            }
            novaUltimaActivitat = avui;
        }

        // Sumar XP, recalcular nivel/rang y actualizar racha
        const result = await pool.query(`
            UPDATE users
            SET
                xp               = xp + $1,
                nivel            = GREATEST(1, FLOOR((xp + $1) / 1000) + 1),
                rang             = update_rang(xp + $1),
                racha            = $3,
                ultima_activitat = $4
            WHERE id = $2
            RETURNING xp, nivel, rang, racha
        `, [xp_ganado, req.user.id, novaRacha, novaUltimaActivitat]);

        // Guardar registro de progreso si se pasa tipo y nombre
        if (tipus && nom) {
            await pool.query(
                'INSERT INTO progres (user_id, tipus, nom, puntuacio, completat) VALUES ($1, $2, $3, $4, true)',
                [req.user.id, tipus, nom, puntuacio || 0]
            );
        }

        // Actualizar progreso de retos diarios
        const retos_completados = await actualizarProgresRetos(req.user.id, tipus);

        // Re-leer XP final (puede incluir recompensas de retos)
        const final = await pool.query(
            'SELECT xp, nivel, rang, racha, monedes FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({ mensaje: `+${xp_ganado} XP ganados`, ...final.rows[0], retos_completados });
    } catch (err) {
        console.error('Error añadiendo XP:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// RUTAS DE RANKING
// ============================================================

// GET /api/ranking — top 10 usuarios por XP
app.get('/api/ranking', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nombre, xp, nivel, rang,
                   RANK() OVER (ORDER BY xp DESC) AS posicio
            FROM users
            ORDER BY xp DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error obteniendo ranking:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/ranking/meva-posicio — posición del usuario actual en el ranking
app.get('/api/ranking/meva-posicio', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT posicio, xp FROM (
                SELECT id, xp, RANK() OVER (ORDER BY xp DESC) AS posicio
                FROM users
            ) ranked
            WHERE id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/user/stats — estadísticas del usuario (tests, juegos completados)
app.get('/api/user/stats', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE tipus = 'test')          AS tests_aprovats,
                COUNT(*) FILTER (WHERE tipus = 'test_suspens')  AS tests_suspesos,
                COUNT(*) FILTER (WHERE tipus = 'joc'  AND completat = true)  AS jocs_completats
            FROM progres WHERE user_id = $1
        `, [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/user/streak — días consecutivos con actividad
app.get('/api/user/streak', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT racha, ultima_activitat FROM users WHERE id = $1',
            [req.user.id]
        );
        const { racha, ultima_activitat } = result.rows[0];

        // Si la última actividad no es hoy ni ayer, la racha se ha perdido
        const avui = new Date().toISOString().slice(0, 10);
        const ahir = new Date(avui + 'T00:00:00Z');
        ahir.setUTCDate(ahir.getUTCDate() - 1);
        const ahirStr = ahir.toISOString().slice(0, 10);
        const ultimaStr = ultima_activitat ? String(ultima_activitat).slice(0, 10) : null;

        const rachaActiva = (ultimaStr === avui || ultimaStr === ahirStr) ? racha : 0;
        res.json({ racha: rachaActiva });
    } catch (err) {
        console.error('Error calculando racha:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/user/avatar — guardar avatar seleccionado
app.post('/api/user/avatar', verificarToken, async (req, res) => {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: 'Avatar requerido' });
    try {
        await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.user.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// RUTAS DE RETOS DIARIOS
// ============================================================

// GET /api/retos-diarios — retos del día con progreso del usuario
app.get('/api/retos-diarios', verificarToken, async (req, res) => {
    const avui = new Date().toISOString().slice(0, 10);
    const userId = req.user.id;
    const retosHoy = seleccionarRetosDia(avui);

    try {
        // Crear filas si no existen
        for (const reto of retosHoy) {
            await pool.query(
                `INSERT INTO user_retos_diarios (user_id, fecha, reto_config_id)
                 VALUES ($1, $2, $3) ON CONFLICT (user_id, fecha, reto_config_id) DO NOTHING`,
                [userId, avui, reto.id]
            );
        }

        // Leer progreso actual
        const rows = await pool.query(
            `SELECT reto_config_id, progres, completat, recompensa_dada
             FROM user_retos_diarios WHERE user_id = $1 AND fecha = $2`,
            [userId, avui]
        );
        const progresMap = {};
        rows.rows.forEach(r => { progresMap[r.reto_config_id] = r; });

        const retos = retosHoy.map(reto => ({
            ...reto,
            progres:         progresMap[reto.id]?.progres          ?? 0,
            completat:       progresMap[reto.id]?.completat        ?? false,
            recompensa_dada: progresMap[reto.id]?.recompensa_dada  ?? false,
        }));

        const bonusDado = (await pool.query(
            `SELECT 1 FROM user_bonus_diario WHERE user_id = $1 AND fecha = $2`,
            [userId, avui]
        )).rows.length > 0;

        res.json({ fecha: avui, retos, bonus_dado: bonusDado });
    } catch (err) {
        console.error('Error en retos diarios:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// RUTAS DE PREGUNTES DGT
// ============================================================

// GET /api/preguntes?n=10&tema=all — devuelve N preguntas aleatorias
app.get('/api/preguntes', (req, res) => {
    const n = Math.min(parseInt(req.query.n) || 10, 30);
    const barrejades = [...PREGUNTES_DGT].sort(() => Math.random() - 0.5);
    res.json(barrejades.slice(0, n));
});

// GET /api/tests/list — lista de tests numerados
app.get('/api/tests/list', (req, res) => {
    res.json(TESTS_NORMALS.map((t, i) => ({ num: i + 1, total: t.length })));
});

// GET /api/tests/:num — preguntas de un test concreto
app.get('/api/tests/:num', (req, res) => {
    const num = parseInt(req.params.num);
    if (isNaN(num) || num < 1 || num > TESTS_NORMALS.length) {
        return res.status(404).json({ error: 'Test no encontrado' });
    }
    res.json(TESTS_NORMALS[num - 1]);
});

// ============================================================
// RUTAS DE TIEMPO DE REACCIÓN
// ============================================================

// POST /api/temps-reaccio/score — guarda la mejor puntuación
app.post('/api/temps-reaccio/score', verificarToken, async (req, res) => {
    const { avg_ms } = req.body;
    if (!avg_ms || avg_ms <= 0) return res.status(400).json({ error: 'Score inválido' });
    try {
        // Solo guardamos si es mejor que el anterior
        const existing = await pool.query(
            "SELECT puntuacio FROM progres WHERE user_id = $1 AND tipus = 'temps-reaccio' ORDER BY puntuacio ASC LIMIT 1",
            [req.user.id]
        );
        if (existing.rows.length === 0 || avg_ms < existing.rows[0].puntuacio) {
            await pool.query(
                "INSERT INTO progres (user_id, tipus, nom, puntuacio, completat) VALUES ($1, 'temps-reaccio', 'Temps de Reacció', $2, true)",
                [req.user.id, avg_ms]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('Error guardando score temps-reaccio:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/temps-reaccio/ranking — top 10 por menor tiempo medio
app.get('/api/temps-reaccio/ranking', async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.nombre, u.rang, u.avatar,
                   MIN(p.puntuacio) AS best_avg,
                   RANK() OVER (ORDER BY MIN(p.puntuacio) ASC) AS posicio
            FROM progres p
            JOIN users u ON u.id = p.user_id
            WHERE p.tipus = 'temps-reaccio' AND p.completat = true AND p.puntuacio > 0
            GROUP BY u.id, u.nombre, u.rang, u.avatar
            ORDER BY best_avg ASC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error obteniendo ranking temps-reaccio:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// RUTAS DE SENYAL CHALLENGE
// ============================================================

// GET /api/senyal-challenge/preguntes — 10 preguntas de identificación de señales con imagen
app.get('/api/senyal-challenge/preguntes', (req, res) => {
    const senyals = PREGUNTES_DGT.filter(q => {
        if (!q.img) return false;
        const t = (q.pregunta || '').toLowerCase();
        return t.includes('señal') || t.includes('indica esta') || t.includes('significa esta') ||
               t.includes('semáforo') || t.includes('marca vial') || t.includes('cartel') ||
               t.includes('panel') || t.includes('flecha');
    });
    const shuffled = [...senyals].sort(() => Math.random() - 0.5).slice(0, 10);
    res.json(shuffled);
});

// POST /api/senyal-challenge/score — guarda mejor puntuación (aciertos sobre 10)
app.post('/api/senyal-challenge/score', verificarToken, async (req, res) => {
    const { aciertos } = req.body;
    if (aciertos === undefined) return res.status(400).json({ error: 'Score inválido' });
    try {
        const existing = await pool.query(
            "SELECT puntuacio FROM progres WHERE user_id = $1 AND tipus = 'senyal-challenge' ORDER BY puntuacio DESC LIMIT 1",
            [req.user.id]
        );
        if (existing.rows.length === 0 || aciertos > existing.rows[0].puntuacio) {
            await pool.query(
                "INSERT INTO progres (user_id, tipus, nom, puntuacio, completat) VALUES ($1, 'senyal-challenge', 'Senyal Challenge', $2, true)",
                [req.user.id, aciertos]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('Error guardando score senyal:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/senyal-challenge/ranking — top 10 por más aciertos
app.get('/api/senyal-challenge/ranking', async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.nombre, u.avatar,
                   MAX(p.puntuacio) AS best_score,
                   RANK() OVER (ORDER BY MAX(p.puntuacio) DESC) AS posicio
            FROM progres p
            JOIN users u ON u.id = p.user_id
            WHERE p.tipus = 'senyal-challenge' AND p.completat = true
            GROUP BY u.id, u.nombre, u.avatar
            ORDER BY best_score DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// RUTAS DE ELIGE RESPONSABLE
// ============================================================

app.post('/api/elige-responsable/score', verificarToken, async (req, res) => {
    const { aciertos } = req.body;
    if (aciertos === undefined) return res.status(400).json({ error: 'Score inválido' });
    try {
        const existing = await pool.query(
            "SELECT puntuacio FROM progres WHERE user_id = $1 AND tipus = 'elige-responsable' ORDER BY puntuacio DESC LIMIT 1",
            [req.user.id]
        );
        if (existing.rows.length === 0 || aciertos > existing.rows[0].puntuacio) {
            await pool.query(
                "INSERT INTO progres (user_id, tipus, nom, puntuacio, completat) VALUES ($1, 'elige-responsable', 'Elige Responsable', $2, true)",
                [req.user.id, aciertos]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.get('/api/elige-responsable/ranking', async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.nombre, u.avatar,
                   MAX(p.puntuacio) AS best_score,
                   RANK() OVER (ORDER BY MAX(p.puntuacio) DESC) AS posicio
            FROM progres p JOIN users u ON u.id = p.user_id
            WHERE p.tipus = 'elige-responsable' AND p.completat = true
            GROUP BY u.id, u.nombre, u.avatar
            ORDER BY best_score DESC LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// CHATBOT — búsqueda en normas.json
// ============================================================


function normQ(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00bf\u00a1?!.,;:()'"-]/g, ' ');
}

const NORMAS_RULES = [
    {
        keys: ['velocidad','limite','maxima','minima','kmh','km/h','rapido','despacio','autopista','autovia','urbana','carretera'],
        get: function() {
            const v = NORMAS.velocidades_maximas;
            return '<strong>\u{1F697} L\u00EDmites de velocidad:</strong><br><br>' +
                '<strong>V\u00EDas urbanas:</strong><br>' +
                '\u2022 Un carril por sentido: <strong>' + v.vias_urbanas.un_carril_por_sentido + ' km/h</strong><br>' +
                '\u2022 Dos o m\u00E1s carriles: <strong>' + v.vias_urbanas.dos_o_mas_carriles_por_sentido + ' km/h</strong><br>' +
                '\u2022 Plataforma \u00FAnica: <strong>' + v.vias_urbanas.plataforma_unica + ' km/h</strong><br><br>' +
                '<strong>Carretera convencional:</strong><br>' +
                '\u2022 Turismos y autobuses: <strong>' + v.carreteras_convencionales.turismos + ' km/h</strong><br>' +
                '\u2022 Camiones: <strong>' + v.carreteras_convencionales.camiones + ' km/h</strong><br><br>' +
                '<strong>Autopistas y autov\u00EDas:</strong><br>' +
                '\u2022 Turismos: <strong>' + v.autovias_y_autopistas.turismos + ' km/h</strong><br>' +
                '\u2022 Autobuses: <strong>' + v.autovias_y_autopistas.autobuses + ' km/h</strong><br>' +
                '\u2022 Camiones: <strong>' + v.autovias_y_autopistas.camiones + ' km/h</strong><br>' +
                '\u2022 M\u00EDnima: <strong>' + v.minimas.autopistas_y_autovias + ' km/h</strong>';
        }
    },
    {
        keys: ['alcohol','tasa','alcoholemia','beber','copa','gramo','novel','profesional'],
        get: function() {
            const a = NORMAS.tasas_alcohol;
            const d = NORMAS.drogas;
            return '<strong>\u{1F37A} Tasas de alcoholemia:</strong><br><br>' +
                '\u2022 Generales: <strong>' + a.general_g_l_sangre + ' g/l</strong> (' + a.general_mg_l_aire + ' mg/l aire)<br>' +
                '\u2022 Noveles (2 a\u00F1os): <strong>' + a.noveles_g_l_sangre + ' g/l</strong> (' + a.noveles_mg_l_aire + ' mg/l)<br>' +
                '\u2022 Profesionales: <strong>' + a.profesionales_g_l_sangre + ' g/l</strong> (' + a.profesionales_mg_l_aire + ' mg/l)<br><br>' +
                '\u{1F6AB} Drogas: ' + d.norma_general + '<br>' +
                'Sanci\u00F3n: <strong>' + d.sancion_euros + '\u20AC</strong> y <strong>-' + d.perdida_puntos + ' puntos</strong><br><br>' +
                '\u26A0\uFE0F Lo m\u00E1s seguro: <strong>0,0 de alcohol</strong>.';
        }
    },
    {
        keys: ['semaforo','luz roja','luz verde','ambar','amarillo','intermitente'],
        get: function() {
            const s = NORMAS.semaforos;
            const sd = NORMAS.temario_completo_dgt.semaforos_detallados;
            return '<strong>\u{1F6A6} Sem\u00E1foros:</strong><br><br>' +
                '\u2022 \u{1F534} <strong>Rojo:</strong> ' + s.rojo + '<br>' +
                '\u2022 \u{1F7E1} <strong>\u00C1mbar:</strong> ' + s.amarillo + '<br>' +
                '\u2022 \u{1F7E2} <strong>Verde:</strong> ' + s.verde + '<br>' +
                '\u2022 <strong>Flecha verde:</strong> ' + s.verde_flecha + '<br>' +
                '\u2022 <strong>\u00C1mbar intermitente:</strong> ' + s.amarillo_intermitente + '<br><br>' +
                '<strong>Peatones:</strong> Verde = ' + sd.peatones.verde + ' | Rojo = ' + sd.peatones.rojo;
        }
    },
    {
        keys: ['senal','senales','triangulo','circulo','stop','ceda','marca vial','linea continua','linea discontinua'],
        get: function() {
            const s = NORMAS.senales;
            const mv = s.marcas_viales;
            return '<strong>\u{1F6A6} Se\u00F1ales de tr\u00E1fico:</strong><br><br>' +
                '<strong>Peligro (tri\u00E1ngulo rojo):</strong><br>' +
                s.peligro.map(function(p){ return '\u2022 <strong>' + p.codigo + '</strong> ' + p.nombre; }).join('<br>') + '<br><br>' +
                '<strong>Prohibici\u00F3n (c\u00EDrculo rojo):</strong><br>' +
                s.prohibicion.map(function(p){ return '\u2022 <strong>' + p.codigo + '</strong> ' + p.nombre + (p.accion ? ': ' + p.accion : ''); }).join('<br>') + '<br><br>' +
                '<strong>Marcas viales:</strong><br>' +
                '\u2022 L\u00EDnea continua: <strong>' + mv.linea_continua + '</strong><br>' +
                '\u2022 L\u00EDnea discontinua: <strong>' + mv.linea_discontinua + '</strong>';
        }
    },
    {
        keys: ['puntos','carne','carnet','infraccion','multa','sancion','grave','muy grave'],
        get: function() {
            const p = NORMAS.puntos_carnet;
            const inf = NORMAS.infracciones;
            return '<strong>\u{1F4CB} Sistema de puntos del carn\u00E9:</strong><br><br>' +
                '\u2022 Noveles: <strong>' + p.puntos_iniciales + ' pts</strong><br>' +
                '\u2022 Generales: <strong>' + p.puntos_normales + ' pts</strong><br>' +
                '\u2022 M\u00E1ximo posible: <strong>' + p.maximos + ' pts</strong><br><br>' +
                '<strong>Infracciones muy graves:</strong><br>' +
                inf.muy_graves.map(function(i){ return '\u2022 ' + i.descripcion + ': <strong>-' + i.puntos + ' pts</strong> \u00B7 ' + i.multa + '\u20AC'; }).join('<br>') + '<br><br>' +
                '<strong>Infracciones graves:</strong><br>' +
                inf.graves.map(function(i){ return '\u2022 ' + i.descripcion + ': <strong>-' + i.puntos + ' pts</strong> \u00B7 ' + i.multa + '\u20AC'; }).join('<br>');
        }
    },
    {
        keys: ['cinturon','casco','sri','nino','silla','retencion infantil'],
        get: function() {
            const sv = NORMAS.seguridad_vial;
            return '<strong>\u{1F512} Seguridad vial:</strong><br><br>' +
                '<strong>Cintur\u00F3n:</strong> Obligatorio en todos los asientos<br>' +
                'Excepciones: ' + sv.cinturon.excepciones.join(', ') + '<br><br>' +
                '<strong>Casco (moto):</strong> Obligatorio y homologado<br><br>' +
                '<strong>SRI (retenci\u00F3n infantil):</strong><br>' +
                '\u2022 Obligatorio hasta <strong>' + sv.sri.altura_obligatoria_cm + ' cm</strong> de altura<br>' +
                '\u2022 Recomendado hasta ' + sv.sri.recomendado_hasta_cm + ' cm';
        }
    },
    {
        keys: ['adelantar','adelantamiento','sobrepasar','rebasar','prohibido adelantar'],
        get: function() {
            const ad = NORMAS.adelantamientos;
            return '<strong>\u{1F697} Adelantamiento:</strong><br><br>' +
                '<strong>Normas:</strong><br>' +
                ad.normas.map(function(n){ return '\u2022 ' + n; }).join('<br>') + '<br><br>' +
                '<strong>Prohibido en:</strong><br>' +
                ad.prohibiciones.map(function(p){ return '\u2022 ' + p; }).join('<br>');
        }
    },
    {
        keys: ['distancia seguridad','separacion','espacio delante'],
        get: function() {
            const ds = NORMAS.distancias_seguridad;
            return '<strong>\u{1F4CF} Distancia de seguridad:</strong><br><br>' +
                '\u2022 ' + ds.general + '<br>' +
                '\u2022 Para adelantar fuera de poblado: m\u00EDnimo <strong>' + ds.adelantamiento_fuera_poblado_metros + ' m</strong> de visibilidad';
        }
    },
    {
        keys: ['aparcar','estacionar','parada','parking','zona azul','estacionamiento'],
        get: function() {
            const ep = NORMAS.estacionamiento_y_parada;
            return '<strong>\u{1F17F}\uFE0F Estacionamiento y parada:</strong><br><br>' +
                '<strong>Parada:</strong> ' + ep.parada.definicion + '<br>' +
                '<strong>Estacionamiento:</strong> ' + ep.estacionamiento.definicion + '<br><br>' +
                '<strong>Prohibido en:</strong><br>' +
                ep.prohibiciones.map(function(p){ return '\u2022 ' + p; }).join('<br>');
        }
    },
    {
        keys: ['luces','cortas','largas','antiniebla','niebla','lluvia','nieve','visibilidad'],
        get: function() {
            const l = NORMAS.luces;
            const cm = NORMAS.condiciones_meteorologicas;
            return '<strong>\u{1F4A1} Luces y condiciones adversas:</strong><br><br>' +
                '<strong>Luces cortas (cruce):</strong> ' + l.cortas.uso.join(', ') + '<br>' +
                '<strong>Antiniebla traseras:</strong> ' + l.antiniebla.traseras + '<br><br>' +
                '<strong>Lluvia:</strong> ' + cm.lluvia.recomendaciones.join(', ') + '<br>' +
                '<strong>Niebla:</strong> ' + cm.niebla.recomendaciones.join(', ') + '<br>' +
                '<strong>Nieve:</strong> ' + cm.nieve.equipamiento.join(', ');
        }
    },
    {
        keys: ['itv','inspeccion tecnica','revision obligatoria'],
        get: function() {
            const itv = NORMAS.itv.turismos;
            return '<strong>\u{1F527} ITV para turismos:</strong><br><br>' +
                '\u2022 Primera ITV: a los <strong>' + itv.primera_itv_anos + ' a\u00F1os</strong><br>' +
                '\u2022 De 4 a 10 a\u00F1os: <strong>' + itv['de_4_a_10_anos'] + '</strong><br>' +
                '\u2022 M\u00E1s de 10 a\u00F1os: <strong>' + itv['mas_de_10_anos'] + '</strong>';
        }
    },
    {
        keys: ['neumatico','rueda','llanta','aquaplaning','dibujo neumatico'],
        get: function() {
            const n = NORMAS.neumaticos;
            return '<strong>\u{1F6DE} Neum\u00E1ticos:</strong><br><br>' +
                '\u2022 Profundidad m\u00EDnima legal: <strong>' + n.profundidad_minima_dibujo_mm + ' mm</strong><br>' +
                '\u2022 Presi\u00F3n: revisar en fr\u00EDo<br><br>' +
                '<strong>Riesgos:</strong><br>' +
                n.riesgos.map(function(r){ return '\u2022 ' + r; }).join('<br>');
        }
    },
    {
        keys: ['prioridad','rotonda','glorieta','pendiente','ceder paso'],
        get: function() {
            const p = NORMAS.prioridades_paso;
            const pv = NORMAS.temario_completo_dgt.prioridad_vehiculos;
            return '<strong>\u{1F6D1} Normas de prioridad:</strong><br><br>' +
                p.normas_generales.map(function(n){ return '\u2022 ' + n; }).join('<br>') + '<br><br>' +
                '\u{1F504} <strong>Rotondas:</strong> ' + p.glorietas.norma + '<br>' +
                '\u26F0\uFE0F <strong>Pendientes:</strong> ' + p.pendientes.norma + '<br><br>' +
                '<strong>Veh\u00EDculos prioritarios:</strong> ' + pv.vehiculos_prioritarios.join(', ');
        }
    },
    {
        keys: ['emergencia','accidente','averia','socorro','chaleco','triangulo','pas'],
        get: function() {
            const e = NORMAS.emergencias;
            const pa = NORMAS.temario_completo_dgt.primeros_auxilios;
            return '<strong>\u{1F198} Emergencias en carretera:</strong><br><br>' +
                '<strong>Regla PAS:</strong><br>' +
                e.pasos.map(function(p, i){ return '<strong>' + (i+1) + '. ' + p + '</strong>'; }).join(' \u2192 ') + '<br><br>' +
                '\u260E\uFE0F Emergencias: <strong>' + e.telefono_emergencias + '</strong><br>' +
                '\u{1F9BA} Chaleco: obligatorio antes de salir del veh\u00EDculo<br>' +
                '\u26A0\uFE0F Se\u00F1al V-16 sustituye a los tri\u00E1ngulos<br><br>' +
                '<strong>Primeros auxilios:</strong><br>' +
                '\u2022 Hemorragias: ' + pa.hemorragias + '<br>' +
                '\u2022 Inconsciente: ' + pa.inconsciente + '<br>' +
                '\u2022 RCP: ' + pa.reanimacion.compresiones_por_minuto + ' comp/min, relaci\u00F3n ' + pa.reanimacion.relacion_compresiones_respiraciones;
        }
    },
    {
        keys: ['peaton','peatones','cruzar','ciclista','bicicleta','distancia lateral'],
        get: function() {
            const uv = NORMAS.usuarios_vulnerables;
            const ped = NORMAS.temario_completo_dgt.peatones;
            return '<strong>\u{1F6B6} Peatones y ciclistas:</strong><br><br>' +
                '<strong>Peatones:</strong><br>' +
                ped.normas.map(function(n){ return '\u2022 ' + n; }).join('<br>') + '<br><br>' +
                '<strong>Ciclistas:</strong><br>' +
                '\u2022 Distancia lateral m\u00EDnima: <strong>' + uv.ciclistas.distancia_lateral_metros + ' m</strong><br>' +
                '\u2022 ' + uv.ciclistas.adelantamiento;
        }
    },
    {
        keys: ['fatiga','sueno','cansancio','somnolencia','descanso','dormirse'],
        get: function() {
            const f = NORMAS.temario_completo_dgt.fatiga_y_sueno;
            return '<strong>\u{1F634} Fatiga y sue\u00F1o al volante:</strong><br><br>' +
                '<strong>S\u00EDntomas:</strong><br>' +
                f.sintomas.map(function(s){ return '\u2022 ' + s; }).join('<br>') + '<br><br>' +
                '<strong>Prevenci\u00F3n:</strong><br>' +
                f.prevencion.map(function(p){ return '\u2022 ' + p; }).join('<br>');
        }
    },
    {
        keys: ['movil','telefono','manos libres','distraccion'],
        get: function() {
            const d = NORMAS.temario_completo_dgt.distracciones;
            const inf = NORMAS.infracciones.muy_graves.find(function(i){ return i.descripcion.toLowerCase().includes('movil'); });
            return '<strong>\u{1F4F5} Distracciones al volante:</strong><br><br>' +
                '<strong>Principales:</strong><br>' +
                d.principales.map(function(p){ return '\u2022 ' + p; }).join('<br>') +
                (inf ? '<br><br>\u26A0\uFE0F Uso del m\u00F3vil: <strong>-' + inf.puntos + ' puntos</strong> y multa de <strong>' + inf.multa + '\u20AC</strong>' : '');
        }
    },
    {
        keys: ['freno','frenada','frenado','abs','frenar'],
        get: function() {
            const fr = NORMAS.temario_completo_dgt.frenado;
            const mec = NORMAS.mecanica_basica.frenos;
            return '<strong>\u{1F6D1} Frenado:</strong><br><br>' +
                '<strong>Tipos:</strong> ' + fr.tipos.join(', ') + '<br><br>' +
                '\u2022 Reacci\u00F3n: ' + fr.distancias.reaccion + '<br>' +
                '\u2022 Frenado: ' + fr.distancias.frenado + '<br>' +
                '\u2022 Detenci\u00F3n total: ' + fr.distancias.detencion + '<br><br>' +
                '\u2022 <strong>ABS:</strong> ' + mec.abs;
        }
    },
    {
        keys: ['agente','policia','guardia civil','brazo levantado','silbato'],
        get: function() {
            const a = NORMAS.temario_completo_dgt.senales_agentes;
            const pr = NORMAS.agentes.prioridad_senalizacion;
            return '<strong>\u{1F46E} Se\u00F1ales de los agentes:</strong><br><br>' +
                '\u2022 Brazo levantado: <strong>' + a.brazo_levantado + '</strong><br>' +
                '\u2022 Brazo horizontal: <strong>' + a.brazo_extendido_horizontal + '</strong><br>' +
                '\u2022 Silbato corto: <strong>' + a.toques_silbato.cortos_frecuentes + '</strong><br>' +
                '\u2022 Silbato largo: <strong>' + a.toques_silbato.largos + '</strong><br><br>' +
                '<strong>Prioridad de se\u00F1alizaci\u00F3n:</strong><br>' +
                pr.map(function(p, i){ return (i+1) + '. ' + p; }).join('<br>');
        }
    },
    {
        keys: ['documentacion','documento','dni','permiso circulacion','tarjeta itv','papeles'],
        get: function() {
            const doc = NORMAS.documentacion_obligatoria;
            return '<strong>\u{1F4C1} Documentaci\u00F3n obligatoria:</strong><br><br>' +
                '<strong>Del conductor:</strong><br>' +
                doc.conductor.map(function(d){ return '\u2022 ' + d; }).join('<br>') + '<br><br>' +
                '<strong>Del veh\u00EDculo:</strong><br>' +
                doc.vehiculo.map(function(d){ return '\u2022 ' + d; }).join('<br>');
        }
    },
    {
        keys: ['carril','carril derecho','carril izquierdo','busvao','cambiar carril'],
        get: function() {
            const cu = NORMAS.temario_completo_dgt.uso_carriles;
            return '<strong>\u{1F6E3}\uFE0F Uso de carriles:</strong><br><br>' +
                cu.normas.map(function(n){ return '\u2022 ' + n; }).join('<br>') + '<br><br>' +
                '<strong>Carriles especiales:</strong><br>' +
                '\u2022 BUS-VAO: ' + cu.carriles_especiales.busvao + '<br>' +
                '\u2022 Reversible: ' + cu.carriles_especiales.reversible;
        }
    },
    {
        keys: ['drogas','droga','cannabis','positivo drogas'],
        get: function() {
            const d = NORMAS.drogas;
            return '<strong>\u{1F6AB} Drogas al volante:</strong><br><br>' +
                d.norma_general + '<br><br>' +
                '\u2022 Sanci\u00F3n: <strong>' + d.sancion_euros + '\u20AC</strong><br>' +
                '\u2022 P\u00E9rdida de puntos: <strong>-' + d.perdida_puntos + ' puntos</strong>';
        }
    },
    {
        keys: ['seguro','responsabilidad civil','tipos seguro'],
        get: function() {
            const s = NORMAS.temario_completo_dgt.seguro;
            return '<strong>\u{1F4C4} Seguro del veh\u00EDculo:</strong><br><br>' +
                '\u2022 Obligatorio por ley<br><br>' +
                '<strong>Tipos:</strong><br>' +
                s.tipos.map(function(t){ return '\u2022 ' + t; }).join('<br>');
        }
    }
];

function buscarEnNormas(mensaje) {
    const t = normQ(mensaje);
    let mejorScore = 0;
    let mejorRegla = null;
    for (let i = 0; i < NORMAS_RULES.length; i++) {
        const regla = NORMAS_RULES[i];
        let score = 0;
        for (let j = 0; j < regla.keys.length; j++) {
            const key = regla.keys[j];
            if (t.includes(normQ(key))) score += key.includes(' ') ? 2 : 1;
        }
        if (score > mejorScore) { mejorScore = score; mejorRegla = regla; }
    }
    if (!mejorRegla || mejorScore === 0) return null;
    try { return mejorRegla.get(); } catch(e) { return null; }
}

// POST /api/chatbot — responde usando normas.json
app.post('/api/chatbot', function(req, res) {
    const message = req.body && req.body.message;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Mensaje invalido' });
    }
    const respuesta = buscarEnNormas(message.trim());
    if (!respuesta) return res.json({ found: false });
    res.json({ found: true, answer: respuesta });
});

// ============================================================
// Iniciar servidor
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor CarQuest corriendo en http://localhost:${PORT}`);
    console.log(`📄 Abre http://localhost:${PORT}/index.html en tu navegador`);
});
