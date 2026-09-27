import { useState, useMemo, useCallback } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  useDirectorioRelevos,
  useCrearRelevo,
  useEditarRelevo,
  useEliminarRelevo,
} from '../../features/directorio-relevos/hooks/useDirectorioRelevos';
import { useRACPDBackendFeaturesUsuariosUsuariosDeApoyoListarUsuariosDeApoyoListarUsuariosDeApoyoEndpoint } from '../../api/generated/api/api';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api';
import type {
  RACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoRequest,
} from '../../api/generated/model';
import { DialogoRelevo, type RelevoEditarItem } from './DialogoRelevo';
import { DialogoConfirmarEliminar } from './DialogoConfirmarEliminar';
import { DirectorioRelevosDesktop } from './DirectorioRelevosDesktop';
import { DirectorioRelevosMobile } from './DirectorioRelevosMobile';
import type { RelevoItemResponse } from '../../features/directorio-relevos/hooks/useDirectorioRelevos';

/**
 * Contenedor de la pantalla de Directorio de Relevos.
 *
 * Bifurca entre Mobile y Desktop según el viewport (regla Dual Views).
 *
 * Persona 2 / Semana 2 — extensión: maneja aquí el modal (crear + editar)
 * para compartirlo entre Desktop y Mobile sin duplicar estado (REGLA-AHA-UI:
 * el modal es UI de dominio; queda en /views).
 *
 * Solo el CuidadorPrincipal del dependiente ve los botones "Agregar" y
 * "Editar"; los cuidadores de Apoyo solo pueden VER el directorio y
 * contactar (WhatsApp / Llamar).
 */
export const DirectorioRelevosContenedor = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // === Estado de filtros (server-side) ===
  const [filtroDependienteId, setFiltroDependienteId] = useState<string | undefined>(undefined);

  // === Datos ===
  const { relevos, isLoading, mutate } = useDirectorioRelevos({
    terminoBusqueda: undefined,
    estado: undefined,
    perfilDependienteId: filtroDependienteId,
  });

  const { data: usuariosDeApoyoData } =
    useRACPDBackendFeaturesUsuariosUsuariosDeApoyoListarUsuariosDeApoyoListarUsuariosDeApoyoEndpoint();
  const usuariosDeApoyoExitoso =
    usuariosDeApoyoData?.status === 200 && Array.isArray(usuariosDeApoyoData.data)
      ? (usuariosDeApoyoData.data as Array<{ usuarioId?: string; nombreCompleto?: string; correo?: string }>)
      : [];
  const usuariosDeApoyo = usuariosDeApoyoExitoso
    .filter((u) => u.usuarioId)
    .map((u) => ({
      id: u.usuarioId as string,
      nombreCompleto: u.nombreCompleto ?? '',
      correo: u.correo ?? '',
    }));

  const { data: misDependientesData } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();
  const misDependientesExitoso =
    misDependientesData?.status === 200 && Array.isArray(misDependientesData.data)
      ? (misDependientesData.data as Array<{
          perfilId?: string;
          nombreCompleto?: string;
          rolEnDependiente?: string;
          puedeEditar?: boolean;
        }>)
      : [];
  const perfilesDependientes = misDependientesExitoso
    .filter((p) => p.perfilId && p.rolEnDependiente === 'CuidadorPrincipal')
    .map((p) => ({
      id: p.perfilId as string,
      nombreCompleto: p.nombreCompleto ?? '',
    }));

  // === Perfil actual (para gating de UI por rol) ===
  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  const perfilExitoso =
    perfilData?.status === 200 && perfilData.data
      ? (perfilData.data as { id?: string; rol?: string })
      : null;
  const usuarioActualId = perfilExitoso?.id;
  const esPrincipalGlobal = perfilExitoso?.rol === 'CuidadorPrincipal';

  // === Estado del modal ===
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [modo, setModo] = useState<'crear' | 'editar'>('crear');
  const [relevoEditar, setRelevoEditar] = useState<RelevoItemResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // === Estado del diálogo de eliminación ===
  const [confirmarEliminarAbierto, setConfirmarEliminarAbierto] = useState(false);
  const [relevoAEliminar, setRelevoAEliminar] = useState<RelevoItemResponse | null>(null);
  const [eliminarApiError, setEliminarApiError] = useState<string | null>(null);

  const { trigger: crearRelevo, isMutating: creando } = useCrearRelevo();
  const { trigger: editarRelevo, isMutating: editando } = useEditarRelevo();
  const { trigger: eliminarRelevo, isMutating: eliminando } = useEliminarRelevo();

  const handleAbrirCrear = useCallback(() => {
    setModo('crear');
    setRelevoEditar(null);
    setApiError(null);
    setDialogoAbierto(true);
  }, []);

  const handleAbrirEditar = useCallback((relevo: RelevoItemResponse) => {
    setModo('editar');
    setRelevoEditar(relevo);
    setApiError(null);
    setDialogoAbierto(true);
  }, []);

  const handleCerrar = useCallback(() => {
    setDialogoAbierto(false);
    setApiError(null);
    // No limpiamos relevoEditar aquí para permitir que el modal lea
    // sus datos durante la animación de cierre; el próximo abrir lo
    // sobrescribirá.
  }, []);

  const handleAbrirConfirmarEliminar = useCallback(
    (relevo: RelevoItemResponse) => {
      setRelevoAEliminar(relevo);
      setEliminarApiError(null);
      setConfirmarEliminarAbierto(true);
    },
    [],
  );

  const handleCerrarConfirmarEliminar = useCallback(() => {
    if (eliminando) return; // no cerrar mientras está en curso
    setConfirmarEliminarAbierto(false);
    setEliminarApiError(null);
    // relevoAEliminar se mantiene para animación; próximo abrir lo sobrescribe.
  }, [eliminando]);

  const handleConfirmarEliminar = useCallback(async () => {
    if (!relevoAEliminar?.id) return;
    setEliminarApiError(null);
    try {
      const respuesta = (await eliminarRelevo({ id: relevoAEliminar.id })) as any;
      if (respuesta?.status && respuesta.status >= 400) {
        const detail = respuesta?.data?.detail;
        let mensaje = 'Error al eliminar el relevo';
        if (detail) mensaje = String(detail);
        setEliminarApiError(mensaje);
        return;
      }
      setConfirmarEliminarAbierto(false);
      setRelevoAEliminar(null);
      mutate();
    } catch {
      setEliminarApiError('Error de conexión');
    }
  }, [relevoAEliminar, eliminarRelevo, mutate]);

  /**
   * Adapta el RelevoItemResponse (lo que viene del GET Listar) al shape
   * RelevoEditarItem que el modal sabe renderizar. Mantener la
   * conversión aquí evita que el modal tenga que conocer el DTO Orval.
   */
  const relevoEditarAdaptado: RelevoEditarItem | null = useMemo(() => {
    if (!relevoEditar) return null;
    return {
      id: relevoEditar.id ?? '',
      nombre: relevoEditar.nombre ?? '',
      telefono: relevoEditar.telefono ?? '',
      estado: relevoEditar.estado,
      notas: relevoEditar.id ? null : null, // GET Listar no expone notas; se omiten.
    };
  }, [relevoEditar]);

  const handleCrear = async (
    body: RACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoRequest,
  ) => {
    setApiError(null);
    try {
      const respuesta = (await crearRelevo(body)) as any;
      if (respuesta?.status && respuesta.status >= 400) {
        const detail = respuesta?.data?.detail;
        const errs = respuesta?.data?.errors;
        let mensaje = 'Error al crear el relevo';
        if (errs) {
          const primero = Object.values(errs as Record<string, string[]>).flat()[0];
          if (primero) mensaje = String(primero);
        } else if (detail) {
          mensaje = String(detail);
        }
        setApiError(mensaje);
        return;
      }
      setDialogoAbierto(false);
      mutate();
    } catch {
      setApiError('Error de conexión');
    }
  };

  const handleEditar = async (
    id: string,
    body: { nombre?: string; telefono?: string; estado?: 'Disponible' | 'NoDisponible'; notas?: string | null; listado?: boolean },
  ) => {
    setApiError(null);
    try {
      const respuesta = (await editarRelevo({ id, ...body })) as any;
      if (respuesta?.status && respuesta.status >= 400) {
        const detail = respuesta?.data?.detail;
        const errs = respuesta?.data?.errors;
        let mensaje = 'Error al editar el relevo';
        if (errs) {
          const primero = Object.values(errs as Record<string, string[]>).flat()[0];
          if (primero) mensaje = String(primero);
        } else if (detail) {
          mensaje = String(detail);
        }
        setApiError(mensaje);
        return;
      }
      setDialogoAbierto(false);
      mutate();
    } catch {
      setApiError('Error de conexión');
    }
  };

  const puedeCrearRelevo = useMemo(
    () => esPrincipalGlobal && perfilesDependientes.length > 0 && usuariosDeApoyo.length > 0,
    [esPrincipalGlobal, perfilesDependientes.length, usuariosDeApoyo.length],
  );

  const header = {
    relevos,
    isLoading,
    onAgregar: puedeCrearRelevo ? handleAbrirCrear : undefined,
    tooltipBloqueado: !puedeCrearRelevo
      ? !esPrincipalGlobal
        ? 'Solo el cuidador principal puede crear relevos'
        : perfilesDependientes.length === 0
          ? 'Necesitas ser cuidador principal de al menos un dependiente para crear relevos'
          : 'No hay usuarios con rol Apoyo activos para asignar'
      : undefined,
    puedeEditar: esPrincipalGlobal,
    onEditar: esPrincipalGlobal ? handleAbrirEditar : undefined,
    puedeEliminar: esPrincipalGlobal,
    onEliminar: esPrincipalGlobal ? handleAbrirConfirmarEliminar : undefined,
    perfilesDependientes,
    filtroDependienteId,
    onCambiarFiltroDependiente: setFiltroDependienteId,
  };

  return (
    <>
      {isMobile ? (
        <DirectorioRelevosMobile header={header} />
      ) : (
        <DirectorioRelevosDesktop header={header} />
      )}

      <DialogoRelevo
        key={dialogoAbierto ? (modo === 'editar' ? (relevoEditarAdaptado?.id ?? 'editar') : 'crear') : 'cerrado'}
        abierto={dialogoAbierto}
        modo={modo}
        onCerrar={handleCerrar}
        onSubmitCrear={handleCrear}
        onSubmitEditar={handleEditar}
        isMutating={creando || editando}
        apiError={apiError}
        perfilesDependientes={perfilesDependientes}
        usuariosDeApoyo={usuariosDeApoyo}
        perfilDependienteInicialId={
          usuarioActualId ? perfilesDependientes[0]?.id : undefined
        }
        relevoEditar={relevoEditarAdaptado}
      />

      <DialogoConfirmarEliminar
        abierto={confirmarEliminarAbierto}
        nombreRelevo={relevoAEliminar?.nombre ?? 'este relevo'}
        onConfirmar={handleConfirmarEliminar}
        onCancelar={handleCerrarConfirmarEliminar}
        isMutating={eliminando}
        apiError={eliminarApiError}
      />
    </>
  );
};
