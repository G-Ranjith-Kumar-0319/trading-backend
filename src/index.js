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
        timenow DATETIME NOT NULL,
        message TEXT,
        open DECIMAL(20,8),
        high DECIMAL(20,8),
        low DECIMAL(20,8),
        close DECIMAL(20,8),
        price DECIMAL(20,8),
        volume INT,
        u_interval VARCHAR(20),
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error; // Re-throw to handle it in the server startup
  }
}

// Webhook endpoint
app.post("/api/webhook", async (req, res) => {
  try {
    const {
      ticker,
      timenow,
      message,
      open,
      high,
      low,
      close,
      price,
      volume,
      u_interval,
      time,
    } = req.body;
    console.log("Received webhook data:", req.body);

    // Validate required fields
    if (!ticker || !timenow) {
      console.error("Missing required fields:", { ticker, timenow });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate timenow format
    if (!Date.parse(timenow)) {
      console.error("Invalid timenow format:", timenow);
      return res.status(400).json({ error: "Invalid timenow format" });
    }

    // Validate u_interval if provided
    if (
      u_interval &&
      !["1m", "5m", "15m", "30m", "1h", "4h", "1d"].includes(u_interval)
    ) {
      console.error("Invalid u_interval value:", u_interval);
      return res.status(400).json({ error: "Invalid u_interval value" });
    }

    // Validate data types
    const numericFields = { open, high, low, close, price, volume };
    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && isNaN(Number(value))) {
        console.error(`Invalid ${field} value:`, value);
        return res.status(400).json({ error: `Invalid ${field} value` });
      }
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO webhook_events (ticker, timenow, message, open, high, low, close, price, volume, u_interval, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          ticker,
          timenow,
          message,
          open,
          high,
          low,
          close,
          price,
          volume,
          u_interval,
          time,
        ]
      );
      console.log("Data inserted successfully:", result);
      res.status(200).json({
        message: "Webhook data received successfully",
        id: result.insertId,
      });
    } catch (dbError) {
      console.error("Database insertion error:", dbError);
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Get all events
app.get("/api/events", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM webhook_events ORDER BY time DESC"
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
      "SELECT * FROM webhook_events WHERE ticker = ? ORDER BY time DESC",
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
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
