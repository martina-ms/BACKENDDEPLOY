import {z} from "zod"

export class UsuarioController {
    constructor(usuarioService) {
        this.usuarioService = usuarioService;
    }

    async crear(req,res,next) {
        const body = req.body
        const resultBody = usuarioSchema.safeParse(body)
    
        if(resultBody.error) {
            res.status(400).json(resultBody.error.issues)
            return
        }

        try {
            const nuevoUsuario = await this.usuarioService.crear(resultBody.data);
            res.status(201).json(nuevoUsuario);
            
        } catch (error) {
            next(error);
        }
    }

    async obtenerTodos(req, res, next) {
        try {
            const usuario = await this.usuarioService.buscarTodos();
            res.json(usuario);
        } catch (error) {
            next(error);
        }
    }

}
    
const tipoUsuarioSchemaZod = z.enum(["comprador", "vendedor", "admin"], {
    errorMap: () => ({ message: "Usuario inválido." })
});

const usuarioSchema = z.object({
    nombre: z.string().min(1),
    email: z.string().min(3).max(30),
    telefono: z.string().min(7).max(15),
    tipo: tipoUsuarioSchemaZod,
});

