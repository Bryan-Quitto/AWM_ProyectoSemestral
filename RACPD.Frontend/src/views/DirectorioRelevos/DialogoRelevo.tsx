import { useState, useMemo, useRef, useCallback } from 'react';
import { z } from 'zod';
import { X, AlertTriangle, Check } from 'lucide-react';
import { Boton } from '../../components/Boton';
import { normalizarTelefonoEcuador } from '../../schemas/telefono';
import type {
  CrearRelevoBody,
  EditarRelevoBody,
} from '../../features/directorio-relevos/hooks/useDirectorioRelevos';

const telefonoRegex = /^(?:\+?593|0)?9\d{8}$/;

const SIN_SIMBOLOS_CONTROL = /^[\P{Cc}\P{Cf}\P{Co}]*$/u;

const colapsarEspacios = (s: string): string =>
  s.replace(/\s+/g, ' ').trim();

// === Schema CREAR ===
// Todos los campos obligatorios (excepto notas). Validamos contra
// los valores YA normalizados en el submit.
const crearRelevoSchema = z.object({
  perfilDependienteId: z.string().uuid('Selecciona un dependiente válido'),
  usuarioApoyoId: z.string().uuid('Selecciona un usuario de apoyo'),
  nombre: z
    .string()
    .min(1, 'El nombre no puede estar vacío')
    .max(150, 'Máximo 150 caracteres')
    .regex(SIN_SIMBOLOS_CONTROL, 'No uses caracteres de control')
    .transform(colapsarEspacios)
    .refine((v) => v.length >= 2, 'El nombre es demasiado corto'),
  telefono: z
    .string()
    .transform(normalizarTelefonoEcuador)
    .pipe(
      z
        .string()
        .regex(telefonoRegex, 'Formato: +593 9XXXXXXXX o 09XXXXXXXX'),
    ),
  estado: z.enum(['Disponible', 'NoDisponible']).default('Disponible'),
  notas: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .regex(SIN_SIMBOLOS_CONTROL, 'No uses caracteres de control')
    .optional()
    .transform((v) => (v && v.length > 0 ? colapsarEspacios(v) : undefined)),
});

// === Schema EDITAR (PATCH-like, .strict) ===
// Cada campo es opcional. Si viene, se valida con la MISMA regla que en
// crear. Si no viene (undefined), no se incluye en el body → el backend
// conserva el valor actual.
const campoNombre = z
  .string()
  .max(150, 'Máximo 150 caracteres')
  .regex(SIN_SIMBOLOS_CONTROL, 'No uses caracteres de control')
  .transform(colapsarEspacios)
  .refine((v) => v.length >= 2, 'El nombre es demasiado corto');

const campoTelefono = z
  .string()
  .transform(normalizarTelefonoEcuador)
  .pipe(
    z
      .string()
      .regex(telefonoRegex, 'Formato: +593 9XXXXXXXX o 09XXXXXXXX'),
  );

const campoNotas = z
  .string()
  .max(500, 'Máximo 500 caracteres')
  .regex(SIN_SIMBOLOS_CONTROL, 'No uses caracteres de control')
  .transform((v) => colapsarEspacios(v));

const editarRelevoSchema = z
  .object({
    nombre: campoNombre.optional(),
    telefono: campoTelefono.optional(),
    estado: z.enum(['Disponible', 'NoDisponible']).optional(),
    notas: campoNotas.optional(),
  })
  .strict()
  .refine(
    (obj) => Object.values(obj).some((v) => v !== undefined),
    { message: 'No hay cambios para guardar' },
  );

export type CrearRelevoFormData = z.infer<typeof crearRelevoSchema>;
export type EditarRelevoFormData = z.infer<typeof editarRelevoSchema>;

export interface UsuarioApoyoItem {
  id: string;
  nombreCompleto: string;
  correo: string;
}

export interface PerfilDependienteItem {
  id: string;
  nombreCompleto: string;
}

export interface RelevoEditarItem {
  id: string;
  nombre?: string;
  telefono?: string;
  estado?: 'Disponible' | 'NoDisponible';
  notas?: string | null;
}

type Modo = 'crear' | 'editar';

interface DialogoRelevoProps {
  abierto: boolean;
  modo: Modo;
  onCerrar: () => void;
  onSubmitCrear?: (data: CrearRelevoBody) => Promise<void>;
  onSubmitEditar?: (id: string, data: EditarRelevoBody) => Promise<void>;
  isMutating: boolean;
  apiError: string | null;
  perfilesDependientes: PerfilDependienteItem[];
  usuariosDeApoyo: UsuarioApoyoItem[];
  /** Por defecto, el del primer perfil que el usuario administra como Principal. */
  perfilDependienteInicialId?: string;
  /** Datos del relevo a editar (solo en modo editar). */
  relevoEditar?: RelevoEditarItem | null;
}

/**
 * Modal unificado para crear o editar un relevo del Directorio.
 *
 * UI ligada a dominio (se queda en /views, no en /components, por la
 * REGLA-AHA-UI). Cumple REGLA-UX-INTERACCIONES: cursor-pointer en todos
 * los botones y `disabled:cursor-not-allowed disabled:opacity-50` en
 * los bloqueados.
 *
 * El campo "Dependiente" y "Usuario de apoyo" sólo se muestran en modo
 * crear: en modo editar son inmutables (cambiar de usuarioApoyoId o
 * perfilDependienteId requeriría eliminar y crear).
 */
export const DialogoRelevo = ({
  abierto,
  modo,
  onCerrar,
  onSubmitCrear,
  onSubmitEditar,
  isMutating,
  apiError,
  perfilesDependientes,
  usuariosDeApoyo,
  perfilDependienteInicialId,
  relevoEditar,
}: DialogoRelevoProps) => {
  const perfilInicial = useMemo(() => {
    if (perfilDependienteInicialId) return perfilDependienteInicialId;
    return perfilesDependientes[0]?.id ?? '';
  }, [perfilDependienteInicialId, perfilesDependientes]);

  const [perfilDependienteId, setPerfilDependienteId] = useState(perfilInicial);
  const [usuarioApoyoId, setUsuarioApoyoId] = useState('');
  const [nombre, setNombre] = useState(() => (modo === 'editar' ? relevoEditar?.nombre ?? '' : ''));
  const [telefono, setTelefono] = useState(() => (modo === 'editar' ? relevoEditar?.telefono ?? '' : ''));
  const [estado, setEstado] = useState<'Disponible' | 'NoDisponible'>(
    () => (modo === 'editar' ? relevoEditar?.estado ?? 'Disponible' : 'Disponible'),
  );
  const [notas, setNotas] = useState(() => (modo === 'editar' ? relevoEditar?.notas ?? '' : ''));
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  // Campos que el usuario ya tocó (onBlur). Solo mostramos errores a
  // partir del primer blur → primer submit, sin embargo, sí muestra
  // TODOS para que el cuidador sepa qué falta.
  const [tocados, setTocados] = useState<Partial<Record<string, boolean>>>({});
  // En modo editar, marca los campos que el usuario cambió
  // explícitamente. Solo esos viajan al PUT (PATCH-like semantics real).
  const dirtyRef = useRef<Set<string>>(new Set());

  // Helpers de blur/change que marcan el campo como tocado y revalidan
  // solo ese campo si ya fue tocado antes (UX de no spamear errores).
  const validarCampo = useCallback(
    (campo: string, valor: unknown) => {
      if (modo === 'crear') {
        const parcial = crearRelevoSchema.safeParse({
          perfilDependienteId,
          usuarioApoyoId,
          nombre,
          telefono,
          estado,
          notas: notas || undefined,
          [campo]: valor,
        });
        setErrores((prev) => {
          const next = { ...prev };
          const issue = parcial.success
            ? null
            : parcial.error.issues.find((i) => String(i.path[0]) === campo);
          if (issue) next[campo] = issue.message;
          else delete next[campo];
          return next;
        });
      }
    },
    [modo, perfilDependienteId, usuarioApoyoId, nombre, telefono, estado, notas],
  );

  const onBlurCampo = useCallback(
    (campo: string, valor: unknown) => {
      setTocados((prev) => ({ ...prev, [campo]: true }));
      validarCampo(campo, valor);
    },
    [validarCampo],
  );

  const marcarDirty = useCallback((campo: string) => {
    dirtyRef.current.add(campo);
  }, []);

  if (!abierto) return null;

  const handleSubmit = async () => {
    setErrores({});
    if (modo === 'crear') {
      const validacion = crearRelevoSchema.safeParse({
        perfilDependienteId,
        usuarioApoyoId,
        nombre,
        telefono,
        estado,
        notas: notas || undefined,
      });
      if (!validacion.success) {
        const nuevosErrores: Record<string, string> = {};
        for (const issue of validacion.error.issues) {
          const key = String(issue.path[0] ?? '');
          if (key && !nuevosErrores[key]) {
            nuevosErrores[key] = issue.message;
          }
        }
        setErrores(nuevosErrores);
        // Marca todos como tocados para que el rojo no desaparezca al re-tipear
        setTocados({
          perfilDependienteId: true,
          usuarioApoyoId: true,
          nombre: true,
          telefono: true,
          estado: true,
          notas: true,
        });
        return;
      }
      if (onSubmitCrear) {
        // Enviamos los valores YA normalizados por Zod
        const data = validacion.data;
        await onSubmitCrear({
          perfilDependienteId: data.perfilDependienteId,
          usuarioApoyoId: data.usuarioApoyoId,
          nombre: data.nombre,
          telefono: data.telefono,
          estado: data.estado,
          notas: data.notas,
        });
      }
    } else {
      if (!relevoEditar) return;
      // PATCH-like semantics: solo enviamos los campos que el usuario
      // tocó explícitamente desde que abrió el modal de edición.
      const dirty = dirtyRef.current;
      const body: EditarRelevoBody = {};

      if (dirty.has('nombre')) body.nombre = colapsarEspacios(nombre);
      if (dirty.has('telefono')) {
        body.telefono = normalizarTelefonoEcuador(telefono);
      }
      if (dirty.has('estado')) body.estado = estado;
      if (dirty.has('notas')) {
        const notasLimpias = colapsarEspacios(notas);
        // string vacío = "limpiar" en backend; sin tocar = no enviar
        body.notas = notasLimpias.length === 0 ? '' : notasLimpias;
      }

      const validacion = editarRelevoSchema.safeParse(body);
      if (!validacion.success) {
        const nuevosErrores: Record<string, string> = {};
        for (const issue of validacion.error.issues) {
          const key = String(issue.path[0] ?? '');
          if (key && !nuevosErrores[key]) {
            nuevosErrores[key] = issue.message;
          }
        }
        setErrores(nuevosErrores);
        setTocados({
          nombre: true,
          telefono: true,
          estado: true,
          notas: true,
        });
        return;
      }
      if (onSubmitEditar) {
        await onSubmitEditar(relevoEditar.id, validacion.data);
      }
    }
  };

  const handleCerrar = () => {
    setErrores({});
    setTocados({});
    dirtyRef.current.clear();
    onCerrar();
  };

  const esCrear = modo === 'crear';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCerrar}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleCerrar}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${esCrear ? 'bg-blue-100' : 'bg-amber-100'}`}>
            <AlertTriangle
              className={`w-6 h-6 ${esCrear ? 'text-blue-600' : 'text-amber-600'}`}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {esCrear ? 'Agregar relevo' : 'Editar relevo'}
            </h3>
            <p className="text-sm text-gray-600">
              {esCrear
                ? 'Vincula un usuario de apoyo al directorio de tu dependiente.'
                : 'Modifica los datos del relevo. El dependiente y el usuario de apoyo no se pueden cambiar.'}
            </p>
          </div>
        </div>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="space-y-4">
          {/* Dependiente — solo en crear */}
          {esCrear && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dependiente
              </label>
              <select
                value={perfilDependienteId}
                onChange={(e) => {
                  setPerfilDependienteId(e.target.value);
                  onBlurCampo('perfilDependienteId', e.target.value);
                }}
                onBlur={() => onBlurCampo('perfilDependienteId', perfilDependienteId)}
                disabled={isMutating || !perfilesDependientes.length}
                aria-label="Seleccionar dependiente"
                aria-invalid={!!errores.perfilDependienteId}
                className={`w-full px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  errores.perfilDependienteId
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-blue-200 focus:ring-blue-500'
                }`}
              >
                {perfilesDependientes.length === 0 && (
                  <option value="">No tienes dependientes como cuidador principal</option>
                )}
                {perfilesDependientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombreCompleto}
                  </option>
                ))}
              </select>
              {errores.perfilDependienteId && (
                <p className="text-xs text-red-600 mt-1">{errores.perfilDependienteId}</p>
              )}
            </div>
          )}

          {/* Usuario de apoyo — solo en crear */}
          {esCrear && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario de apoyo
              </label>
              <select
                value={usuarioApoyoId}
                onChange={(e) => {
                  setUsuarioApoyoId(e.target.value);
                  onBlurCampo('usuarioApoyoId', e.target.value);
                }}
                onBlur={() => onBlurCampo('usuarioApoyoId', usuarioApoyoId)}
                disabled={isMutating || !usuariosDeApoyo.length}
                aria-label="Seleccionar usuario de apoyo"
                aria-invalid={!!errores.usuarioApoyoId}
                className={`w-full px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  errores.usuarioApoyoId
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-blue-200 focus:ring-blue-500'
                }`}
              >
                <option value="">Selecciona...</option>
                {usuariosDeApoyo.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombreCompleto} ({u.correo})
                  </option>
                ))}
              </select>
              {errores.usuarioApoyoId && (
                <p className="text-xs text-red-600 mt-1">{errores.usuarioApoyoId}</p>
              )}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre a mostrar
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (!esCrear) marcarDirty('nombre');
              }}
              onBlur={() => onBlurCampo('nombre', nombre)}
              maxLength={150}
              placeholder="Ej: María Pérez"
              disabled={isMutating}
              aria-invalid={!!errores.nombre}
              className={`w-full px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 cursor-text disabled:cursor-not-allowed disabled:opacity-50 ${
                errores.nombre
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-blue-200 focus:ring-blue-500'
              }`}
            />
            {errores.nombre && (
              <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value);
                if (!esCrear) marcarDirty('telefono');
              }}
              onBlur={() => onBlurCampo('telefono', telefono)}
              maxLength={20}
              placeholder="+593 9XXXXXXXX"
              disabled={isMutating}
              aria-invalid={!!errores.telefono}
              className={`w-full px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 cursor-text disabled:cursor-not-allowed disabled:opacity-50 ${
                errores.telefono
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-blue-200 focus:ring-blue-500'
              }`}
            />
            {errores.telefono && (
              <p className="text-xs text-red-600 mt-1">{errores.telefono}</p>
            )}
            {!errores.telefono && telefono && tocados.telefono && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Teléfono válido
              </p>
            )}
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEstado('Disponible');
                  if (!esCrear) marcarDirty('estado');
                }}
                disabled={isMutating}
                aria-pressed={estado === 'Disponible'}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  estado === 'Disponible'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Disponible
              </button>
              <button
                type="button"
                onClick={() => {
                  setEstado('NoDisponible');
                  if (!esCrear) marcarDirty('estado');
                }}
                disabled={isMutating}
                aria-pressed={estado === 'NoDisponible'}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  estado === 'NoDisponible'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                No disponible
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
              <span
                className={`float-right text-xs ${
                  notas.length > 500 ? 'text-red-600' : 'text-gray-400'
                }`}
              >
                {notas.length}/500
              </span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => {
                setNotas(e.target.value);
                if (!esCrear) marcarDirty('notas');
              }}
              onBlur={() => onBlurCampo('notas', notas)}
              maxLength={500}
              rows={2}
              placeholder="Información adicional para tu familia..."
              disabled={isMutating}
              aria-invalid={!!errores.notas}
              className={`w-full px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 cursor-text disabled:cursor-not-allowed disabled:opacity-50 resize-none ${
                errores.notas
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-blue-200 focus:ring-blue-500'
              }`}
            />
            {errores.notas && (
              <p className="text-xs text-red-600 mt-1">{errores.notas}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Boton
            variante="secundario"
            onClick={handleCerrar}
            className="flex-1 cursor-pointer"
            disabled={isMutating}
          >
            Cancelar
          </Boton>
          <Boton
            onClick={handleSubmit}
            className="flex-1 cursor-pointer disabled:cursor-not-allowed"
            disabled={
              isMutating ||
              (esCrear && Object.keys(errores).length > 0)
            }
            cargando={isMutating}
          >
            {isMutating ? 'Guardando...' : esCrear ? 'Agregar relevo' : 'Guardar cambios'}
          </Boton>
        </div>
      </div>
    </div>
  );
};

/**
 * Alias retro-compatible. El Contenedor (versión anterior) importa
 * `DialogoCrearRelevo`; mantenemos el nombre para no romper imports
 * existentes. Ambos componentes son idénticos; este es solo un alias
 * semántico del mismo export.
 */
export const DialogoCrearRelevo = DialogoRelevo;
