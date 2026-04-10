const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION ---
// O Railway preenche essas variáveis automaticamente
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'railway',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// --- INICIALIZAR TABELA ---
async function initDB() {
    await promisePool.query(`
        CREATE TABLE IF NOT EXISTS players_online (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    console.log("Banco de dados pronto!");
}
initDB();

// --- ENDPOINTS ---

// Check-in
app.post('/check_in', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ status: "error", message: "Missing username" });

    try {
        await promisePool.query(`
            INSERT INTO players_online (username, last_seen) 
            VALUES (?, CURRENT_TIMESTAMP) 
            ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP
        `, [username]);
        res.json({ status: "success", message: "Check-in successful" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Get Players
app.get('/players', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT username FROM players_online 
            WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        `);
        const players = rows.map(r => r.username);
        res.json({ status: "success", players });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Rota padrão para teste
app.get('/', (req, res) => res.send("Servidor Multiplayer Rodando!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor ouvindo na porta ${PORT}`);
});
