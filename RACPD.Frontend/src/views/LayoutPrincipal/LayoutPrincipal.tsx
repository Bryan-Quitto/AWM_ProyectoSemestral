import { useEffect, useState } from 'react'
import { LayoutPrincipalDesktop } from './LayoutPrincipalDesktop'
import { LayoutPrincipalMobile } from './LayoutPrincipalMobile'

export const LayoutPrincipal = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile ? <LayoutPrincipalMobile /> : <LayoutPrincipalDesktop />
}
