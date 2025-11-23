import dotenv from "dotenv"
import express from "express"
import { Server } from "./server.js"
import { MongoDBClient } from "./config/db.js"
import routes from "./rutas/routes.js"
import {PedidoController} from "./controllers/pedidoController.js"
import {PedidoService} from "./services/pedidoService.js"
import {PedidoRepository} from "./modulos/repos/pedidoRepository.js"
import {ProductoRepository} from "./modulos/repos/productoRepo.js"
import {ProductoService} from "./services/productoService.js"
import {ProductoController} from "./controllers/productoController.js"
import {NotificacionController} from "./controllers/notificacionController.js"
import {NotificacionService} from "./services/notificacionService.js"
import {NotificacionRepository} from "./modulos/repos/notificacionRepository.js"
import { UsuarioController } from "./controllers/usuarioController.js"
import { UsuarioService } from "./services/usuarioService.js"
import { UsuarioRepository } from "./modulos/repos/usuarioRepo.js"
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

//import { swaggerDocs } from "./config/swagger.js";

import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import YAML from 'yaml';

const app = express();

// 1. Leer el archivo YAML
const file = fs.readFileSync('./openapi.yml', 'utf8');

// 2. Parsear el contenido YAML a un objeto JavaScript (JSON)
const swaggerDocument = YAML.parse(file);

// 3. Configurar la ruta para servir Swagger UI
// La ruta '/api-docs' servirá la interfaz web de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.json())
app.use(cors());

//fotos
//app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir archivos estáticos desde /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));




// Configuramos el puerto con el .env
const port = process.env.PORT || 3000


dotenv.config();

// Se envía al server el puerto
const server = new Server(app, port)

// Repositorios
const pedidoRepository = new PedidoRepository();
const productoRepository = new ProductoRepository();
const notificacionRepository = new NotificacionRepository();
const usuarioRepository = new UsuarioRepository();

// Servicios
const pedidoService = new PedidoService(pedidoRepository, productoRepository, notificacionRepository);
const productoService = new ProductoService(productoRepository);
const notificacionService = new NotificacionService(notificacionRepository);
const usuarioService = new UsuarioService(usuarioRepository);


// Controladores
const pedidoController = new PedidoController(pedidoService);
const productoController = new ProductoController(productoService);
const notificacionController = new NotificacionController(notificacionService);
const usuarioController = new UsuarioController(usuarioService);

server.setController(PedidoController, pedidoController);
server.setController(ProductoController, productoController);
server.setController(NotificacionController, notificacionController);
server.setController(UsuarioController, usuarioController);

MongoDBClient.connect();

routes.forEach(route => server.addRoute(route))
server.configureRoutes();
server.launch();

