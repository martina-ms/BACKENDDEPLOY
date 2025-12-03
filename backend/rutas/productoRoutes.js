import { ProductoController } from "../controllers/productoController.js";
import express from "express";
import { upload } from "../middlewares/uploadMulter.js";
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js";
import roleCheck from "../middlewares/roleCheck.js";

const pathProducto = "/productos";

export default function productoRoutes(getController) {
  const router = express.Router();

  // POST protegido: primero validar token (checkJwt), opcionalmente provisionUsuario, opcional checkRole
  // IMPORTANTE: colocar checkJwt ANTES de upload para que rechace sin procesar el body si no está autorizado.
  router.post(
    pathProducto,
    checkJwt,
    provisionUsuario, 
    roleCheck(["vendedor", "administrador"]), 
    upload.array("fotos", 10),
    (req, res, next) => {
      getController(ProductoController).crear(req, res, next);
    }
  );

  router.get(pathProducto, (req, res, next) => {
    getController(ProductoController).listar(req, res,next);
  });

  router.get(pathProducto + "/top", (req, res, next) => {
    getController(ProductoController).masVendidos(req, res,next);
  });

  router.get(pathProducto + "/:id", (req, res, next) => {
    getController(ProductoController).obtenerPorId(req, res, next);
  });

  return router;
}