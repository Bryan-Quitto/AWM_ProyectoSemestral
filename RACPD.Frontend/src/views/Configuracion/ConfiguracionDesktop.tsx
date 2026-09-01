import { useState, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  configuracionPerfilSchema, 
  configuracionContrasenaSchema
} from '../../features/configuracion/schemas';
import type { 
  ConfiguracionPerfilFormData, 
  ConfiguracionContrasenaFormData 
} from '../../features/configuracion/schemas';
import { 
  CampoContrasena, 
  IndicadorFortalezaContrasena, 
  usePoliticaContrasena 
} from '../../components/Seguridad';
import { Boton } from '../../components/Boton';
import {
  useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint,
  useRACPDBackendFeaturesUsuariosMiPerfilActualizarPerfilEndpoint,
  useRACPDBackendFeaturesUsuariosMiPerfilModificarContrasenaEndpoint
} from '../../api/generated/api/api';

export function ConfiguracionDesktop() {
  const { data: perfilData, isLoading } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();
  const { trigger: actualizarPerfil, isMutating: isActualizandoPerfil } = useRACPDBackendFeaturesUsuariosMiPerfilActualizarPerfilEndpoint();
  const { trigger: modificarContrasena, isMutating: isModificandoContrasena } = useRACPDBackendFeaturesUsuariosMiPerfilModificarContrasenaEndpoint();

  const [perfilExito, setPerfilExito] = useState(false);
  const [contrasenaExito, setContrasenaExito] = useState(false);
  
  const formPerfil = useForm<ConfiguracionPerfilFormData>({
    resolver: zodResolver(configuracionPerfilSchema),
    defaultValues: {
      nombre: '',
      apellido: ''
    }
  });

  const formContrasena = useForm<ConfiguracionContrasenaFormData>({
    resolver: zodResolver(configuracionContrasenaSchema),
    defaultValues: {
      contrasenaActual: '',
      nuevaContrasena: '',
      confirmarContrasena: ''
    },
    mode: 'onChange'
  });

  const nuevaContrasenaValor = useWatch({
    control: formContrasena.control,
    name: 'nuevaContrasena'
  }) || '';
  
  const politica = usePoliticaContrasena(nuevaContrasenaValor);

  useEffect(() => {
    if (perfilData?.data) {
      formPerfil.reset({
        nombre: perfilData.data.nombre,
        apellido: perfilData.data.apellido
      });
    }
  }, [perfilData, formPerfil]);

  const onPerfilSubmit = async (data: ConfiguracionPerfilFormData) => {
    setPerfilExito(false);
    try {
      const respuesta = await actualizarPerfil(data) as any;
      if (respuesta.status >= 400) {
        if (respuesta.data?.errors) {
          Object.entries(respuesta.data.errors).forEach(([key, messages]) => {
            formPerfil.setError(
              key.charAt(0).toLowerCase() + key.slice(1) as any, 
              { type: 'manual', message: (messages as string[])[0] }
            );
          });
        }
        return;
      }
      setPerfilExito(true);
      setTimeout(() => setPerfilExito(false), 3000);
    } catch {
      // Errores de red
    }
  };

  const onContrasenaSubmit = async (data: ConfiguracionContrasenaFormData) => {
    setContrasenaExito(false);
    try {
      const respuesta = await modificarContrasena({
        contrasenaActual: data.contrasenaActual,
        nuevaContrasena: data.nuevaContrasena
      }) as any;
      
      if (respuesta.status >= 400) {
        if (respuesta.data?.errors) {
          Object.entries(respuesta.data.errors).forEach(([key, messages]) => {
            formContrasena.setError(
              key.charAt(0).toLowerCase() + key.slice(1) as any, 
              { type: 'manual', message: (messages as string[])[0] }
            );
          });
        }
        return;
      }

      setContrasenaExito(true);
      formContrasena.reset();
      setTimeout(() => setContrasenaExito(false), 5000);
    } catch {
      // Errores de red
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Configuración de Usuario</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Panel Perfil */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Datos Personales</h2>
          <form onSubmit={formPerfil.handleSubmit(onPerfilSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input 
                type="text" 
                {...formPerfil.register('nombre')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              {formPerfil.formState.errors.nombre && (
                <p className="text-red-500 text-sm mt-1">{formPerfil.formState.errors.nombre.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input 
                type="text" 
                {...formPerfil.register('apellido')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              {formPerfil.formState.errors.apellido && (
                <p className="text-red-500 text-sm mt-1">{formPerfil.formState.errors.apellido.message}</p>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Boton 
                type="submit" 
                disabled={!formPerfil.formState.isDirty}
                cargando={isActualizandoPerfil}
                className="py-2 px-6 rounded-lg"
              >
                {isActualizandoPerfil ? 'Guardando...' : 'Guardar Cambios'}
              </Boton>
              {perfilExito && <span className="text-green-600 text-sm font-medium">¡Perfil actualizado!</span>}
            </div>
          </form>
        </div>

        {/* Panel Contraseña */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Seguridad</h2>
          <form onSubmit={formContrasena.handleSubmit(onContrasenaSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
              <Controller
                control={formContrasena.control}
                name="contrasenaActual"
                render={({ field }) => (
                  <CampoContrasena
                    value={field.value}
                    onChange={field.onChange}
                    error={formContrasena.formState.errors.contrasenaActual?.message}
                  />
                )}
              />
            </div>
            
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
              <Controller
                control={formContrasena.control}
                name="nuevaContrasena"
                render={({ field }) => (
                  <CampoContrasena
                    value={field.value}
                    onChange={field.onChange}
                    error={formContrasena.formState.errors.nuevaContrasena?.message}
                  />
                )}
              />
              <div className="mt-2">
                <IndicadorFortalezaContrasena contrasena={nuevaContrasenaValor} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
              <Controller
                control={formContrasena.control}
                name="confirmarContrasena"
                render={({ field }) => (
                  <CampoContrasena
                    value={field.value}
                    onChange={field.onChange}
                    error={formContrasena.formState.errors.confirmarContrasena?.message}
                  />
                )}
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Boton 
                type="submit" 
                disabled={politica.cumplidos !== 5 || !formContrasena.formState.isValid}
                cargando={isModificandoContrasena}
                className="py-2 px-6 rounded-lg"
              >
                {isModificandoContrasena ? 'Actualizando...' : 'Actualizar Contraseña'}
              </Boton>
            </div>
            {contrasenaExito && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                Tu contraseña ha sido modificada exitosamente. Por seguridad, te recomendamos cerrar las sesiones activas en otros dispositivos si consideras que estaban comprometidas.
              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
