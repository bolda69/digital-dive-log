require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config(); // fallback to backend/ .env if exists
const path = require('path');
const fs = require('fs');
const app = require('./app');
const { initDb } = require('./db');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../dives.db');

// Ensure uploads directory exists

async function startServer() {
  try {
    console.log(`Initializing database at: ${DB_PATH}`);
    await initDb(DB_PATH);
    console.log('Database initialized successfully.');

    app.listen(PORT, () => {
      console.log(`Server is running and listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();
