import type { Control, FieldErrors, FieldArrayPath, FieldValues, UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';
import { Boton } from '../../components/Boton';
import { Plus, Trash2 } from 'lucide-react';
import type { ContactoEmergenciaForm } from './schema';

interface ContactosEmergenciaFormProps<
  TForm extends FieldValues & { contactosEmergencia?: ContactoEmergenciaForm[] | undefined }
> {
  control: Control<TForm>;
  errors: FieldErrors<TForm>;
  contactos: { id?: string }[];
  append: UseFieldArrayAppend<TForm, FieldArrayPath<TForm>>;
  remove: UseFieldArrayRemove;
  variant?: 'desktop' | 'mobile';
}

const contactoVacio: ContactoEmergenciaForm = {
  nombre: '',
  relacion: '',
  telefonoWhatsApp: '',
};

export function ContactosEmergenciaForm<
  TForm extends FieldValues & { contactosEmergencia?: ContactoEmergenciaForm[] | undefined }
>({
  control,
  errors,
  contactos,
  append,
  remove,
  variant = 'desktop',
}: ContactosEmergenciaFormProps<TForm>) {
  const erroresContactos = errors.contactosEmergencia as FieldErrors<ContactoEmergenciaForm>[] | undefined;
  const puedeAgregar = contactos.length < 3;

  if (variant === 'mobile') {
    return (
      <div className="space-y-4">
        {contactos.map((_, idx) => {
          const campo = `contactosEmergencia.${idx}` as const;
          const errCampo = erroresContactos?.[idx] as FieldErrors<ContactoEmergenciaForm> | undefined;
          return (
            <div key={campo.toString()} className="p-4 bg-white border border-blue-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-900">Contacto {idx + 1}</h4>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  aria-label={`Eliminar contacto ${idx + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    {...(control.register as any)(`${campo}.nombre`)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="María Pérez"
                  />
                  {errCampo?.nombre?.message && (
                    <p className="text-red-500 text-xs mt-1">{errCampo.nombre.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
                  <input
                    type="text"
                    {...(control.register as any)(`${campo}.relacion`)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Hija, Esposa, Hermano..."
                  />
                  {errCampo?.relacion?.message && (
                    <p className="text-red-500 text-xs mt-1">{errCampo.relacion.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono WhatsApp</label>
                  <input
                    type="tel"
                    {...(control.register as any)(`${campo}.telefonoWhatsApp`)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="+5939XXXXXXXX"
                  />
                  {errCampo?.telefonoWhatsApp?.message && (
                    <p className="text-red-500 text-xs mt-1">{errCampo.telefonoWhatsApp.message}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {puedeAgregar && (
          <Boton
            type="button"
            variante="secundario"
            onClick={() => append(contactoVacio as any)}
            className="w-full py-2.5 rounded-lg"
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar Contacto de Emergencia
          </Boton>
        )}
        {errors.contactosEmergencia?.root != null && 'message' in errors.contactosEmergencia.root && (
          <p className="text-red-500 text-sm">{(errors.contactosEmergencia.root as { message?: string }).message}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto border border-blue-200 rounded-xl">
        <table className="min-w-full divide-y divide-blue-200">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Relación</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Teléfono WhatsApp</th>
              <th className="px-4 py-3 w-16 text-right text-xs font-semibold text-blue-900 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-blue-100">
            {contactos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500 italic text-sm">
                  Sin contactos de emergencia registrados. Agrega hasta 3 contactos principales.
                </td>
              </tr>
            )}
            {contactos.map((_, idx) => {
              const campo = `contactosEmergencia.${idx}` as const;
              const errCampo = erroresContactos?.[idx] as FieldErrors<ContactoEmergenciaForm> | undefined;
              return (
                <tr key={campo.toString()}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      {...(control.register as any)(`${campo}.nombre`)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                    {errCampo?.nombre?.message && (
                      <p className="text-red-500 text-xs mt-1">{errCampo.nombre.message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      {...(control.register as any)(`${campo}.relacion`)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                    {errCampo?.relacion?.message && (
                      <p className="text-red-500 text-xs mt-1">{errCampo.relacion.message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="tel"
                      {...(control.register as any)(`${campo}.telefonoWhatsApp`)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                    {errCampo?.telefonoWhatsApp?.message && (
                      <p className="text-red-500 text-xs mt-1">{errCampo.telefonoWhatsApp.message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="cursor-pointer disabled:cursor-not-allowed p-2 rounded-full text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      aria-label={`Eliminar contacto ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-500">{contactos.length} / 3 contactos registrados</p>
        {puedeAgregar ? (
          <Boton
            type="button"
            variante="secundario"
            onClick={() => append(contactoVacio as any)}
            className="py-2 px-5 rounded-lg"
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar Contacto
          </Boton>
        ) : (
          <span className="text-xs font-medium text-sky-600">Máximo de 3 contactos alcanzado</span>
        )}
      </div>
    </div>
  );
}
