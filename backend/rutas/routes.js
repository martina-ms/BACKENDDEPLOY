import healthRoutes from "./healthRoutes.js"
import helloRoutes from "./helloRoutes.js"
import pedidoRoutes from "./pedidoRoutes.js"
import notificacionRoutes from "./notificacionRoutes.js"
import usuarioRoutes from "./usuarioRoutes.js"
import productoRoutes from "./productoRoutes.js"
import debugAuth from "./debugAuth.js"

// Acá hay que agregar todas las rutas de nuestra app
const routes = [
  healthRoutes,
  helloRoutes,
  pedidoRoutes,
  notificacionRoutes,
  productoRoutes,
  usuarioRoutes,
  debugAuth
]

export default routes