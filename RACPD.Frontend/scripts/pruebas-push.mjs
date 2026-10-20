import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

const codigo = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
function preparar() {
  const eventos = new Map()
  const avisos = []
  const aperturas = []
  const trabajador = {
    addEventListener: (tipo, manejar) => eventos.set(tipo, manejar),
    location: { origin: 'https://racpd.example' },
    registration: { showNotification: async (titulo, opciones) => avisos.push({ titulo, opciones }) },
    clients: { matchAll: async () => [], openWindow: async url => aperturas.push(url) },
  }
  runInNewContext(codigo, { self: trabajador, URL })
  async function emitir(tipo, propiedades) {
    let pendiente
    eventos.get(tipo)({ ...propiedades, waitUntil: p => { pendiente = p } })
    await pendiente
  }
  return { emitir, avisos, aperturas, trabajador }
}
test('push malformado muestra aviso genérico sin exponer datos', async () => {
  const p = preparar()
  await p.emitir('push', { data: { json() { throw new Error('JSON inválido') } } })
  assert.equal(p.avisos[0].titulo, 'RACPD')
  assert.equal(p.avisos[0].opciones.data.ruta, '/agenda')
})
test('push valida ruta y usa un tag estable para duplicados', async () => {
  const p = preparar()
  const id = 'a054ff39-dbe6-485d-9c6d-0cc60e8f159b'
  const ruta = '/agenda?bloqueIdDestacado=' + id
  await p.emitir('push', { data: { json: () => ({ idMensaje: id, ruta, cuerpo: 'síntomas confidenciales' }) } })
  assert.equal(p.avisos[0].opciones.tag, id)
  assert.equal(p.avisos[0].opciones.data.ruta, ruta)
  assert.ok(!p.avisos[0].opciones.body.includes('síntomas'))
})
test('notificación no abre URL externa manipulada', async () => {
  const p = preparar()
  await p.emitir('notificationclick', { notification: { close() {}, data: { ruta: 'https://externo.example/robar' } } })
  assert.equal(p.aperturas[0], 'https://racpd.example/agenda')
})
test('clic reutiliza y enfoca ventana existente del mismo origen', async () => {
  const p = preparar()
  let enfocada = false
  let ruta
  p.trabajador.clients.matchAll = async () => [{ url: 'https://racpd.example/', navigate: async url => { ruta = url }, focus: async () => { enfocada = true } }]
  await p.emitir('notificationclick', { notification: { close() {}, data: { ruta: '/agenda' } } })
  assert.equal(ruta, 'https://racpd.example/agenda')
  assert.ok(enfocada)
  assert.equal(p.aperturas.length, 0)
})
