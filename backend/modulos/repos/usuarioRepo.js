import { UsuarioModel } from "../../schemas/usuarioSchema.js";

export class UsuarioRepository {
    constructor() {
        this.model = UsuarioModel;
    }

    async save(usuario) {
        const nuevoUsuario = new this.model(usuario);
        return await nuevoUsuario.save();
    }

    async findAll() {
        return await this.model.find();
    }

    async findByMail(email) {
        return await this.model.findOne({ email: email });
    }

    async buscarPorKeycloakId(id) {

        return UsuarioModel.findOne({ keycloakId: id });
    }

    async linkKeycloak(email, keycloakId) {
        // Busca al usuario por email y le setea el keycloakId
        return await this.model.updateOne(
            { email: email },
            { $set: { keycloakId: keycloakId } }
        );
    }

    async update(id, nuevosCampos) {
        return await this.model.updateOne(
            { _id: id },
            { $set: nuevosCampos }
        );
    }
     async upsertPorExternalIdOEmail(externalId, email, upsertFields = {}) {
    // Campos a setear: eliminamos keys con valor null para no insertar email:null
    const setFields = {};
    for (const [k, v] of Object.entries(upsertFields)) {
      if (v !== undefined && v !== null) {
        setFields[k] = v;
      }
    }

    const update = {
      $set: setFields,
      $setOnInsert: { fechaAlta: new Date() }
    };
    const opts = { new: true, upsert: true, setDefaultsOnInsert: true };

    // 1) Si tenemos externalId, intentamos upsert por él
    if (externalId) {
      try {
        const filterByExternal = { $or: [{ keycloakId: externalId }, { auth0Id: externalId }] };
        const userByExternal = await UsuarioModel.findOneAndUpdate(filterByExternal, update, opts);
        if (userByExternal) return userByExternal;
      } catch (err) {
        // Si hay un error de duplicado distinto a email (raro), relanzar
        if (err.code && err.code !== 11000) throw err;
        // si es 11000, lo manejaremos intentando por email si existe
      }
    }

    // 2) Si tenemos email y no existe usuario por externalId, intentamos upsert por email
    if (email) {
      try {
        const filterByEmail = { email };
        const userByEmail = await UsuarioModel.findOneAndUpdate(filterByEmail, update, opts);
        if (userByEmail) return userByEmail;
      } catch (err) {
        if (err.code && err.code !== 11000) throw err;
      }
    }

    // 3) Si no se encontró por externalId ni por email (puede ser que no haya email),
    //    y tenemos externalId, creamos el usuario explicitamente (sin email si no existe)
    if (externalId) {
      const docData = { ...setFields };
      // aseguramos que el provider id quede en el campo auth0Id (y/o keycloakId)
      // preferimos guardar en auth0Id para mayor claridad; si quieres mantener keycloakId,
      // podes setearlo también.
      docData.auth0Id = externalId;
      // No incluir email si email no existe
      const newDoc = new UsuarioModel(docData);
      return await newDoc.save();
    }

    // Si no hay ni externalId ni email -> no podemos crear
    return null;
  }


}
