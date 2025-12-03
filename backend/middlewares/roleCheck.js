export default function roleCheck(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = allowed.map(r => String(r).toLowerCase());

  return (req, res, next) => {
    try {
      // 1) Roles desde req.auth (token)
      const claims = req.auth || {};
      const rolesNamespace = process.env.AUTH0_ROLES_NAMESPACE || "https://tienda.example.com/roles";
      const tokenRoles =
        claims[rolesNamespace] ||
        claims.roles ||
        (claims.realm_access && claims.realm_access.roles) ||
        [];

      // 2) Roles desde usuario en DB (provisionUsuario)
      const dbRoles = Array.isArray(req.usuarioDb && req.usuarioDb.roles) ? req.usuarioDb.roles : [];

      const effectiveRoles = Array.from(new Set([].concat(tokenRoles || [], dbRoles || [])))
        .map(r => String(r).toLowerCase());

      // Comparar
      const matched = normalizedAllowed.some(r => effectiveRoles.includes(r));

      if (matched) return next();

      // Alternativa: también permitir si req.usuarioDb.tipo coincide con TipoDeUsuario enum
      if (req.usuarioDb && req.usuarioDb.tipo) {
        const tipo = String(req.usuarioDb.tipo).toLowerCase();
        // Mapear TipoDeUsuario a cadenas si hace falta (ej: TipoDeUsuario.VENDEDOR)
        if (normalizedAllowed.includes(tipo)) return next();
      }

      return res.status(403).json({ msg: "Forbidden - role missing" });
    } catch (err) {
      console.error("[roleCheck] error:", err);
      return res.status(500).json({ error: "Error verificando roles" });
    }
  };
}