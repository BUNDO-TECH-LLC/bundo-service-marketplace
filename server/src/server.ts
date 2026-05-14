import { env } from './config/env';
import logger from './utils/logger';
import { createApp } from './createApp';

const app = createApp();
const PORT = env.PORT;

const server = app.listen(Number(PORT), () => {
  logger.info({ port: PORT }, 'Server running');
});

server.ref();

export default server;
