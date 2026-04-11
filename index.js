const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÃO DB ---
const dbConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306
};

const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// Inicializa tabelas
async function initDB() {
    try {
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS server_rooms (
                room_id VARCHAR(10) PRIMARY KEY,
                host_ip VARCHAR(50) NOT NULL,
                local_ip VARCHAR(50),
                host_name VARCHAR(50),
                last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Banco de Dados Pronto!");
    } catch (err) {
        console.error("❌ Erro ao iniciar DB:", err.message);
        setTimeout(initDB, 5000);
    }
}
initDB();

// --- API DE CONEXÃO ---

app.post('/create_room', async (req, res) => {
    const { room_id, host_ip, local_ip, host_name } = req.body;
    try {
        // Usa REPLACE para atualizar se o room_id já existir
        await promisePool.query(
            "REPLACE INTO server_rooms (room_id, host_ip, local_ip, host_name, last_ping) VALUES (?, ?, ?, ?, NOW())", 
            [room_id, host_ip, local_ip, host_name]
        );
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/list_rooms', async (req, res) => {
    try {
        // Lista apenas salas ativas nos últimos 5 minutos
        const [rows] = await promisePool.query("SELECT * FROM server_rooms WHERE last_ping > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ORDER BY last_ping DESC");
        res.json({ status: "success", rooms: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/get_room/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT host_ip, local_ip FROM server_rooms WHERE room_id = ?", [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "Sala não encontrada ou expirada" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/my_ip', (req, res) => {
    // Captura o IP real do cliente, considerando proxies (como o do Railway/Cloudflare)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIp = ip.split(',')[0].trim();
    res.json({ ip: cleanIp });
});

// Rota de saúde para o Railway
app.get('/', (req, res) => {
    res.send("Servidor de Lobby de Terror Online Ativo!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
