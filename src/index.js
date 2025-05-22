require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, "webhook_events.json");

// Initialize JSON file if it doesn't exist
async function initializeDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    // File doesn't exist, create it with empty array
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
    console.log("Data file initialized successfully");
  }
}

// Helper function to read data
async function readData() {
  const data = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(data);
}

// Helper function to write data
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Webhook endpoint
app.post("/api/webhook", async (req, res) => {
  try {
    const { ticker, timestamp, message, open, high, low, close } = req.body;

    if (!ticker || !timestamp) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const events = await readData();
    const newEvent = {
      id: events.length + 1,
      ticker,
      timestamp,
      message,
      open,
      high,
      low,
      close,
      created_at: new Date().toISOString(),
    };

    events.push(newEvent);
    await writeData(events);

    res.status(200).json({ message: "Webhook data received successfully" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all events
app.get("/api/events", async (req, res) => {
  try {
    const events = await readData();
    res.json(
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get events by ticker
app.get("/api/events/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const events = await readData();
    const filteredEvents = events
      .filter((event) => event.ticker === ticker)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(filteredEvents);
  } catch (error) {
    console.error("Error fetching events by ticker:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Initialize data file and start server
initializeDataFile().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
