import express from "express";
import cors from "cors";
import 'dotenv/config';
import { errorHandler } from "./middlewares/erroresMiddleware.js";
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

    // Body parser
    this.#app.use(express.json());

    // Parse allowed origins from env (no spaces, support '*' wildcard)
    const allowedEnv = (process.env.ALLOWED_ORIGINS || "http://localhost:3000");
    const allowed = allowedEnv.split(",").map(s => s.trim()).filter(Boolean);
    const allowAny = allowed.includes("*");

    const corsOptions = {
      origin: function (origin, callback) {
        // permitir requests sin origin (herramientas como curl, o solicitudes desde el mismo host)
        if (!origin) return callback(null, true);
        if (allowAny) return callback(null, true);
        if (allowed.indexOf(origin) !== -1) {
          return callback(null, true);
        } else {
          return callback(new Error("CORS origin denied"));
        }
      },
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
      credentials: true,
      optionsSuccessStatus: 204,
    };

    // Montar CORS globalmente ANTES de rutas y middlewares que puedan bloquear OPTIONS
    this.#app.use(cors(corsOptions));

    // Asegurar que respondemos a preflight OPTIONS rápidamente
    // (no usar app.options('*', ...) porque algunas versiones de path-to-regexp no aceptan '*')
    this.#app.use((req, res, next) => {
      // Aunque cors() ya añade headers, devolvemos 204 para los OPTIONS y terminamos ahí.
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    });

    // Extra: asegurar headers CORS también para respuestas de error donde algún middleware
    // anterior pudiera no haber ejecuado cors() (fallback seguro).
    this.#app.use((req, res, next) => {
      try {
        const origin = req.headers.origin;
        if (origin && (allowAny || allowed.indexOf(origin) !== -1)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
        } else if (allowAny) {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Accept,X-Requested-With");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } catch (e) {
        // no bloquear por fallo de header
      }
      next();
    });

    // Archivos estáticos para uploads
    this.#app.use("/uploads", express.static(path.join(UPLOADS_DIR)));

    // NOTA: no aplicamos provisionUsuario globalmente aquí porque req.auth sólo existe
    // cuando se ejecuta checkJwt en rutas protegidas.
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