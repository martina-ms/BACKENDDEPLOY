import { z } from "zod";

export class PedidoController {
  constructor(pedidoService) {
    this.pedidoService = pedidoService;
  }

  async crear(req, res, next) {
    try {
      const body = req.body;
      const resultBody = pedidoSchema.safeParse(body);

      if (resultBody.error) {
        res.status(400).json(resultBody.error.issues);
        return;
      }

      // Resolver compradorId de forma robusta
      const compradorId =
        (req.usuarioDb && (req.usuarioDb._id || req.usuarioDb.id)) ||
        (req.auth && req.auth.sub) ||
        (req.user && (req.user.id || req.user._id)) ||
        null;

      console.log("[PEDIDO] crear - compradorId resolved:", compradorId);

      if (!compradorId) {
        res.status(401).json({ error: "No se pudo identificar al comprador desde el token." });
        return;
      }

      const datosPedido = {
        ...resultBody.data,
        comprador: compradorId,
        compradorExternal: req.auth && req.auth.sub ? String(req.auth.sub) : undefined,
      };

      try {
        const nuevoPedido = await this.pedidoService.crear(datosPedido);
        res.status(201).json(nuevoPedido.toObject ? nuevoPedido.toObject() : nuevoPedido);
      } catch (error) {
        next(error);
      }
    } catch (err) {
      console.error("[PEDIDO] Error en crear:", err);
      next(err);
    }
  }

  async historialPorUsuario(req, res, next) {
    try {
      const resultId = keycloakIdParamSchema.safeParse(req.params);

      if (resultId.error) {
        res.status(400).json(resultId.error.issues);
        return;
      }

      const id = resultId.data.id;
      try {
        const pedidosUsuario = await this.pedidoService.historialPorUsuario(id);

        if (!pedidosUsuario || pedidosUsuario.length === 0) {
          res.status(404).json({ error: "No se encontraron pedidos para ese usuario." });
          return;
        }

        const pedidosParaRespuesta = pedidosUsuario.map((pedido) => {
          const pedidoPlano = pedido.toObject ? pedido.toObject() : { ...pedido };

          return {
            _id: pedidoPlano._id,
            comprador: pedidoPlano.comprador,
            items: pedidoPlano.items.map((item) => ({
              producto: item.producto,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
            })),
            total: pedidoPlano.total,
            moneda: pedidoPlano.moneda,
            direccionEntrega: pedidoPlano.direccionEntrega,
            estado: pedidoPlano.estado,
            fechaCreacion: pedidoPlano.fechaCreacion,
            historialEstados: (pedidoPlano.historialEstados || []).map((cambio) => ({
              fecha: cambio.fecha,
              estado: cambio.estado,
              usuario: cambio.usuario,
              motivo: cambio.motivo,
            })),
          };
        });

        res.status(200).json(pedidosParaRespuesta);
      } catch (error) {
        next(error);
      }
    } catch (err) {
      console.error("[PEDIDO] Error en historialPorUsuario:", err);
      next(err);
    }
  }

  async cancelar(req, res, next) {
    return this.procesarAccion(req, res, next, this.pedidoService.cancelar.bind(this.pedidoService));
  }

  async enviar(req, res, next) {
    return this.procesarAccion(req, res, next, this.pedidoService.enviar.bind(this.pedidoService));
  }

  async confirmar(req, res, next) {
    return this.procesarAccion(req, res, next, this.pedidoService.confirmar.bind(this.pedidoService));
  }

  async procesarAccion(req, res, next, accionService) {
    const resultId = idParamSchema.safeParse(req.params);
    if (resultId.error) {
      return res.status(400).json(resultId.error.issues);
    }
    const idPedido = resultId.data.id;

    const resultBody = modificarPedidoSchema.safeParse(req.body);
    if (resultBody.error) {
      return res.status(400).json(resultBody.error.issues);
    }
    const { idUsuario, motivo } = resultBody.data;

    try {
      const pedidoCancelado = await accionService(idPedido, idUsuario, motivo);

      const pedidoParaRespuesta = {
        _id: pedidoCancelado._id,
        comprador: pedidoCancelado.comprador,
        items: pedidoCancelado.items.map((item) => ({
          producto: item.producto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
        total: pedidoCancelado.total,
        moneda: pedidoCancelado.moneda,
        direccionEntrega: pedidoCancelado.direccionEntrega,
        estado: pedidoCancelado.estado,
        fechaCreacion: pedidoCancelado.fechaCreacion,
        historialEstados: pedidoCancelado.historialEstados.map((cambio) => ({
          fecha: cambio.fecha,
          estado: cambio.estado,
          usuario: cambio.usuario,
          motivo: cambio.motivo,
        })),
      };

      res.status(200).json(pedidoParaRespuesta);
    } catch (error) {
      next(error);
    }
  }
}

const objectIdSchema = z.string().length(24, "El ID debe ser un ObjectId de 24 caracteres.");

const keycloakIdSchema = z.string().min(1, "El ID de usuario no puede estar vacío.");

const direccionEntregaSchemaZod = z.object({
  calle: z.string().min(1),
  altura: z.number().int().positive(),
  codigoPostal: z.string().min(1),
  ciudad: z.string().min(1),
  provincia: z.string().min(1),
  pais: z.string().min(1),
  // opcionales:
  piso: z.number().int().positive().optional(),
  departament: z.string().min(1).max(5).optional(),
  lat: z.string().min(1).max(20).optional(),
  lon: z.string().min(1).max(20).optional(),
});

const itemSchemaZod = z.object({
  producto: objectIdSchema,
  cantidad: z.number().int().nonnegative().min(1),
});

const monedaEnumSchemaZod = z.enum(["Peso_arg", "Dolar_usa", "Real"], {
  errorMap: () => ({ message: "Moneda inválida." }),
});

export const pedidoSchema = z
  .object({
    items: z.array(itemSchemaZod).min(1, "El pedido debe tener al menos un item."),
    moneda: monedaEnumSchemaZod,
    direccionEntrega: direccionEntregaSchemaZod,
  })
  .passthrough();

export const modificarPedidoSchema = z.object({
  idUsuario: keycloakIdSchema, // ID del usuario que realiza el cambio
  motivo: z.string().nonempty("El motivo no puede estar vacío.").optional(),
});

// Esquema para validar los parámetros de la URL (req.params)
const idParamSchema = z.object({
  id: objectIdSchema,
});

const keycloakIdParamSchema = z.object({
  id: keycloakIdSchema,
});