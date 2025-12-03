import express from "express";
import { checkJwt } from "../config/auth0.js";
import { provisionUsuario } from "../middlewares/authMiddleware.js";


export default function debugAuth() {
const router = express.Router();


// Endpoint público para probar token: retorna req.auth si token válido
router.get("/debug/auth", checkJwt, (req, res) => {
    return res.json({
      ok: true,
      message: "checkJwt pasó OK",
      auth: req.auth || null
    });
});

return router;
}
