require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  port: 3306,
});

// Create table if not exists
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticker VARCHAR(20) NOT NULL,
        timestamp DATETIME NOT NULL,
        message TEXT,
        open DECIMAL(20,8),
        high DECIMAL(20,8),
        low DECIMAL(20,8),
        close DECIMAL(20,8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Webhook endpoint
app.post("/api/webhook", async (req, res) => {
  try {
    const { ticker, timestamp, message, open, high, low, close } = req.body;
    console.log("test response", req.body);
    if (!ticker || !timestamp) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const connection = await pool.getConnection();
    await connection.query(
      "INSERT INTO webhook_events (ticker, timestamp, message, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [ticker, timestamp, message, open, high, low, close]
    );
    connection.release();

    res.status(200).json({ message: "Webhook data received successfully" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all events
app.get("/api/events", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM webhook_events ORDER BY timestamp DESC"
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get events by ticker
app.get("/api/events/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM webhook_events WHERE ticker = ? ORDER BY timestamp DESC",
      [ticker]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching events by ticker:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
