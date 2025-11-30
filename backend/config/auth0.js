// packages/backend/config/auth0.js
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from 'dotenv';
dotenv.config();

const domain = process.env.AUTH0_DOMAIN;
const audience = process.env.AUTH0_AUDIENCE; 

if (!domain || !audience) {
  console.warn(
    "AUTH0_DOMAIN o AUTH0_AUDIENCE no definidos. Configurá las variables de entorno."
  );
}

/**
 * checkJwt middleware: valida el access token de Auth0.
 * Uso: app.get('/api/private', checkJwt, handler)
 */
const checkJwt = jwt({
  // usa JWKS dinámico para obtener la public key correcta según el kid
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
  }),
  // Validación de audiencia y emisor
  audience: audience,
  issuer: `https://${domain}/`,
  algorithms: ["RS256"],
});

function checkRole(role, namespace = "https://tienda.example.com/roles") {
  // namespace: donde pusimos la claim de roles en Auth0 (ver Action abajo)
  return (req, res, next) => {
    const claims = req.auth || {};
    const roles = claims[namespace] || claims.roles || [];
    if (Array.isArray(roles) && roles.includes(role)) {
      return next();
    }
    return res.status(403).json({ msg: "Forbidden - role missing" });
  };
}

export { checkJwt, checkRole };