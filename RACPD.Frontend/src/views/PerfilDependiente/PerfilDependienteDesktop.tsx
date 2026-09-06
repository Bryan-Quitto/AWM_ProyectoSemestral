import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { PerfilDependienteSchema, TIPOS_SANGRE, type PerfilDependienteForm, type ContactoEmergenciaForm, type TipoSangre } from './schema';
import { ContactosEmergenciaForm } from './ContactosEmergenciaForm';
import { Boton } from '../../components/Boton';
import { AlertTriangle, Plus, RotateCcw, Trash2, AlertCircle, CheckCircle2, Edit3, User, Droplets, Pill } from 'lucide-react';
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

export function PerfilDependienteDesktop() {
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
  const valoresInicialesDep = valoresIniciales;

  const form = useForm<PerfilDependienteForm>({
    resolver: zodResolver(PerfilDependienteSchema),
    defaultValues: valoresIniciales,
    mode: 'onChange',
  });

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

  const limpiarAlergias = () => {
    form.setValue('alergiasEstructuradas', [], {
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
        const resOptimistic = {
          ...(perfilExistente ?? {}),
          ...data,
          contactosEmergencia: data.contactosEmergencia,
          version: 1,
        } as const;
        void refetchMiDependiente(undefined as any, {
          optimisticData: perfilData?.data
            ? perfilData
            : { ...(perfilData as any), data: resOptimistic },
          revalidate: false,
          populateCache: true,
        } as any);
        const respuesta = (await crearPerfil(data)) as any;
        if (respuesta.status >= 400) {
          void refetchMiDependiente();
          handleErrors(respuesta);
          return;
        }
        // Revalidar SWR para que perfilExistente se llene y salga del modo edición.
        await refetchMiDependiente();
        setExito('Perfil dependiente creado con éxito.');
        setModoEditar(false);
      } else {
        const version = perfilExistente.version ?? 0;
        const resOptimistic = {
          ...perfilExistente,
          ...data,
          contactosEmergencia: data.contactosEmergencia,
        } as const;
        void refetchMiDependiente(undefined as any, {
          optimisticData: perfilData?.data
            ? perfilData
            : { ...(perfilData as any), data: resOptimistic },
          revalidate: false,
          populateCache: true,
        } as any);
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
        setExito('Ficha del dependiente actualizada correctamente.');
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
      <div className="p-8 text-center text-gray-500 bg-blue-50 min-h-screen">
        Cargando ficha del dependiente...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 bg-blue-50 min-h-screen">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">
            {existePerfil ? 'Ficha del Dependiente' : 'Crear Ficha del Dependiente'}
          </h1>
          <p className="text-blue-700 mt-1">
            Información crítica para el cuidado continuo y situaciones de emergencia.
          </p>
        </div>
        {existePerfil && (
          <div className="flex items-center gap-2">
            {!modoEditar && (
              <Boton
                type="button"
                variante="secundario"
                onClick={() => setModoEditar(true)}
                className="py-3 px-5 rounded-xl"
              >
                <Edit3 className="w-4 h-4 mr-2" /> Editar Ficha
              </Boton>
            )}
            {/*
            <Boton
              type="button"
              onClick={() =>
                navigate({ to: '/_protegidas/perfil-dependiente/sos' } as any)
              }
              className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-xl font-semibold shadow-md hover:shadow-lg"
            >
              <AlertTriangle className="w-5 h-5 mr-2" /> SOS Emergencia
            </Boton>
            */}
          </div>
        )}
      </div>

      {alerta && (
        <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">{alerta}</div>
        </div>
      )}
      {exito && (
        <div className="mb-5 p-4 bg-green-50 border-2 border-green-300 text-green-800 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{exito}</div>
        </div>
      )}

      {!modoEditar && existePerfil ? (
        <div className="space-y-6">
          {/* Tarjeta resumen - Vista de lectura */}
          <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-6 py-5 text-white">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-full p-3">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="font-bold text-xl leading-tight">
                    {perfilExistente.nombreCompleto}
                  </h2>
                  <p className="text-xs text-sky-50/90 mt-0.5">Paciente / Dependiente</p>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-blue-50 px-6 py-3">
              <li className="flex items-start gap-4 py-3">
                <Droplets className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tipo de Sangre
                  </p>
                  <p className="text-base font-bold text-gray-800">
                    {TIPO_SANGRE_LABELS[
                      (TIPOS_SANGRE as readonly string[]).includes(
                        perfilExistente.tipoSangre ?? ''
                      )
                        ? (perfilExistente.tipoSangre as TipoSangre)
                        : 'Desconocido'
                    ] ?? 'Desconocido'}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4 py-3">
                <Pill className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Condiciones Crónicas y Diagnósticos
                  </p>
                  <p className="text-lg text-gray-800 whitespace-pre-wrap break-words mt-0.5">
                    {perfilExistente.condicionesCronicas || (
                      <span className="italic text-gray-400">No registradas</span>
                    )}
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Alergias lectura */}
          <section className="bg-amber-50 rounded-2xl shadow-sm border-2 border-amber-300 p-6">
            <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-3 text-lg">
              <AlertTriangle className="w-5 h-5" /> Alergias Conocidas
            </h3>
            {alergias.length === 0 ? (
              <p className="text-sm text-amber-800 italic">
                Sin alergias registradas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {alergias.map((a, i) => (
                  <span
                    key={`${a}-${i}`}
                    className="px-3 py-1.5 bg-white text-amber-900 border border-amber-300 rounded-full text-base font-semibold shadow-sm"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Contactos lectura */}
          <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-100">
              <h3 className="font-bold text-blue-900 text-lg">
                Contactos de Emergencia
              </h3>
            </div>
            {contactos.length === 0 ? (
              <p className="p-6 text-center text-gray-500 text-xl italic">
                Sin contactos registrados. Pulsa "Editar Ficha" para añadir hasta 3.
              </p>
            ) : (
              <div className="divide-y divide-blue-50">
                {contactos.map((c, idx) => {
                  const cAny = c as unknown as ContactoEmergenciaForm;
                  return (
                    <div
                      key={`${cAny.telefonoWhatsApp ?? idx}-${idx}`}
                      className="px-6 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-xl truncate">
                          {cAny.nombre ?? 'Contacto'}
                        </p>
                        <p className="text-base text-gray-500">{cAny.relacion ?? ''}</p>
                        <p className="text-xl text-blue-600 mt-0.5 font-mono">
                          {cAny.telefonoWhatsApp ?? ''}
                        </p>
                      </div>
                      {/*
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={`tel:${cAny.telefonoWhatsApp ?? ''}`}
                          className="cursor-pointer disabled:cursor-not-allowed px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                          aria-label={`Llamar a ${cAny.nombre ?? ''}`}
                        >
                          📞 Llamar
                        </a>
                        <a
                          href={`https://wa.me/${(cAny.telefonoWhatsApp ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(
                            'Hola, te contactamos desde RACPD por una emergencia con el dependiente.'
                          )}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="cursor-pointer disabled:cursor-not-allowed px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                          aria-label={`Enviar WhatsApp a ${cAny.nombre ?? ''}`}
                        >
                          💬 WhatsApp
                        </a>
                      </div>
                      */}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        {/* Datos Básicos */}
        <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-5 border-b border-blue-100 pb-3">
            1. Datos Básicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Nombre Completo del Dependiente
              </label>
              <input
                type="text"
                {...form.register('nombreCompleto')}
                disabled={existePerfil}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition ${
                  existePerfil ? 'bg-blue-50 text-gray-600 cursor-default' : ''
                }`}
                placeholder="Nombre y apellidos"
              />
              {form.formState.errors.nombreCompleto?.message && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.nombreCompleto.message}
                </p>
              )}
              {existePerfil && (
                <p className="text-xs text-blue-600 mt-1">
                  El nombre no se puede modificar tras la creación.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Tipo de Sangre
              </label>
              <select
                {...form.register('tipoSangre')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition cursor-pointer"
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
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Condiciones Crónicas y Diagnósticos Relevantes
              </label>
              <textarea
                rows={4}
                {...form.register('condicionesCronicas')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-y"
                placeholder="Hipertensión arterial, Diabetes tipo 2, Epilepsia..."
              />
              {form.formState.errors.condicionesCronicas?.message && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.condicionesCronicas.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Alergias */}
        <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-5 border-b border-blue-100 pb-3">
            2. Alergias Conocidas
          </h2>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1">
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                placeholder="Ej: Penicilina, Maní, Mariscos..."
              />
            </div>
            <div className="flex gap-2">
              <Boton
                type="button"
                onClick={agregarAlergia}
                variante="secundario"
                disabled={!puedeAgregarAlergia}
                className="py-2.5 px-5 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Agregar
              </Boton>
              {alergias.length > 0 && (
                <Boton
                  type="button"
                  onClick={limpiarAlergias}
                  variante="secundario"
                  className="py-2.5 px-5 rounded-xl text-red-600 border-red-300 hover:bg-red-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Limpiar
                </Boton>
              )}
            </div>
          </div>
          {(form.formState.errors.alergiasEstructuradas as any)?.message && (
            <p className="text-red-500 text-xs mb-3">
              {(form.formState.errors.alergiasEstructuradas as any).message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {alergias.length === 0 && (
              <span className="text-sm text-gray-500 italic">
                Sin alergias registradas.
              </span>
            )}
            {alergias.map((a, idx) => (
              <span
                key={`${a}-${idx}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-sm font-medium"
              >
                {a}
                <button
                  type="button"
                  onClick={() => quitarAlergia(idx)}
                  className="cursor-pointer disabled:cursor-not-allowed p-0.5 rounded-full hover:bg-amber-200 transition disabled:opacity-50"
                  aria-label={`Quitar alergia ${a}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Contactos de Emergencia */}
        <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-5 border-b border-blue-100 pb-3">
            3. Contactos de Emergencia (máx. 3)
          </h2>
          <ContactosEmergenciaForm
            control={form.control as any}
            errors={form.formState.errors as any}
            contactos={contactos}
            append={appendContacto as any}
            remove={removeContacto}
            variant="desktop"
          />
        </section>

        <footer className="flex items-center justify-end gap-3 pt-4">
          <Boton
            type="button"
            variante="secundario"
            onClick={() => form.reset(valoresInicialesDep)}
            disabled={!isDirty || isCreando || isActualizando}
            className="py-2.5 px-6 rounded-xl"
          >
            Deshacer Cambios
          </Boton>
          <Boton
            type="submit"
            disabled={
              !isDirty ||
              !isValid ||
              isCreando ||
              isActualizando
            }
            cargando={isCreando || isActualizando}
            className="py-2.5 px-8 rounded-xl"
          >
            {isCreando || isActualizando
              ? 'Guardando...'
              : existePerfil
              ? 'Guardar Cambios'
              : 'Crear Ficha'}
          </Boton>
        </footer>
      </form>
      )}
    </div>
  );
}
