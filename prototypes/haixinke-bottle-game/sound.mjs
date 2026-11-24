export const sound = (() => {
  const quiet = 0.0001;
  const sounds = {
    contact: [
      { pitch: 365, end: 182, length: 0.061, volume: 0.032, shape: 'triangle' },
      { pitch: 730, end: 390, length: 0.038, volume: 0.009 }
    ],
    success: [
      { pitch: 523, length: 0.14, volume: 0.035 },
      { pitch: 659, length: 0.17, volume: 0.03, offset: 0.069 }
    ],
    topple: [
      { pitch: 219, end: 106, length: 0.105, volume: 0.034, shape: 'triangle' }
    ],
    edge: [
      { pitch: 412, end: 215, length: 0.053, volume: 0.025, shape: 'triangle' },
      { pitch: 237, end: 113, length: 0.078, volume: 0.027, offset: 0.082, shape: 'triangle' }
    ],
    miss: [
      { pitch: 165, end: 88, length: 0.093, volume: 0.025, shape: 'triangle' }
    ]
  };
  let context;
  let output;

  function unlock() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    try {
      context ??= new Audio();
      if (!output) {
        output = context.createGain();
        output.connect(context.destination);
      }
      output.gain.setValueAtTime(1, context.currentTime);
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // A browser can decline audio. The visual feedback is sufficient on its own.
    }
  }

  function mute() {
    if (output) output.gain.setValueAtTime(0, context.currentTime);
  }

  function play(kind) {
    const tones = sounds[kind];
    if (!output || context.state !== 'running' || !Array.isArray(tones)) return;
    const now = context.currentTime;
    for (const { pitch, end = pitch, length, volume, offset = 0, shape = 'sine' } of tones) {
      const start = now + offset;
      const stop = start + length;
      const voice = context.createOscillator();
      const envelope = context.createGain();
      voice.type = shape;
      voice.frequency.setValueAtTime(pitch, start);
      voice.frequency.exponentialRampToValueAtTime(end, stop);
      envelope.gain.setValueAtTime(quiet, start);
      envelope.gain.linearRampToValueAtTime(volume, start + 0.006);
      envelope.gain.exponentialRampToValueAtTime(quiet, stop);
      voice.connect(envelope);
      envelope.connect(output);
      voice.start(start);
      voice.stop(stop);
    }
  }

  return { unlock, mute, play };
})();
