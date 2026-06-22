const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Configure CORS and JSON body parsing middleware
app.use(cors());
app.use(express.json());

// Handle malformed JSON input gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON' });
  }
  next();
});

// Mount database API routes
app.use('/api', routes);

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app;
