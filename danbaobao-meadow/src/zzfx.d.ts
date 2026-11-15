declare module 'zzfx' {
  export function zzfx(...parameters: number[]): void
  export const ZZFX: {
    volume: number
    audioContext: AudioContext
  }
}
