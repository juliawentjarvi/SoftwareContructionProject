import { setServers } from 'node:dns';
import mongoose from 'mongoose';
import { allowedOrigins, config, mongodbDnsServers } from './config.js';
import { createApp } from './app.js';

const app = createApp({
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  allowedOrigins,
});

try {
  if (mongodbDnsServers.length) setServers(mongodbDnsServers);
  await mongoose.connect(config.MONGODB_URI);
  const server = app.listen(config.PORT, () => {
    console.info(`Bear Buddy API listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('Unable to connect to MongoDB or start the API', error);
  process.exit(1);
}