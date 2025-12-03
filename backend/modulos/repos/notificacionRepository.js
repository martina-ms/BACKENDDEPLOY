import mongoose from "mongoose";
import { NotificacionModel } from "../../schemas/notificacionSchema.js";
import { UsuarioModel } from "../../schemas/usuarioSchema.js";
const { Types } = mongoose;

export class NotificacionRepository {
  constructor() {
    this.model = NotificacionModel;
  }

  _isObjectId(value) {
    return Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === String(value);
  }

  /**
   * Resuelve un possible identificador (ObjectId o external id) a ObjectId de usuario.
   * - Busca por auth0Id, keycloakId o email si el identificador no parece ObjectId.
   * - Devuelve ObjectId o null.
   */
  async _resolveUsuarioObjectId(usuarioIdentifier) {
    if (!usuarioIdentifier) return null;
    if (this._isObjectId(usuarioIdentifier)) {
      return new Types.ObjectId(usuarioIdentifier);
    }
    const usuario = await UsuarioModel.findOne({
      $or: [{ auth0Id: usuarioIdentifier }, { keycloakId: usuarioIdentifier }, { email: usuarioIdentifier }],
    })
      .select("_id")
      .lean()
      .exec();
    if (!usuario) return null;
    return this._isObjectId(usuario._id) ? new Types.ObjectId(usuario._id) : usuario._id;
  }

  /**
   * Construye un filtro para buscar notificaciones de un usuario dado.
   * Soporta:
   * - usuarioIdentifier = ObjectId string => buscar por usuarioDestino (ObjectId)
   * - usuarioIdentifier = external id (auth0|...) => buscar por usuarioKeycloakId OR por usuarioDestino resuelto
   */
  async _buildUsuarioFilter(usuarioIdentifier) {
    if (!usuarioIdentifier) return null;

    // Si parece ObjectId, devolver filtro por usuarioDestino
    if (this._isObjectId(usuarioIdentifier)) {
      return { usuarioDestino: new Types.ObjectId(usuarioIdentifier) };
    }

    // Si no es ObjectId, intentamos resolver a usuario DB id
    const resolved = await this._resolveUsuarioObjectId(usuarioIdentifier);

    // Si resolvimos a DB id, buscamos ambos: usuarioDestino (ObjectId) o usuarioKeycloakId (string)
    if (resolved) {
      return {
        $or: [{ usuarioDestino: resolved }, { usuarioKeycloakId: usuarioIdentifier }],
      };
    }

    // Si no resolvimos, al menos filtramos por usuarioKeycloakId (documentos creados sin resolver tendrán ese campo)
    return { usuarioKeycloakId: usuarioIdentifier };
  }

  async findAll() {
    return await this.model.find().lean().exec();
  }

  async findById(id) {
    return await this.model.findOne({ _id: id }).populate("usuarioDestino").lean().exec();
  }

  async findNoLeidas(usuarioIdentifier) {
    const filtro = await this._buildUsuarioFilter(usuarioIdentifier);
    if (!filtro) return [];
    return this.model
      .find({ ...filtro, leida: false })
      .populate("usuarioDestino")
      .sort({ fechaAlta: -1 })
      .lean()
      .exec();
  }

  async findLeidas(usuarioIdentifier) {
    const filtro = await this._buildUsuarioFilter(usuarioIdentifier);
    if (!filtro) return [];
    return this.model
      .find({ ...filtro, leida: true })
      .populate("usuarioDestino")
      .sort({ fechaAlta: -1 })
      .lean()
      .exec();
  }

  async marcarComoLeida(id) {
    return this.model
      .findByIdAndUpdate(id, { leida: true, fechaLeida: new Date() }, { new: true, runValidators: true })
      .populate("usuarioDestino")
      .lean()
      .exec();
  }

  /**
   * create(payload)
   * - Si recibe usuarioKeycloakId intenta resolver a usuarioDestino (ObjectId).
   * - Si no encuentra usuario, NO lanza excepción: guarda usuarioKeycloakId para trazabilidad
   *   y deja usuarioDestino = null, para no romper el flujo que origina la notificación.
   */
  async create(data) {
    const payload = { ...data };

    let usuarioDestinoId = null;

    if (payload.usuarioDestino && typeof payload.usuarioDestino === "string" && this._isObjectId(payload.usuarioDestino)) {
      // si viene usuarioDestino ya como string ObjectId, convertir a ObjectId
      usuarioDestinoId = new Types.ObjectId(payload.usuarioDestino);
      payload.usuarioDestino = usuarioDestinoId;
    } else if (payload.usuarioKeycloakId) {
      // Si nos pasan usuarioKeycloakId, puede ser ObjectId o external id
      try {
        if (this._isObjectId(payload.usuarioKeycloakId)) {
          // buscar por _id directamente
          const usuarioById = await UsuarioModel.findById(payload.usuarioKeycloakId).select("_id auth0Id keycloakId email").lean().exec();
          if (usuarioById && usuarioById._id) {
            usuarioDestinoId = new Types.ObjectId(usuarioById._id);
            payload.usuarioDestino = usuarioDestinoId;
            // conservar usuarioKeycloakId para trazabilidad
            payload.usuarioKeycloakId = payload.usuarioKeycloakId;
          } else {
            // no encontramos por _id: intentar resolver como external id
            const usuarioByExternal = await UsuarioModel.findOne({
              $or: [{ auth0Id: payload.usuarioKeycloakId }, { keycloakId: payload.usuarioKeycloakId }, { email: payload.usuarioKeycloakId }],
            })
              .select("_id auth0Id keycloakId email")
              .lean()
              .exec();
            if (usuarioByExternal && usuarioByExternal._id) {
              usuarioDestinoId = new Types.ObjectId(usuarioByExternal._id);
              payload.usuarioDestino = usuarioDestinoId;
              payload.usuarioKeycloakId = payload.usuarioKeycloakId;
            } else {
              // no hay usuario; loguear y dejar usuarioDestino null
              console.warn(`[NotificacionRepository.create] No se encontró usuario para usuarioKeycloakId=${payload.usuarioKeycloakId}`, { payload });
              payload.usuarioDestino = null;
            }
          }
        } else {
          // usuarioKeycloakId no es ObjectId: resolver por external id
          const usuarioByExternal = await UsuarioModel.findOne({
            $or: [{ auth0Id: payload.usuarioKeycloakId }, { keycloakId: payload.usuarioKeycloakId }, { email: payload.usuarioKeycloakId }],
          })
            .select("_id auth0Id keycloakId email")
            .lean()
            .exec();
          if (usuarioByExternal && usuarioByExternal._id) {
            usuarioDestinoId = new Types.ObjectId(usuarioByExternal._id);
            payload.usuarioDestino = usuarioDestinoId;
            payload.usuarioKeycloakId = payload.usuarioKeycloakId;
          } else {
            console.warn(`[NotificacionRepository.create] No se encontró usuario para usuarioKeycloakId=${payload.usuarioKeycloakId}`, { payload });
            payload.usuarioDestino = null;
          }
        }
      } catch (err) {
        console.error("[NotificacionRepository.create] Error resolviendo usuarioKeycloakId:", err, { payload });
        payload.usuarioDestino = null;
      }
    }

    // Normalizaciones adicionales
    if (payload.pedido && typeof payload.pedido === "string" && this._isObjectId(payload.pedido)) {
      payload.pedido = new Types.ObjectId(payload.pedido);
    }

    if (payload.fechaAlta && typeof payload.fechaAlta === "string") {
      const d = new Date(payload.fechaAlta);
      if (!Number.isNaN(d.getTime())) payload.fechaAlta = d;
      else delete payload.fechaAlta;
    }

    if (!payload.mensaje && !payload.title) {
      payload.mensaje = payload.title || `Notificación para pedido ${String(payload.pedido || "").slice(0, 8)}`;
    }

    const notif = new this.model(payload);
    try {
      const saved = await notif.save();
      return saved.toObject ? saved.toObject() : saved;
    } catch (err) {
      console.error("[NotificacionRepository.create] Error al guardar notificación:", {
        message: err.message,
        name: err.name,
        code: err.code,
        errInfo: err.errInfo,
        validationErrors: err.errors ? Object.keys(err.errors).map(k => ({ field: k, message: err.errors[k].message })) : undefined,
        payload,
      });
      throw err;
    }
  }

  async marcarTodasLeidas(usuarioIdentifier) {
    const filtro = this._isObjectId(usuarioIdentifier)
      ? { usuarioDestino: new Types.ObjectId(usuarioIdentifier) }
      : { $or: [{ usuarioKeycloakId: usuarioIdentifier }, { usuarioDestino: await this._resolveUsuarioObjectId(usuarioIdentifier) }] };

    const filter = { ...filtro, leida: { $ne: true } };
    const update = { $set: { leida: true, fechaLeida: new Date() } };
    const result = await this.model.updateMany(filter, update).exec();
    return {
      acknowledged: result.acknowledged ?? true,
      matchedCount: result.matchedCount ?? result.n ?? 0,
      modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
    };
  }
}