// packages/backend/config/keycloak.js
import session from 'express-session'; // Cambiado de 'require'
import Keycloak from 'keycloak-connect';

const memoryStore = new session.MemoryStore();

const keycloakConfig = {
  clientId: 'backend-app',
  bearerOnly: true,
  serverUrl: 'https://renna-unbrought-peskily.ngrok-free.dev ',
  realm: 'tp-tienda-sol',
  credentials: {
    secret: process.env.KEYCLOAK_SECRET   //AGREGUEN A SU .ENV DEL FRONT SU KEYCLOAK_SECRET ASI NO LA HARDODEAMOS SIEMPRE
  }
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

export { keycloak, memoryStore };
