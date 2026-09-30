import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 NEXUS AI Backend running on http://${HOST}:${PORT} [${env.NODE_ENV}]`);
});
