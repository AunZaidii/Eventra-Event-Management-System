// Builds the Express app. Kept separate from server.js so tests can import it.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Behind Nginx / the AWS load balancer: trust X-Forwarded-For so rate limits see the real client IP.
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      // Same-origin requests (through Nginx) need no CORS; other origins must be allow-listed.
      origin: config.corsOrigins.length ? config.corsOrigins : false,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
