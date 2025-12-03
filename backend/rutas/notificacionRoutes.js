import express from "express";
import { NotificacionController } from "../controllers/notificacionController.js";
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js";

const pathNotif = "/notificaciones";

export default function notificacionRoutes(getController) {
  const router = express.Router();

  // Reutilizamos helpers similares (normalizar roles y asegurar owner/admin)
  function allowAnyRole(allowedRoles = []) {
    const allowedLower = allowedRoles.map(r => String(r).toLowerCase());
    return (req, res, next) => {
      const claims = req.auth || {};
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const roles =
        claims[rolesNamespace] ||
        claims.roles ||
        (claims.realm_access && claims.realm_access.roles) ||
        [];

      if (!Array.isArray(roles)) {
        return res.status(403).json({ error: "Forbidden - roles not present in token" });
      }

      const rolesLower = roles.map(r => String(r).toLowerCase());
      const has = allowedLower.some(r => rolesLower.includes(r));
      if (has) return next();

      return res.status(403).json({ error: "Forbidden - role missing" });
    };
  }

  function ensureOwnerOrAdmin(paramUserIdName = "id") {
    return (req, res, next) => {
      const claims = req.auth || {};
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const roles =
        claims[rolesNamespace] ||
        claims.roles ||
        (claims.realm_access && claims.realm_access.roles) ||
        [];
      const rolesLower = Array.isArray(roles) ? roles.map(r => String(r).toLowerCase()) : [];

      if (rolesLower.includes("administrador") || rolesLower.includes("admin")) return next();

      const usuarioDb = req.usuarioDb;
      const routeUserId = req.params[paramUserIdName];

      if (usuarioDb) {
        if (usuarioDb.keycloakId === routeUserId || String(usuarioDb._id) === routeUserId || usuarioDb.auth0Id === routeUserId) {
          return next();
        }
      }

      return res.status(403).json({ error: "Forbidden - not owner" });
    };
  }

  // Listar notificaciones de un usuario -> requiere auth + owner/admin
  router.get(
    pathNotif + "/usuarios/:id",
    checkJwt,
    provisionUsuario,
    ensureOwnerOrAdmin("id"),
    (req, res, next) => {
      getController(NotificacionController).listar(req, res, next);
    }
  );

  // Marcar notificación como leída -> dueño de la notificación o admin
  router.patch(
    pathNotif + "/:id/leida",
    checkJwt,
    provisionUsuario,
    (req, res, next) => {
      // En este endpoint, el id es el id de notificación; NotificacionController debe validar que req.usuarioDb es propietario.
      getController(NotificacionController).marcarLeida(req, res, next);
    }
  );

  // Marcar todas leídas para un usuario -> owner/admin
  router.patch(
    pathNotif + "/usuarios/:id/leidas",
    checkJwt,
    provisionUsuario,
    ensureOwnerOrAdmin("id"),
    (req, res, next) => {
      getController(NotificacionController).marcarTodasLeidas(req, res, next);
    }
  );

  return router;
}