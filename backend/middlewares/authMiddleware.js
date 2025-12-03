import { UsuarioRepository } from '../modulos/repos/usuarioRepo.js';
import { Usuario } from '../modulos/dominio/usuario.js';
import { TipoDeUsuario } from '../modulos/dominio/tipoDeUsuario.js';
import { UsuarioModel } from '../schemas/usuarioSchema.js'

const usuarioRepo = new UsuarioRepository();

const provisionUsuario = async (req, res, next) => {
  try {
    // Debug: mostrar si viene Authorization header
    const authHeader = req.headers && req.headers.authorization;
    console.log(`[PROV] incoming request ${req.method} ${req.originalUrl} - Authorization present: ${!!authHeader}`);

    // express-jwt coloca las claims en req.auth
    const claims = req.auth || null;
    console.log("[PROV] claims:", claims ? Object.keys(claims) : null);

    if (!claims) {
      // No hay token: dejamos pasar (rutas públicas)
      return next();
    }

    // Id del sujeto (Auth0) y datos básicos
    const authProviderId = claims.sub;
    const email = claims.email || null;
    const name = claims.name || claims.preferred_username || null;
    const telefono = claims.telefono || claims.phone_number || null;

    console.log(`[PROV] authProviderId: ${authProviderId} email: ${email} name: ${name}`);

    // Intentamos un upsert atómico para evitar buscar-crear en múltiples pasos.
    // Construimos el documento a setear
    const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
    const rolesClaim =
      claims[rolesNamespace] ||
      claims.roles ||
      (claims.realm_access && claims.realm_access.roles) ||
      [];
    const roles = Array.isArray(rolesClaim) ? rolesClaim : [];

    let tipoUsuario;
    if (Array.isArray(roles) && (roles.includes('administrador') || roles.includes('admin'))) {
      tipoUsuario = TipoDeUsuario.ADMIN;
    } else if (Array.isArray(roles) && roles.includes('vendedor')) {
      tipoUsuario = TipoDeUsuario.VENDEDOR;
    } else {
      tipoUsuario = TipoDeUsuario.COMPRADOR;
    }

    const upsertFields = {
      nombre: name || email?.split("@")[0] || authProviderId,
      email: email,
      telefono: telefono || null,
      tipo: tipoUsuario,
      // guardamos roles explícitamente
      roles: roles,
      // guarda provider id; tu schema actual usa keycloakId, lo mantenemos para compatibilidad
      keycloakId: authProviderId,
      // si tienes auth0Id en el schema, considera guardarlo también:
      auth0Id: authProviderId
    };

    // Primero intentamos usar un método atómico del repo (si existe)
    if (typeof usuarioRepo.upsertPorExternalIdOEmail === "function") {
      console.log("[PROV] Usando usuarioRepo.upsertPorExternalIdOEmail");
      const usuarioDb = await usuarioRepo.upsertPorExternalIdOEmail(authProviderId, email, upsertFields);
      console.log("[PROV] upsert result (repo):", usuarioDb ? `${usuarioDb._id} ${usuarioDb.email}` : null);
      req.usuarioDb = usuarioDb;
      return next();
    }

    // Fallback: upsert directo con mongoose (si tu repo no implementa upsert)
    console.log("[PROV] Fallback a upsert directo con UsuarioModel");
    const filter = authProviderId ? { $or: [{ keycloakId: authProviderId }, { auth0Id: authProviderId }] } : (email ? { email } : null);

    if (!filter) {
      console.warn("[PROV] No hay authProviderId ni email para hacer upsert");
      return next();
    }

    // Usamos findOneAndUpdate con upsert para operación atómica
    const update = {
      $set: upsertFields,
      $setOnInsert: { fechaAlta: new Date() }
    };
    const opts = { new: true, upsert: true, setDefaultsOnInsert: true };
    const usuarioDb = await UsuarioModel.findOneAndUpdate(filter, update, opts);
    console.log("[PROV] upsert result (mongoose):", usuarioDb ? `${usuarioDb._id} ${usuarioDb.email}` : null);
    req.usuarioDb = usuarioDb;

    return next();
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      console.error("[PROV] Error de validación al provisionar usuario:", error.message);
      return res.status(400).json({ error: `Error de validación: ${error.message}` });
    }
    console.error("[PROV] Error fatal en el middleware de provisioning:", error);
    // No dejamos pasar silently: devolvemos 500 para rutas protegidas que asuman usuario
    return res.status(500).json({ error: "Error al procesar la autenticación de usuario" });
  }
};

export { provisionUsuario };