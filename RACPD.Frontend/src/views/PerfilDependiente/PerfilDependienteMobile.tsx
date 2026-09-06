import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { PerfilDependienteSchema, TIPOS_SANGRE, type PerfilDependienteForm, type ContactoEmergenciaForm, type TipoSangre } from './schema';
import { ContactosEmergenciaForm } from './ContactosEmergenciaForm';
import { Boton } from '../../components/Boton';
import { AlertTriangle, Edit3, X, Plus, Trash2, AlertCircle, CheckCircle2, User, Droplets, Pill } from 'lucide-react';
import {
  useRACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteEndpoint,
  useRACPDBackendFeaturesPerfilesDependientesCrearPerfilDependienteCrearPerfilDependienteEndpoint,
  useRACPDBackendFeaturesPerfilesDependientesActualizarPerfilDependienteActualizarPerfilDependienteEndpoint,
} from '../../api/generated/api/api';
import type { RACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteResponse } from '../../api/generated/model';

const TIPO_SANGRE_LABELS: Record<TipoSangre, string> = {
  APositivo: 'A+',
  ANegativo: 'A−',
  BPositivo: 'B+',
  BNegativo: 'B−',
  ABPositivo: 'AB+',
  ABNegativo: 'AB−',
  OPositivo: 'O+',
  ONegativo: 'O−',
  Desconocido: 'Desconocido',
};

export function PerfilDependienteMobile() {
  const navigate = useNavigate();
  const [modoEditar, setModoEditar] = useState(false);
  const [alergiaInput, setAlergiaInput] = useState('');
  const [exito, setExito] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);

  const {
    data: perfilData,
    isLoading: isCargandoPerfil,
    mutate: refetchMiDependiente,
  } = useRACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteEndpoint();

  const perfilExistente: RACPDBackendFeaturesPerfilesDependientesObtenerMiDependienteObtenerMiDependienteResponse | undefined =
    perfilData && 'data' in perfilData ? (perfilData as any).data : undefined;
  const existePerfil = !!perfilExistente?.id;

  const tipoSangreExistente = perfilExistente?.tipoSangre as TipoSangre | undefined;
  const valoresIniciales: PerfilDependienteForm = useMemo(
    () => ({
      nombreCompleto: perfilExistente?.nombreCompleto ?? '',
      tipoSangre:
        (TIPOS_SANGRE as readonly string[]).includes(
          tipoSangreExistente ?? ''
        )
          ? (tipoSangreExistente as TipoSangre)
          : 'Desconocido',
      condicionesCronicas: perfilExistente?.condicionesCronicas ?? '',
      alergiasEstructuradas: perfilExistente?.alergiasEstructuradas ?? [],
      contactosEmergencia:
        (perfilExistente?.contactosEmergencia as ContactoEmergenciaForm[]) ?? [],
    }),
    [perfilExistente]
  );

  const form = useForm<PerfilDependienteForm>({
    resolver: zodResolver(PerfilDependienteSchema),
    defaultValues: valoresIniciales,
    mode: 'onChange',
  });
  const valoresInicialesDep = valoresIniciales;
  const { isDirty, isValid } = form.formState;

  const alergias = form.watch('alergiasEstructuradas') ?? [];
  const {
    fields: contactos,
    append: appendContacto,
    remove: removeContacto,
  } = useFieldArray({
    control: form.control,
    name: 'contactosEmergencia',
  });

  const { trigger: crearPerfil, isMutating: isCreando } =
    useRACPDBackendFeaturesPerfilesDependientesCrearPerfilDependienteCrearPerfilDependienteEndpoint();
  const { trigger: actualizarPerfil, isMutating: isActualizando } =
    useRACPDBackendFeaturesPerfilesDependientesActualizarPerfilDependienteActualizarPerfilDependienteEndpoint(
      perfilExistente?.id ?? '00000000-0000-0000-0000-000000000000'
    );

  useEffect(() => {
    if (perfilExistente) {
      form.reset(valoresInicialesDep);
    }
  }, [perfilExistente?.id]);

  useEffect(() => {
    if (!existePerfil) {
      setModoEditar(true);
    }
  }, [existePerfil]);

  const puedeAgregarAlergia =
    alergiaInput.trim().length >= 1 &&
    !alergias.some((a) => a.trim().toLowerCase() === alergiaInput.trim().toLowerCase()) &&
    alergias.length < 50;

  const agregarAlergia = () => {
    if (!puedeAgregarAlergia) return;
    form.setValue('alergiasEstructuradas', [...alergias, alergiaInput.trim()], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setAlergiaInput('');
  };

  const quitarAlergia = (idx: number) => {
    const siguientes = alergias.filter((_, i) => i !== idx);
    form.setValue('alergiasEstructuradas', siguientes, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleErrors = (respuesta: any) => {
    if (respuesta.status === 409) {
      setAlerta(
        respuesta.data?.detail ??
          'Conflicto de concurrencia: alguien más actualizó la ficha. Recargando la última versión...'
      );
      void refetchMiDependiente();
      setTimeout(() => setAlerta(null), 6000);
      return true;
    }
    if (respuesta.data?.errors) {
      Object.entries(respuesta.data.errors).forEach(([key, mensajes]) => {
        const campo = key.startsWith('contactosEmergencia')
          ? key
          : key.charAt(0).toLowerCase() + key.slice(1);
        const msgs = mensajes as string[];
        if (msgs?.[0]) {
          form.setError(campo as any, { type: 'manual', message: msgs[0] });
        }
      });
      return true;
    }
    if (respuesta.data?.detail) {
      setAlerta(respuesta.data.detail);
      setTimeout(() => setAlerta(null), 5000);
      return true;
    }
    return false;
  };

  const onSubmit = async (data: PerfilDependienteForm) => {
    setExito(null);
    setAlerta(null);
    try {
      if (!existePerfil) {
        const respuesta = (await crearPerfil(data)) as any;
        if (respuesta.status >= 400) {
          void refetchMiDependiente();
          handleErrors(respuesta);
          return;
        }
        // Revalidar SWR para que perfilExistente se llene con los datos del backend
        // y los valores del formulario reflejen la ficha recién creada. Después
        // salir de modo edición para mostrar la vista de lectura.
        await refetchMiDependiente();
        setExito('Ficha creada correctamente.');
        setModoEditar(false);
      } else {
        const version = perfilExistente.version ?? 0;
        const respuesta = (await actualizarPerfil({
          ...data,
          version,
        })) as any;
        if (respuesta.status >= 400) {
          void refetchMiDependiente();
          handleErrors(respuesta);
          return;
        }
        await refetchMiDependiente();
        setExito('Ficha actualizada correctamente.');
        setModoEditar(false);
      }
      setTimeout(() => setExito(null), 4500);
    } catch {
      void refetchMiDependiente();
      setAlerta('Ocurrió un error de red. Intente de nuevo en unos segundos.');
      setTimeout(() => setAlerta(null), 5000);
    }
  };

  if (isCargandoPerfil) {
    return (
      <div className="min-h-screen bg-blue-50 p-6 text-center text-blue-800">
        Cargando ficha del dependiente...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 pb-10">
      <header className="bg-white px-5 py-4 shadow-sm border-b border-blue-100 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-900">
              {existePerfil ? 'Ficha del Dependiente' : 'Crear Ficha'}
            </h1>
            <p className="text-xs text-blue-600">Información crítica y SOS</p>
          </div>
          {existePerfil && !modoEditar && (
            <button
              type="button"
              onClick={() => setModoEditar(true)}
              className="cursor-pointer disabled:cursor-not-allowed px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition inline-flex items-center gap-1.5 font-medium text-sm disabled:opacity-50"
            >
              <Edit3 className="w-4 h-4" /> Editar
            </button>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4">
        {/* BOTÓN SOS (80% width, Mobile) */}
        {existePerfil && !modoEditar && (
          <button
            type="button"
            onClick={() => navigate({ to: '/_protegidas/perfil-dependiente/sos' } as any)}
            className="cursor-pointer disabled:cursor-not-allowed mx-auto block w-[80%] bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 transition disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" /> SOS EMERGENCIA
            </span>
          </button>
        )}

        {alerta && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm">{alerta}</div>
          </div>
        )}
        {exito && (
          <div className="p-3.5 bg-green-50 border-2 border-green-300 text-green-800 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm font-medium">{exito}</div>
          </div>
        )}

        {!modoEditar && existePerfil ? (
          <div className="space-y-4">
            {/* Tarjeta resumen */}
            <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
              <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2.5">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{perfilExistente.nombreCompleto}</h2>
                    <p className="text-xs text-sky-50/90">Paciente / Dependiente</p>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-blue-50 px-5 py-2">
                <li className="flex items-start gap-3 py-3">
                  <Droplets className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500">Tipo de Sangre</p>
                    <p className="text-base font-bold text-gray-800">
                      {TIPO_SANGRE_LABELS[
                        (TIPOS_SANGRE as readonly string[]).includes(perfilExistente.tipoSangre ?? '')
                          ? (perfilExistente.tipoSangre as TipoSangre)
                          : 'Desconocido'
                      ] ?? 'Desconocido'}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 py-3">
                  <Pill className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500">Condiciones Crónicas</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {perfilExistente.condicionesCronicas || (
                        <span className="italic text-gray-400">No registradas</span>
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Alergias */}
            <section className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-4">
              <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" /> Alergias Conocidas
              </h3>
              {alergias.length === 0 ? (
                <p className="text-sm text-amber-800 italic">Sin alergias registradas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {alergias.map((a, i) => (
                    <span
                      key={`${a}-${i}`}
                      className="px-3 py-1.5 bg-white text-amber-900 border border-amber-300 rounded-full text-sm font-semibold shadow-sm"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Contactos */}
            <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                <h3 className="font-bold text-blue-900">Contactos de Emergencia</h3>
              </div>
              <div className="divide-y divide-blue-50">
                {contactos.length === 0 && (
                  <p className="p-5 text-center text-gray-500 text-sm italic">
                    Sin contactos registrados.
                  </p>
                )}
                {(perfilExistente.contactosEmergencia as ContactoEmergenciaForm[] | undefined)?.map(
                  (c, idx) => (
                    <div key={`${c?.telefonoWhatsApp ?? idx}-${idx}`} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {c?.nombre ?? 'Contacto'}
                          </p>
                          <p className="text-xs text-gray-500">{c?.relacion ?? ''}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <a
                            href={`tel:${c?.telefonoWhatsApp ?? ''}`}
                            className="cursor-pointer disabled:cursor-not-allowed px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                            aria-label={`Llamar a ${c?.nombre ?? ''}`}
                          >
                            📞 Llamar
                          </a>
                          <a
                            href={`https://wa.me/${
                              (c?.telefonoWhatsApp ?? '').replace(/\D/g, '')
                            }?text=${encodeURIComponent(
                              'Hola, te contactamos desde RACPD por una emergencia con el dependiente.'
                            )}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="cursor-pointer disabled:cursor-not-allowed px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                            aria-label={`Enviar WhatsApp a ${c?.nombre ?? ''}`}
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit as any)}
            className="space-y-4"
          >
            {modoEditar && existePerfil && (
              <div className="flex items-center justify-between bg-white rounded-2xl border border-blue-200 px-4 py-3 shadow-sm">
                <p className="font-semibold text-blue-900 text-sm">Modo Edición Activo</p>
                <button
                  type="button"
                  onClick={() => {
                    form.reset(valoresInicialesDep);
                    setModoEditar(false);
                  }}
                  className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full text-gray-500 hover:bg-gray-100 transition disabled:opacity-50"
                  aria-label="Cerrar edición"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4 space-y-3">
              <h2 className="text-lg font-semibold text-blue-900">Datos Básicos</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  {...form.register('nombreCompleto')}
                  disabled={existePerfil}
                  className={`w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition ${
                    existePerfil ? 'bg-blue-50 text-gray-600' : ''
                  }`}
                />
                {form.formState.errors.nombreCompleto?.message && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.nombreCompleto.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Sangre</label>
                <select
                  {...form.register('tipoSangre')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition cursor-pointer"
                >
                  {TIPOS_SANGRE.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_SANGRE_LABELS[t]}
                    </option>
                  ))}
                </select>
                {form.formState.errors.tipoSangre?.message && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.tipoSangre.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condiciones Crónicas
                </label>
                <textarea
                  rows={4}
                  {...form.register('condicionesCronicas')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-none"
                />
                {form.formState.errors.condicionesCronicas?.message && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.condicionesCronicas.message}
                  </p>
                )}
              </div>
            </section>

            {/* Alergias compacto */}
            <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">Alergias</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={alergiaInput}
                  onChange={(e) => setAlergiaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarAlergia();
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                  placeholder="Nueva alergia..."
                />
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={agregarAlergia}
                  disabled={!puedeAgregarAlergia}
                  className="py-2 px-4 rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                </Boton>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {alergias.length === 0 && (
                  <span className="text-xs text-gray-500 italic">Sin alergias registradas.</span>
                )}
                {alergias.map((a, idx) => (
                  <span
                    key={`${a}-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-semibold"
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => quitarAlergia(idx)}
                      className="cursor-pointer disabled:cursor-not-allowed p-0.5 rounded-full hover:bg-amber-200 transition disabled:opacity-50"
                      aria-label={`Quitar alergia ${a}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {(form.formState.errors.alergiasEstructuradas as any)?.message && (
                <p className="text-red-500 text-xs">
                  {(form.formState.errors.alergiasEstructuradas as any).message}
                </p>
              )}
            </section>

            {/* Contactos Mobile */}
            <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">Contactos de Emergencia</h2>
              <ContactosEmergenciaForm
                control={form.control as any}
                errors={form.formState.errors as any}
                contactos={contactos}
                append={appendContacto as any}
                remove={removeContacto}
                variant="mobile"
              />
            </section>

            <div className="pt-2">
              <Boton
                type="submit"
                disabled={
                  !isValid ||
                  (existePerfil && !isDirty) ||
                  isCreando ||
                  isActualizando
                }
                cargando={isCreando || isActualizando}
                className="w-full py-3 rounded-xl font-semibold"
              >
                {isCreando || isActualizando
                  ? 'Guardando...'
                  : existePerfil
                  ? 'Guardar Cambios'
                  : 'Crear Ficha del Dependiente'}
              </Boton>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
