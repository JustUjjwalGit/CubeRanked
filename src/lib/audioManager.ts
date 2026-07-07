/**
 * AudioManager — procedurally generated sounds via Web Audio API.
 * No audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function gain(ac: AudioContext, value: number, at = ac.currentTime): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(value, at);
  return g;
}

type OscType = OscillatorType;

function playTone(
  freq: number,
  duration: number,
  type: OscType = "sine",
  volume = 0.18,
  delay = 0
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = gain(ac, 0);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);

    const startAt = ac.currentTime + delay;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(volume, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  } catch {
    // Silently fail if audio context is not available
  }
}

function playNoise(duration: number, volume = 0.08, delay = 0) {
  try {
    const ac = getCtx();
    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;

    const g = gain(ac, 0);
    const startAt = ac.currentTime + delay;
    g.gain.setValueAtTime(volume, startAt);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(g);
    g.connect(ac.destination);
    source.start(startAt);
  } catch {
    // Silently fail
  }
}

export const audioManager = {
  /** Played each time the countdown number changes (3, 2, 1) */
  playCountdownBeep(isLastBeep = false) {
    const freq = isLastBeep ? 880 : 440;
    playTone(freq, 0.22, "sine", isLastBeep ? 0.22 : 0.16);
    // subtle click layer
    playNoise(0.06, 0.04);
  },

  /** Played when the countdown reaches GO */
  playGo() {
    // Rising triumphant chord
    playTone(523.25, 0.4, "sine", 0.20, 0);    // C5
    playTone(659.25, 0.4, "sine", 0.16, 0.04); // E5
    playTone(783.99, 0.5, "sine", 0.16, 0.08); // G5
    playNoise(0.08, 0.06);
  },

  /** Played when inspection starts */
  playInspectionStart() {
    playTone(660, 0.18, "sine", 0.14);
    playTone(880, 0.18, "sine", 0.10, 0.12);
  },

  /** Played when inspection is almost over (e.g., ≤3 seconds) */
  playInspectionWarning() {
    playTone(440, 0.12, "square", 0.06);
  },

  /** Played on button click */
  playClick() {
    playTone(800, 0.06, "sine", 0.09);
    playNoise(0.04, 0.03);
  },

  /** Played on solve completion */
  playSolveComplete() {
    playTone(440, 0.12, "sine", 0.14, 0);
    playTone(554, 0.14, "sine", 0.14, 0.08);
    playTone(659, 0.22, "sine", 0.18, 0.16);
  },

  /** Played when switching themes */
  playThemeSwitch() {
    playTone(660, 0.12, "sine", 0.09);
    playTone(880, 0.14, "sine", 0.09, 0.1);
  },
};
