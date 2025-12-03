import mongoose from "mongoose";
import { Pedido } from "../modulos/dominio/pedido.js";
import { ItemPedidoSchema } from "./itemPedidoSchema.js";
import { DireccionEntregaSchema } from "./direccionEntregaSchema.js";
import { CambioEstadoSchema } from "./cambioEstadoSchema.js";

const PedidoSchema = new mongoose.Schema({
  comprador: {
        type: String,
        required: true,
        index: true 
    },
  compradorExternal: {
      type: String,
      index: true,
      sparse: true,
    },
  items: { type: [ItemPedidoSchema], required: true },
  total: { type: Number, required: true },
  moneda: { type: String, enum: ["Peso_arg", "Dolar_usa", "Real"], required: true },
  direccionEntrega: { type: DireccionEntregaSchema, required: true },
  estado: { type: String, enum: ["Pendiente", "Confirmado", "En_preparacion","Enviado", "Entregado", "Cancelado"], default: "Pendiente" },
  fechaCreacion: { type: Date, default: Date.now, required: true },
  historialEstados: { type: [CambioEstadoSchema], default: [], required: true }
}, {
  timestamps: true,
  collection: 'pedidos'
});


PedidoSchema.pre(/^find/, function(next) {
  this.populate('items.producto');
    next();
});

PedidoSchema.loadClass(Pedido);

export const PedidoModel = mongoose.model('Pedido', PedidoSchema, "pedidos");

