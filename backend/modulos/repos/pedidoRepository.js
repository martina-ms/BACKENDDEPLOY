import {PedidoModel} from "../../schemas/pedidoSchema.js";
import mongoose from "mongoose";
import {UsuarioModel} from "../../schemas/usuarioSchema.js";
const { Types } = mongoose;

export class PedidoRepository {
  constructor() {
    this.model = PedidoModel;
  }

  _isObjectId(value) {
    return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
  }

  /**
   * Crear un pedido.
   * - Acepta data que incluya comprador (DB id string) y/o compradorExternal (external id string).
   * - Normaliza comprador a string si viene ObjectId y guarda compradorExternal si está presente.
   */
  async crear(pedido) {
    const payload = { ...pedido };

    // Normalizar comprador a string si viene como ObjectId (Types.ObjectId o string 24 hex)
    if (payload.comprador && this._isObjectId(String(payload.comprador))) {
      payload.comprador = String(payload.comprador);
    }

    // Asegurar que compradorExternal se persista si lo pasan
    if (payload.compradorExternal && typeof payload.compradorExternal !== "string") {
      payload.compradorExternal = String(payload.compradorExternal);
    }

    const nuevoPedido = new this.model(payload);
    return await nuevoPedido.save();
  }

  async buscarPorId(id) {
    return await this.model.findById(id).populate("items.producto").exec();
  }

  /**
   * Buscar por identificador de usuario.
   * Soporta tanto DB id (comprador) como compradorExternal.
   */
  async buscarPorUsuarioId(id) {
    if (!id) return [];

    if (this._isObjectId(String(id))) {
      return await this.model
        .find({ $or: [{ comprador: String(id) }, { compradorExternal: String(id) }] })
        .populate("items.producto")
        .exec();
    }

    // id no es ObjectId -> buscar por compradorExternal y, si no hay resultados, intentar resolver usuario y buscar por comprador DB id
    let results = await this.model.find({ compradorExternal: String(id) }).populate("items.producto").exec();
    if (results && results.length > 0) return results;

    const usuario = await UsuarioModel.findOne({
      $or: [{ auth0Id: id }, { keycloakId: id }, { email: id }],
    })
      .select("_id")
      .lean()
      .exec();

    if (usuario && usuario._id) {
      return await this.model.find({ comprador: String(usuario._id) }).populate("items.producto").exec();
    }

    return [];
  }

  async actualizarElEstado(id, pedido) {
    return await this.model
      .findByIdAndUpdate(
        id,
        { estado: pedido.estado, historialEstados: pedido.historialEstados },
        { new: true }
      )
      .populate("items.producto")
      .exec();
  }

  /**
   * historialPorUsuario: busca pedidos por id:
   * - si id parece ObjectId -> buscar por comprador o compradorExternal
   * - sino -> buscar por compradorExternal, fallback a resolver usuario -> buscar por comprador DB id
   */
  async historialPorUsuario(id) {
    if (!id) return [];

    const isObjectId = this._isObjectId(String(id));
    if (isObjectId) {
      // buscar por comprador (DB id) y por compradorExternal por compatibilidad
      const byComprador = await this.model.find({ comprador: String(id) }).populate("items.producto").exec();
      if (byComprador && byComprador.length > 0) return byComprador;

      const byExternal = await this.model.find({ compradorExternal: String(id) }).populate("items.producto").exec();
      return byExternal || [];
    }

    // id no es ObjectId: buscar por compradorExternal
    const byExternal = await this.model.find({ compradorExternal: String(id) }).populate("items.producto").exec();
    if (byExternal && byExternal.length > 0) return byExternal;

    // fallback: intentar resolver usuario por external id y buscar por comprador DB id
    const usuario = await UsuarioModel.findOne({
      $or: [{ auth0Id: id }, { keycloakId: id }, { email: id }],
    })
      .select("_id")
      .lean()
      .exec();

    if (usuario && usuario._id) {
      const byUserId = await this.model.find({ comprador: String(usuario._id) }).populate("items.producto").exec();
      return byUserId || [];
    }

    return [];
  }
}