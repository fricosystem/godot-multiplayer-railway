const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- MAPEAMENTO DE VARIÁVEIS DO RAILWAY ---
// Verificando os nomes que aparecem no seu print (DB_HOST, DB_USER, etc)
const dbConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306
};

console.log("Tentando conexão detalhada em:", dbConfig.host);

const pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    port: dbConfig.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const promisePool = pool.promise();

async function testConnection() {
    try {
        await promisePool.query("SELECT 1");
        console.log("✅ BANCO DE DADOS CONECTADO COM SUCESSO!");
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS players_online (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error("❌ ERRO NO BANCO:", err.message);
        setTimeout(testConnection, 5000);
    }
}
testConnection();

app.post('/check_in', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send("Falta username");
    try {
        await promisePool.query(`
            INSERT INTO players_online (username, last_seen) 
            VALUES (?, NOW()) 
            ON DUPLICATE KEY UPDATE last_seen = NOW()
        `, [username]);
        res.json({ status: "success" });
    } catch (err) {
        console.error("Erro no Query:", err.message);
        res.status(500).json({ error: "Erro na gravação do banco", details: err.message });
    }
});

app.get('/players', async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT username FROM players_online WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE)");
        res.json({ status: "success", players: rows.map(r => r.username) });
    } catch (err) {
        res.status(500).json({ error: "Erro na leitura do banco" });
    }
});

app.get('/', (req, res) => res.send("Servidor Multiplayer Godot OK!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Porta: ${PORT}`));
