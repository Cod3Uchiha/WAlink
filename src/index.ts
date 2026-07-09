import makeWASocket from './Socket/index'

export * from '../WAProto/index.js'
export * from './Utils/index'
export * from './Types/index'
export * from './Defaults/index'
export * from './WABinary/index'
export * from './WAM/index'
export * from './WAUSync/index'
export * from './Walink/index'

export type WASocket = ReturnType<typeof makeWASocket>
export type WAlinkSocket = ReturnType<typeof makeWASocket>
export const makeWAlinkSocket = makeWASocket
export { makeWASocket }
export default makeWASocket
