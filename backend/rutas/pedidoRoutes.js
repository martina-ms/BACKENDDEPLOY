import { PedidoController } from "../controllers/pedidoController.js";
import express from 'express';
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js"
import  roleCheck  from "../middlewares/roleCheck.js";
import { PedidoModel } from "../schemas/pedidoSchema.js";

const pathPedido = "/pedidos";

export default function pedidoRoutes(getController) {
  const router = express.Router();

  // Helper para normalizar roles y chequear ANY
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

function ensurePedidoOwnerOrAdmin(paramPedidoIdName = "id") {
  return async (req, res, next) => {
    try {
      const pedidoId = req.params[paramPedidoIdName];
      console.log("[ensurePedidoOwnerOrAdmin] pedidoId param:", pedidoId);

      if (!pedidoId) return res.status(400).json({ error: "Pedido id faltante en ruta" });

      const pedido = await PedidoModel.findById(pedidoId).exec();
      if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

      const claims = req.auth || {};
      const externalSub = claims.sub;
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const tokenRoles =
        claims[rolesNamespace] || claims.roles || (claims.realm_access && claims.realm_access.roles) || [];
      const rolesLower = Array.isArray(tokenRoles) ? tokenRoles.map(r => String(r).toLowerCase()) : [];

      const usuarioDb = req.usuarioDb;
      const usuarioDbId = usuarioDb && (String(usuarioDb._id) || String(usuarioDb.id));

      console.log("[ensurePedidoOwnerOrAdmin] usuarioDbId:", usuarioDbId, "externalSub:", externalSub, "pedido.comprador:", pedido.comprador, "pedido.compradorExternal:", pedido.compradorExternal);

      if (rolesLower.includes("administrador") || rolesLower.includes("admin")) {
        return next();
      }

      if (usuarioDbId && String(pedido.comprador) === String(usuarioDbId)) {
        return next();
      }

      if (externalSub && pedido.compradorExternal && String(pedido.compradorExternal) === String(externalSub)) {
        return next();
      }

      console.log("[ensurePedidoOwnerOrAdmin] acceso denegado");
      return res.status(403).json({ error: "Forbidden - not owner" });
    } catch (err) {
      console.error("[ensurePedidoOwnerOrAdmin] error:", err);
      return res.status(500).json({ error: "Error verificando propietario del pedido" });
    }
  };
}

  // Helper que asegura que el usuario en token es el owner (userId param) o es admin
  function ensureOwnerOrAdmin(paramUserIdName = "id") {
    return (req, res, next) => {
      const claims = req.auth || {};
      const authSub = claims.sub;
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const roles =
        claims[rolesNamespace] ||
        claims.roles ||
        (claims.realm_access && claims.realm_access.roles) ||
        [];
      const rolesLower = Array.isArray(roles) ? roles.map(r => String(r).toLowerCase()) : [];

      // propiedad de usuario provisionado en el middleware
      const usuarioDb = req.usuarioDb;
      const routeUserId = req.params[paramUserIdName];

      // Si es admin, permitir
      if (rolesLower.includes("administrador") || rolesLower.includes("admin")) return next();

      // Comprobar que authSub coincide con id esperado (puedes almacenar provider id en usuarioDb.keycloakId / auth0Id)
      // Aceptamos que routeUserId pueda venir como auth0|xxx o como DB id; intentamos comparar con usuarioDb.keycloakId y usuarioDb._id
      if (usuarioDb) {
        if (usuarioDb.keycloakId === routeUserId || String(usuarioDb._id) === routeUserId || usuarioDb.auth0Id === routeUserId) {
          return next();
        }
      }

      // Por defecto denegar
      return res.status(403).json({ error: "Forbidden - not owner" });
    };
  }

  // Crear pedido -> requiere estar autenticado y ser comprador (o admin)
  router.post(
    pathPedido,
    checkJwt,
    provisionUsuario,
    roleCheck(["comprador", "administrador"]),
    (req, res, next) => {
      getController(PedidoController).crear(req, res, next);
    }
  );

  // Cancelar pedido -> proteger, sólo owner o admin
  router.patch(
    pathPedido + "/:id/cancelar",
    checkJwt,
    provisionUsuario,
    ensurePedidoOwnerOrAdmin("id"),
    (req, res, next) => {
      getController(PedidoController).cancelar(req, res, next);
    }
  );

  // Historial por usuario -> sólo owner o admin
  router.get(
    pathPedido + "/usuarios/:id",
    checkJwt,
    provisionUsuario,
    ensureOwnerOrAdmin("id"),
    (req, res, next) => {
      getController(PedidoController).historialPorUsuario(req, res, next);
    }
  );

  // Enviar/confirmar pedidos -> generalmente lo hace admin/operaciones (proteger con role)
  router.patch(
    pathPedido + "/:id/enviar",
    checkJwt,
    provisionUsuario,
    allowAnyRole(['administrador', 'vendedor']),
    (req, res, next) => {
      getController(PedidoController).enviar(req, res, next);
    }
  );

  router.patch(
    pathPedido + "/:id/confirmar",
    checkJwt,
    provisionUsuario,
    allowAnyRole(['administrador', 'vendedor']),
    (req, res, next) => {
      getController(PedidoController).confirmar(req, res, next);
    }
  );

  return router;
}
