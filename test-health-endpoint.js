const express = require('express');
const app = express();
const port = 3001;

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    service: 'stokcerdas-health-test'
  });
});

app.listen(port, () => {
  console.log(`Health test server running on port ${port}`);
});