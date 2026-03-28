import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { pdfRoutes } from './routes/pdf.js';
import { scenarioRoutes } from './routes/scenarios.js';
import { simulationRoutes } from './routes/simulation.js';
import { setupWebSocket } from './websocket/handler.js';

dotenv.config({ path: '../.env' });

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDatabase();

app.use('/api/pdf', pdfRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/simulation', simulationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Nursing Simulator server running on port ${PORT}`);
});

export default app;
