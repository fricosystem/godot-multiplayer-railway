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
        await promisePool.query("SELECT 1");
        // Tabela de Jogadores Online (para o teste anterior)
        await promisePool.query(`CREATE TABLE IF NOT EXISTS players_online (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
        
        // NOVA Tabela de Salas
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                room_id VARCHAR(10) PRIMARY KEY,
                host_ip VARCHAR(50) NOT NULL,
                room_name VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ BANCO DE DADOS PRONTO!");
    } catch (err) {
        console.error("❌ ERRO NO BANCO:", err.message);
        setTimeout(initDB, 5000);
    }
}
initDB();

// --- API DE SALAS ---

// Criar Sala
app.post('/create_room', async (req, res) => {
    const { room_id, host_ip, room_name } = req.body;
    try {
        await promisePool.query("REPLACE INTO rooms (room_id, host_ip, room_name) VALUES (?, ?, ?)", [room_id, host_ip, room_name]);
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar IP da Sala
app.get('/get_room/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT host_ip FROM rooms WHERE room_id = ?", [req.params.id]);
        if (rows.length > 0) {
            res.json({ status: "success", host_ip: rows[0].host_ip });
        } else {
            res.status(404).json({ status: "error", message: "Sala não encontrada" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para o Godot descobrir o próprio IP público (MUITO ÚTIL)
app.get('/my_ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip: ip.split(',')[0] });
});

// Mantive os antigos para não quebrar compatibilidade
app.post('/check_in', async (req, res) => { /* ... código anterior ... */ });
app.get('/players', async (req, res) => { /* ... código anterior ... */ });

app.get('/', (req, res) => res.send("Matchmaker Horror Ativo!"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
