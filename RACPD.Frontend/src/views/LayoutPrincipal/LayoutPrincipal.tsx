import { useEffect, useState } from 'react'
import { LayoutPrincipalDesktop } from './LayoutPrincipalDesktop'
import { LayoutPrincipalMobile } from './LayoutPrincipalMobile'
import { VerificadorPerfil } from './VerificadorPerfil'
import { useVerificarCuentaActiva } from '../../autenticacion/useVerificarCuentaActiva'
import { IndicadorConexion } from '../../components/common/IndicadorConexion'

export const LayoutPrincipal = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Verifica en eventos del navegador (F5, focus, visibilitychange y
  // timer en background) que la cuenta del usuario siga activa. Si el
  // admin la desactivó, este hook fuerza signOut + redirect con mensaje.
  useVerificarCuentaActiva()

  return (
    <>
      {/*
        VerificadorPerfil bloquea el render cuando SWR está cargando:
        - Si NO ha respondido, devuelve un CargadorPantallaCompleta
          que ocupa el 100% del viewport, por lo que las vistas
          hijas (Mobile / Desktop) NO se renderizan todavía.
        - Si la respuesta llegó y todo está OK, devuelve null y entonces
          sí se renderiza el Layout correspondiente.
        De esta forma eliminamos la condición de carrera en la que la
        UI protegida aparecía antes de confirmar /completar-perfil.
      */}
      <VerificadorPerfil />
      <IndicadorConexion />
      {isMobile ? <LayoutPrincipalMobile /> : <LayoutPrincipalDesktop />}
    </>
  )
}
