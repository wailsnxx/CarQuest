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

console.log(`📚 ${PREGUNTES_DGT.length} preguntes DGT carregades`);

// Primera meitat dividida en tests de 30 preguntes
const meitat = Math.floor(PREGUNTES_DGT.length / 2);
const TESTS_NORMALS = [];
for (let i = 0; i < meitat; i += 30) {
    TESTS_NORMALS.push(PREGUNTES_DGT.slice(i, i + 30));
}
console.log(`📋 ${TESTS_NORMALS.length} tests numerats creats (${meitat} preguntes)`);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// PostgreSQL connection (Neon)
// ============================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }  // required for Neon
});

pool.connect()
    .then(() => console.log('✅ Conectado a PostgreSQL (Neon)'))
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

        // Leer racha actual
        const userRes = await pool.query(
            'SELECT racha, ultima_activitat FROM users WHERE id = $1',
            [req.user.id]
        );
        const { racha: rachaActual, ultima_activitat } = userRes.rows[0];
        const ultimaStr = ultima_activitat ? ultima_activitat.toISOString().slice(0, 10) : null;

        let novaRacha;
        if (ultimaStr === avui) {
            // Ja ha jugat avui, la racha no canvia
            novaRacha = rachaActual;
        } else {
            const ahir = new Date(avui + 'T00:00:00Z');
            ahir.setUTCDate(ahir.getUTCDate() - 1);
            const ahirStr = ahir.toISOString().slice(0, 10);
            novaRacha = ultimaStr === ahirStr ? rachaActual + 1 : 1;
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
        `, [xp_ganado, req.user.id, novaRacha, avui]);

        // Guardar registro de progreso si se pasa tipo y nombre
        if (tipus && nom) {
            await pool.query(
                'INSERT INTO progres (user_id, tipus, nom, puntuacio, completat) VALUES ($1, $2, $3, $4, true)',
                [req.user.id, tipus, nom, puntuacio || 0]
            );
        }

        res.json({ mensaje: `+${xp_ganado} XP ganados`, ...result.rows[0] });
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
                COUNT(*) FILTER (WHERE tipus = 'test' AND completat = true)  AS tests_aprovats,
                COUNT(*) FILTER (WHERE tipus = 'test' AND completat = false) AS tests_suspesos,
                COUNT(*) FILTER (WHERE tipus = 'joc'  AND completat = true)  AS jocs_completats
            FROM progres WHERE user_id = $1
        `, [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/user/streak — dies consecutius fent activitat
app.get('/api/user/streak', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT racha, ultima_activitat FROM users WHERE id = $1',
            [req.user.id]
        );
        const { racha, ultima_activitat } = result.rows[0];

        // Si l'última activitat no és avui ni ahir, la racha s'ha perdut
        const avui = new Date().toISOString().slice(0, 10);
        const ahir = new Date(avui + 'T00:00:00Z');
        ahir.setUTCDate(ahir.getUTCDate() - 1);
        const ahirStr = ahir.toISOString().slice(0, 10);
        const ultimaStr = ultima_activitat ? ultima_activitat.toISOString().slice(0, 10) : null;

        const rachaActiva = (ultimaStr === avui || ultimaStr === ahirStr) ? racha : 0;
        res.json({ racha: rachaActiva });
    } catch (err) {
        console.error('Error calculant racha:', err);
        res.status(500).json({ error: 'Error intern' });
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
// RUTAS DE PREGUNTES DGT
// ============================================================

// GET /api/preguntes?n=10&tema=all — devuelve N preguntas aleatorias
app.get('/api/preguntes', (req, res) => {
    const n = Math.min(parseInt(req.query.n) || 10, 30);
    const barrejades = [...PREGUNTES_DGT].sort(() => Math.random() - 0.5);
    res.json(barrejades.slice(0, n));
});

// GET /api/tests/list — llista de tests numerats
app.get('/api/tests/list', (req, res) => {
    res.json(TESTS_NORMALS.map((t, i) => ({ num: i + 1, total: t.length })));
});

// GET /api/tests/:num — preguntes d'un test concret
app.get('/api/tests/:num', (req, res) => {
    const num = parseInt(req.params.num);
    if (isNaN(num) || num < 1 || num > TESTS_NORMALS.length) {
        return res.status(404).json({ error: 'Test no trobat' });
    }
    res.json(TESTS_NORMALS[num - 1]);
});

// ============================================================
// RUTAS DE TEMPS DE REACCIÓ
// ============================================================

// POST /api/temps-reaccio/score — guarda la millor puntuació
app.post('/api/temps-reaccio/score', verificarToken, async (req, res) => {
    const { avg_ms } = req.body;
    if (!avg_ms || avg_ms <= 0) return res.status(400).json({ error: 'Score invàlid' });
    try {
        // Només guardem si és millor que l'anterior
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
        console.error('Error guardant score temps-reaccio:', err);
        res.status(500).json({ error: 'Error intern' });
    }
});

// GET /api/temps-reaccio/ranking — top 10 per menor temps mitjà
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
        console.error('Error obtenint ranking temps-reaccio:', err);
        res.status(500).json({ error: 'Error intern' });
    }
});

// ============================================================
// Iniciar servidor
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor CarQuest corriendo en http://localhost:${PORT}`);
    console.log(`📄 Abre http://localhost:${PORT}/index.html en tu navegador`);
});
