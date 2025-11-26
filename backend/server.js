import express from "express";
import cors from 'cors'; 
import session from 'express-session'; 
import { errorHandler } from "./middlewares/erroresMiddleware.js";
import { keycloak, memoryStore } from './config/keycloak.js'; 
import { provisionUsuario } from './middlewares/authMiddleware.js';
import path from "path";
import { UPLOADS_DIR } from "./middlewares/uploadMulter.js";

export class Server {
  #controllers = {}
  #app
  #routes
  
  constructor(app, port) {
    this.#app = app
    this.port = port
    this.#routes = []
    this.#app.use(express.json()) 
    
    this.#app.use(session({
      secret: 'tu_secreto_de_sesion_muy_largo', 
      resave: false,
      saveUninitialized: true,
      store: memoryStore
    }));

    this.#app.use(keycloak.middleware());
    this.#app.use("/uploads", express.static(path.join(UPLOADS_DIR)));
    this.#app.use(provisionUsuario);
  const corsOptions = {
  origin: "*", // Origen de tu frontend
  methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS", // Métodos permitidos
  allowedHeaders: "Content-Type, Authorization" // Headers permitidos
};
app.use(cors(corsOptions));
  }

  get app() {
    return this.#app
  }

  setController(controllerClass, controller) {
    this.#controllers[controllerClass.name] = controller
  }

  getController(controllerClass) {
    const controller = this.#controllers[controllerClass.name]
    if (!controller) {
      throw new Error("Controller missing for the given route.")
    }
    return controller;
  }

  addRoute(route) {
    this.#routes.push(route)
  }

  configureRoutes() {
    this.#routes.forEach(route => this.#app.use(route(this.getController.bind(this)))) 
    this.#app.use(errorHandler);
  }

  launch() {
    this.app.listen(this.port, () => {
      console.log("Server running on port " + this.port)
    });
  }
}
