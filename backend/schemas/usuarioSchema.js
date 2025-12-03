import mongoose from "mongoose";
import { Usuario } from "../modulos/dominio/usuario.js";

const UsuarioSchema = new mongoose.Schema({
	nombre: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	telefono: { type: String },
	tipo: { type: String, enum: ["comprador", "vendedor", "admin"], required: true },
	fechaAlta: { type: Date, default: Date.now, required: true },
	keycloakId: {
  		type: String,
  		unique: true,
  		sparse: true 
},
	auth0Id: {
    	type: String,
    	unique: true,
    	sparse: true
  },

  //roles extraídos del token (ej: ['vendedor','admin'])
  	roles: {
    	type: [String],
    	default: []
  }
}, {
	collection: 'usuarios'
});

try {
  UsuarioSchema.loadClass(Usuario);
} catch (err) {
  // Si ya se cargó la clase, ignoramos el error para no romper el arranque
  // (normalmente no pasa, pero lo dejamos por robustez)
  // console.warn("UsuarioSchema.loadClass: ", err.message);
}

// Evitar OverwriteModelError en entornos donde los módulos se importan varias veces
export const UsuarioModel = mongoose.models.Usuario
  ? mongoose.models.Usuario
  : mongoose.model('Usuario', UsuarioSchema, 'usuarios');