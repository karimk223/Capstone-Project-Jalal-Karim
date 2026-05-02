/**
 * Server entry point. Imports the configured Express app and binds it to a port.
 * The app itself is defined in app.js so tests can import it without starting a server.
 */

const env = require('./config/env');
require('./config/db');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] env: ${env.nodeEnv}`);
});

module.exports = app;
