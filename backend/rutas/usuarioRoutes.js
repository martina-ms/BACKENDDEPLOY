import { UsuarioController } from "../controllers/usuarioController.js";
import express from 'express';
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js";

const pathUsuario = "/usuarios";

export default function usuarioRoutes(getController) {
  const router = express.Router();

  // Crear usuario (puede dejarse público o protegerse según reglas del negocio)
  router.post(pathUsuario, (req, res, next) => {
    getController(UsuarioController).crear(req, res, next);
  });

  // Obtener todos - mantener privado (solo admin)
  router.get(
    pathUsuario,
    checkJwt,
    provisionUsuario,
    (req, res, next) => {
      // Solo admin puede ver todos
      const claims = req.auth || {};
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const roles = claims[rolesNamespace] || claims.roles || (claims.realm_access && claims.realm_access.roles) || [];
      if (!Array.isArray(roles) || !roles.map(r => String(r).toLowerCase()).includes("administrador")) {
        return res.status(403).json({ error: "Forbidden - admin only" });
      }
      return getController(UsuarioController).obtenerTodos(req, res, next);
    }
  );

  // Endpoint conveniente: /usuarios/me -> devuelve usuario provisionado
  router.get(
    pathUsuario + "/me",
    checkJwt,
    provisionUsuario,
    (req, res) => {
      if (!req.usuarioDb) return res.status(404).json({ message: "Usuario no encontrado" });
      const u = req.usuarioDb;
      return res.json({
        _id: u._id,
        nombre: u.nombre,
        email: u.email,
        telefono: u.telefono,
        tipo: u.tipo,
        roles: u.roles || [],
        fechaAlta: u.fechaAlta
      });
    }
  );

  return router;
}