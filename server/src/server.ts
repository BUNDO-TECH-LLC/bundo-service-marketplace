import { env } from './config/env';
import { initObservability } from './observability';
import logger from './utils/logger';
import { createApp } from './createApp';
import { getCloudinaryHealth } from './utils/cloudinaryUploadConfig';
import { startKeepAlive } from './keepAlive';

initObservability();

const app = createApp();
const PORT = env.PORT;

void getCloudinaryHealth(true).then((cloudinary) => {
  if (cloudinary.ok) {
    logger.info({ cloudName: cloudinary.cloudName }, 'Cloudinary upload configuration verified');
    return;
  }

  logger.error(
    {
      cloudName: cloudinary.cloudName,
      error: cloudinary.error,
    },
    'Cloudinary upload configuration is invalid — image uploads will fail until CLOUDINARY_CLOUD_NAME is fixed on the API server and redeployed'
  );
});

const server = app.listen(Number(PORT), () => {
  logger.info({ port: PORT }, 'Server running');
  startKeepAlive();
});

server.ref();

export default server;
