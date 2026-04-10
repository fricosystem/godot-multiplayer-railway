const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONEXÃO USANDO O LINK DIRETO (MAIS GARANTIDO NO RAILWAY) ---
// O Railway fornece a variável MYSQL_URL automaticamente se você conectar o serviço de banco
const connectionUri = process.env.MYSQL_URL || `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

console.log("Iniciando pool de conexão...");

const pool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const promisePool = pool.promise();

// Tenta criar a tabela e testar a conexão
async function testConnection() {
    try {
        await promisePool.query("SELECT 1");
        console.log("✅ Conexão com o Banco OK!");
        
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS players_online (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Tabela players_online verificada!");
    } catch (err) {
        console.error("❌ ERRO NO BANCO:", err.message);
        console.log("Tentando novamente em 5 segundos...");
        setTimeout(testConnection, 5000);
    }
}
testConnection();

// --- ROTAS ---

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
        console.error("Erro no check_in:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/players', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT username FROM players_online 
            WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        `);
        res.json({ status: "success", players: rows.map(r => r.username) });
    } catch (err) {
        console.error("Erro no fetch players:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.send("Servidor Ativo e Conectado!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
