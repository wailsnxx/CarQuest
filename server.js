const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
            'SELECT id, nombre, email, xp, nivel, rang, created_at FROM users WHERE id = $1',
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
        // Sumar XP y recalcular nivel y rango
        const result = await pool.query(`
            UPDATE users
            SET
                xp    = xp + $1,
                nivel = GREATEST(1, FLOOR((xp + $1) / 1000) + 1),
                rang  = update_rang(xp + $1)
            WHERE id = $2
            RETURNING xp, nivel, rang
        `, [xp_ganado, req.user.id]);

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

// ============================================================
// Iniciar servidor
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor CarQuest corriendo en http://localhost:${PORT}`);
    console.log(`📄 Abre http://localhost:${PORT}/index.html en tu navegador`);
});
