import { PedidoController } from "../controllers/pedidoController.js";
import express from 'express';
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js";

const pathPedido = "/pedidos";

export default function pedidoRoutes(getController) {
    const router = express.Router();

    // Helper: permite pasar si el token tiene ANY de los roles permitidos.
    // Lee roles desde el namespace configurado en AUTH0_ROLES_NAMESPACE o desde claims estándar.
    function allowAnyRole(allowedRoles = []) {
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

        const has = allowedRoles.some(r => roles.includes(r));
        if (has) return next();

        return res.status(403).json({ error: "Forbidden - role missing" });
      };
    }

    router.post(
      pathPedido,
      checkJwt,
      provisionUsuario,
      allowAnyRole(['comprador', 'administrador']),
      (req, res, next) => {
        getController(PedidoController).crear(req, res, next);
      }
    );

    router.patch(pathPedido + "/:id/cancelar", (req, res, next) => {
        getController(PedidoController).cancelar(req, res, next)
    });

    router.get(pathPedido + "/usuarios/:id", (req, res, next) => {
        getController(PedidoController).historialPorUsuario(req, res, next)
    });

    router.patch(pathPedido + "/:id/enviar", (req, res, next) => {
        getController(PedidoController).enviar(req, res, next)
    });

    router.patch(pathPedido + "/:id/confirmar", (req, res, next) => {
        getController(PedidoController).confirmar(req, res, next)
    });

    return router;
}