// En: backend/middlewares/authMiddleware.js

import { UsuarioRepository } from '../modulos/repos/usuarioRepo.js';
import { Usuario } from '../modulos/dominio/usuario.js';
import { TipoDeUsuario } from '../modulos/dominio/tipoDeUsuario.js';

const usuarioRepo = new UsuarioRepository();
const provisionUsuario = async (req, res, next) => {
  try {
    // express-jwt coloca las claims en req.auth
    const claims = req.auth || null;
    if (!claims) {
      // No hay token: dejamos pasar (rutas públicas)
      return next();
    }

    // Id del sujeto (Auth0) y datos básicos
    const authProviderId = claims.sub;
    const email = claims.email || null;
    const name = claims.name || claims.preferred_username || null;
    const telefono = claims.telefono || claims.phone_number || null;

    // Buscar por el id del provider (se reutiliza la función existente)
    let usuarioDb = await usuarioRepo.buscarPorKeycloakId(authProviderId);

    if (!usuarioDb) {
      // Si no existe por provider id, buscar por email para linkear cuentas
      if (email) {
        usuarioDb = await usuarioRepo.findByMail(email);

        if (usuarioDb) {
          console.log(`[Auth] Usuario existente por email (${email}). Linkeando al provider (Auth0)...`);
          // Reutilizamos la función linkKeycloak: asigna el id externo al usuario.
          // Idealmente renombrar linkKeycloak -> linkExternalAuth(provider, id)
          await usuarioRepo.linkKeycloak(email, authProviderId);

          usuarioDb = await usuarioRepo.buscarPorKeycloakId(authProviderId);
        } else {
          // Provisionar nuevo usuario si no existe por email
          console.log(`[Auth] Provisioning de nuevo usuario: ${name || email || authProviderId}`);

          // Leer roles desde el claim. Por defecto se espera un namespace en AUTH0_ROLES_NAMESPACE.
          // Si no existe, intenta leer claims comunes (roles, realm_access.roles).
          const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
          const roles =
            claims[rolesNamespace] ||
            claims.roles ||
            (claims.realm_access && claims.realm_access.roles) ||
            [];

          let tipoUsuario;
          if (Array.isArray(roles) && roles.includes('administrador')) {
            tipoUsuario = TipoDeUsuario.ADMIN;
          } else if (Array.isArray(roles) && roles.includes('vendedor')) {
            tipoUsuario = TipoDeUsuario.VENDEDOR;
          } else {
            tipoUsuario = TipoDeUsuario.COMPRADOR;
          }

          const nuevoUsuario = new Usuario(
            name || email || authProviderId,
            email,
            telefono || null,
            tipoUsuario,
            new Date()
          );
          // Reutilizamos la propiedad 'keycloakId' para guardar el id del provider externo.
          nuevoUsuario.keycloakId = authProviderId;

          try {
            usuarioDb = await usuarioRepo.save(nuevoUsuario);
          } catch (error) {
            // Manejo de race condition (mismo email creado por otra request)
            if (error.code === 11000) {
              console.warn(`[Auth] Race condition detectada para ${email || authProviderId}. Re-intentando búsqueda...`);
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms de espera
              usuarioDb = await usuarioRepo.findByMail(email);
            } else {
              throw error;
            }
          }
        }
      } else {
        // No hay email ni usuario encontrado por provider id: dejamos continuar pero avisamos
        console.warn(`[Auth] Token sin email: ${authProviderId}. No se pudo linkear ni provisionar.`);
      }
    }

    // Independientemente de si fue creado/linked, actualizamos el tipo según roles actuales
    const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
    const roles =
      claims[rolesNamespace] ||
      claims.roles ||
      (claims.realm_access && claims.realm_access.roles) ||
      [];

    let tipoActualizado;
    if (Array.isArray(roles) && roles.includes('administrador')) {
      tipoActualizado = TipoDeUsuario.ADMIN;
    } else if (Array.isArray(roles) && roles.includes('vendedor')) {
      tipoActualizado = TipoDeUsuario.VENDEDOR;
    } else {
      tipoActualizado = TipoDeUsuario.COMPRADOR;
    }

    if (usuarioDb && usuarioDb.tipo !== tipoActualizado) {
      console.log(`[Auth] Actualizando tipo de usuario ${usuarioDb.email || authProviderId}: ${usuarioDb.tipo} → ${tipoActualizado}`);
      usuarioDb.tipo = tipoActualizado;
      await usuarioRepo.update(usuarioDb._id, { tipo: tipoActualizado });
    }


    if (usuarioDb) {
      // Exponemos el usuario de DB para el resto de la app
      req.usuarioDb = usuarioDb;
    } else {
      console.error(`[Auth] No se pudo provisionar ni encontrar al usuario ${email || authProviderId}.`);
    }

    return next();
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      console.error("[Auth] Error de validación al provisionar usuario:", error.message);
      return res.status(400).json({ error: `Error de validación: ${error.message}` });
    }
    console.error("[Auth] Error fatal en el middleware de provisioning:", error);
    return res.status(500).json({ error: "Error al procesar la autenticación de usuario" });
  }
};

export { provisionUsuario };