const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- VERIFICAÇÃO DE SEGURANÇA ---
const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306
};

// Se não houver host, o Railway ainda não conectou o banco
if (!dbConfig.host) {
    console.error("⚠️ ALERTA: Nenhuma variável de banco de dados encontrada!");
    console.error("DICA: Vá no painel do Railway e use 'Connect Database' nas variáveis do seu serviço.");
}

const pool = mysql.createPool({
    host: dbConfig.host || 'localhost',
    user: dbConfig.user || 'root',
    password: dbConfig.password || '',
    database: dbConfig.database || 'railway',
    port: dbConfig.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const promisePool = pool.promise();

async function testConnection() {
    if (!dbConfig.host) {
        console.log("Aguardando variáveis do banco... tentando novamente em 10s");
        setTimeout(testConnection, 10000);
        return;
    }
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
        res.status(500).json({ error: "Erro interno" });
    }
});

app.get('/players', async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT username FROM players_online WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE)");
        res.json({ status: "success", players: rows.map(r => r.username) });
    } catch (err) {
        res.status(500).json({ error: "Erro" });
    }
});

app.get('/', (req, res) => {
    if (!dbConfig.host) return res.send("Servidor rodando, mas BANCO DE DADOS DESCONECTADO (Sem variáveis).");
    res.send("Servidor Multiplayer Railway Ativo!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${PORT}`));
