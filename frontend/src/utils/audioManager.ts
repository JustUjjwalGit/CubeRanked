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
  delay = 0,
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = gain(ac, 0);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);

    const startAt = ac.currentTime + delay;
    const vol = Math.max(0, volume * (audioManager._masterVol ?? 1) * (audioManager._sfxVol ?? 1));
    if (vol <= 0) { osc.disconnect(); g.disconnect(); return; }

    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  } catch {
    // Silently fail
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
    const vol = Math.max(0, volume * (audioManager._masterVol ?? 1) * (audioManager._sfxVol ?? 1));
    if (vol <= 0) { source.disconnect(); g.disconnect(); return; }

    g.gain.setValueAtTime(vol, startAt);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(g);
    g.connect(ac.destination);
    source.start(startAt);
  } catch {
    // Silently fail
  }
}

function playUiTone(freq: number, duration: number, volume = 0.09) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = gain(ac, 0);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);

    const vol = Math.max(0, volume * (audioManager._masterVol ?? 1) * (audioManager._uiVol ?? 1));
    if (vol <= 0) { osc.disconnect(); g.disconnect(); return; }

    const startAt = ac.currentTime;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol, startAt + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  } catch {
    // Silently fail
  }
}

function playNotifTone(freq: number, duration: number, volume = 0.12) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = gain(ac, 0);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);

    const vol = Math.max(0, volume * (audioManager._masterVol ?? 1) * (audioManager._notifVol ?? 1));
    if (vol <= 0) { osc.disconnect(); g.disconnect(); return; }

    const startAt = ac.currentTime;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.03);
  } catch {
    // Silently fail
  }
}

const BGM_PATH = "/music/Neon%20Cube%20Run.mp3";
const FADE_DURATION = 3;
const MIN_INTERVAL = 10;
const MAX_INTERVAL = 60;

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export const audioManager = {
  _masterVol: 0.8,
  _sfxVol: 1.0,
  _uiVol: 1.0,
  _notifVol: 1.0,
  _musicVol: 0.5,

  _bgmGain: null as GainNode | null,
  _bgmSource: null as MediaElementAudioSourceNode | null,
  _bgmElement: null as HTMLAudioElement | null,
  _bgmPlaying: false,
  _bgmStopped: false,
  _bgmScheduleId: null as ReturnType<typeof setTimeout> | null,
  _bgmFadeId: null as ReturnType<typeof setTimeout> | null,
  _bgmInitialized: false,

  setVolumes(master: number, sfx: number, ui: number, notif: number) {
    this._masterVol = Math.max(0, Math.min(1, master));
    this._sfxVol = Math.max(0, Math.min(1, sfx));
    this._uiVol = Math.max(0, Math.min(1, ui));
    this._notifVol = Math.max(0, Math.min(1, notif));

    if (master === 0) {
      this._stopBgmImmediately();
    } else if (this._bgmStopped) {
      this._scheduleBgm(2);
    }
  },

  setMasterVolume(v: number) {
    const prev = this._masterVol;
    this._masterVol = Math.max(0, Math.min(1, v));
    this._updateBgmGain();
    if (prev > 0 && this._masterVol === 0) {
      this._stopBgmImmediately();
    } else if (prev === 0 && this._masterVol > 0 && !this._bgmPlaying) {
      this._scheduleBgm(2);
    }
  },

  setSfxVolume(v: number) { this._sfxVol = Math.max(0, Math.min(1, v)); },
  setUiVolume(v: number) { this._uiVol = Math.max(0, Math.min(1, v)); },
  setNotifVolume(v: number) { this._notifVol = Math.max(0, Math.min(1, v)); },

  setMusicVolume(v: number) {
    this._musicVol = Math.max(0, Math.min(1, v));
    this._updateBgmGain();
  },

  _computeBgmTargetGain(): number {
    return this._masterVol * this._musicVol * 0.12;
  },

  _updateBgmGain() {
    if (!this._bgmGain) return;
    const target = this._computeBgmTargetGain();
    try {
      const ac = getCtx();
      this._bgmGain.gain.setValueAtTime(target, ac.currentTime);
    } catch { /* ignore */ }
  },

  _stopBgmImmediately() {
    this._bgmStopped = true;
    if (this._bgmScheduleId !== null) {
      clearTimeout(this._bgmScheduleId);
      this._bgmScheduleId = null;
    }
    if (this._bgmFadeId !== null) {
      clearTimeout(this._bgmFadeId);
      this._bgmFadeId = null;
    }
    if (this._bgmPlaying && this._bgmGain && this._bgmElement) {
      try {
        const ac = getCtx();
        this._bgmGain.gain.cancelScheduledValues(ac.currentTime);
        this._bgmGain.gain.setValueAtTime(0, ac.currentTime);
      } catch { /* ignore */ }
    }
    if (this._bgmElement) {
      try { this._bgmElement.pause(); } catch { /* ignore */ }
      this._bgmElement.currentTime = 0;
    }
    this._bgmPlaying = false;
  },

  _scheduleBgm(delay?: number) {
    if (this._bgmStopped) return;
    if (this._bgmScheduleId !== null) {
      clearTimeout(this._bgmScheduleId);
    }
    const wait = delay ?? randRange(MIN_INTERVAL, MAX_INTERVAL);
    this._bgmScheduleId = setTimeout(() => {
      this._bgmScheduleId = null;
      this._playBgm();
    }, wait * 1000);
  },

  _playBgm() {
    if (this._bgmStopped) return;
    if (this._masterVol === 0 || this._musicVol === 0) {
      this._scheduleBgm(5);
      return;
    }

    try {
      const ac = getCtx();
      const element = new Audio(BGM_PATH);
      element.loop = false;
      element.crossOrigin = "anonymous";

      const source = ac.createMediaElementSource(element);
      const bgmGain = ac.createGain();
      const targetVol = this._computeBgmTargetGain();
      bgmGain.gain.setValueAtTime(0, ac.currentTime);

      source.connect(bgmGain);
      bgmGain.connect(ac.destination);

      this._bgmElement = element;
      this._bgmSource = source;
      this._bgmGain = bgmGain;
      this._bgmPlaying = true;

      // Fade in over 3 seconds
      bgmGain.gain.linearRampToValueAtTime(targetVol, ac.currentTime + FADE_DURATION);

      element.play().catch(() => {
        this._cleanupBgm();
        this._scheduleBgm(10);
      });

      element.onended = () => {
        // Fade out over 3 seconds
        if (this._bgmGain) {
          try {
            const now = ac.currentTime;
            this._bgmGain.gain.cancelScheduledValues(now);
            this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
            this._bgmGain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);
          } catch { /* ignore */ }
        }

        this._bgmFadeId = setTimeout(() => {
          this._bgmFadeId = null;
          this._cleanupBgm();
          this._scheduleBgm();
        }, FADE_DURATION * 1000 + 200);
      };
    } catch {
      this._cleanupBgm();
      this._scheduleBgm(10);
    }
  },

  _cleanupBgm() {
    if (this._bgmElement) {
      try { this._bgmElement.pause(); } catch { /* ignore */ }
      this._bgmElement.onended = null;
      this._bgmElement = null;
    }
    this._bgmSource = null;
    this._bgmGain = null;
    this._bgmPlaying = false;
  },

  startBgm() {
    this._bgmStopped = false;
    this._bgmInitialized = true;
    this._scheduleBgm(randRange(MIN_INTERVAL, MAX_INTERVAL));
  },

  stopBgm() {
    this._bgmStopped = true;
    this._stopBgmImmediately();
  },

  isBgmPlaying(): boolean {
    return this._bgmPlaying;
  },

  playCountdownBeep(isLastBeep = false) {
    const freq = isLastBeep ? 880 : 440;
    playTone(freq, 0.22, "sine", isLastBeep ? 0.22 : 0.16);
    playNoise(0.06, 0.04);
  },

  playGo() {
    playTone(523.25, 0.4, "sine", 0.20, 0);
    playTone(659.25, 0.4, "sine", 0.16, 0.04);
    playTone(783.99, 0.5, "sine", 0.16, 0.08);
    playNoise(0.08, 0.06);
  },

  playInspectionStart() {
    playTone(660, 0.18, "sine", 0.14);
    playTone(880, 0.18, "sine", 0.10, 0.12);
  },

  playInspectionWarning() {
    playTone(440, 0.12, "square", 0.06);
  },

  playClick() {
    playTone(800, 0.06, "sine", 0.09);
    playNoise(0.04, 0.03);
  },

  playSolveComplete() {
    playTone(440, 0.12, "sine", 0.14, 0);
    playTone(554, 0.14, "sine", 0.14, 0.08);
    playTone(659, 0.22, "sine", 0.18, 0.16);
  },

  playThemeSwitch() {
    playTone(660, 0.12, "sine", 0.09);
    playTone(880, 0.14, "sine", 0.09, 0.1);
  },

  playButtonHover() {
    playUiTone(600, 0.04, 0.04);
  },

  playButtonClick() {
    playUiTone(800, 0.06, 0.07);
    playNoise(0.03, 0.02);
  },

  playMatchFound() {
    playTone(440, 0.15, "sine", 0.16, 0);
    playTone(554, 0.15, "sine", 0.16, 0.1);
    playTone(659, 0.25, "sine", 0.18, 0.2);
    playNoise(0.05, 0.04);
  },

  playVictory() {
    playTone(523, 0.2, "sine", 0.18, 0);
    playTone(659, 0.2, "sine", 0.18, 0.1);
    playTone(784, 0.3, "sine", 0.22, 0.2);
    playTone(1047, 0.4, "sine", 0.24, 0.3);
  },

  playDefeat() {
    playTone(400, 0.3, "sine", 0.14, 0);
    playTone(340, 0.3, "sine", 0.14, 0.15);
    playTone(280, 0.4, "sine", 0.12, 0.3);
  },

  playRankUp() {
    playTone(440, 0.15, "sine", 0.16, 0);
    playTone(554, 0.15, "sine", 0.16, 0.08);
    playTone(659, 0.15, "sine", 0.18, 0.16);
    playTone(880, 0.3, "sine", 0.22, 0.24);
  },

  playAchievementUnlock() {
    playTone(660, 0.12, "sine", 0.14, 0);
    playTone(880, 0.12, "sine", 0.14, 0.08);
    playTone(1100, 0.3, "sine", 0.18, 0.16);
  },

  playNotification() {
    playNotifTone(880, 0.12, 0.1);
    playNotifTone(1100, 0.1, 0.08, 0.1);
  },

  playQueuePop() {
    playUiTone(1200, 0.06, 0.05);
  },
};
