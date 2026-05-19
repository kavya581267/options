import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { startScheduler } from './scheduler.js';
import apiRouter from './routes/api.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Tracking: ${config.symbols.join(', ')}`);
  startScheduler();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use. Stop the other process:\n` +
        `  lsof -ti :${config.port} | xargs kill -9`
    );
    process.exit(1);
  }
  throw err;
});
