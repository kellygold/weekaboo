import { useEffect, useRef, useState } from 'react';

// Generated audio is shipped as an ordinary static asset. No voice service or
// API credential is needed on the tablet, phone or browser at playback time.
export function useMascotSound(sources: readonly string[]) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('weekaboo-mascot-sound') !== 'off'; } catch { return true; }
  });
  const player = useRef<HTMLAudioElement | null>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => () => { player.current?.pause(); }, []);
  function toggle(value: boolean) {
    setEnabled(value);
    if (!value) player.current?.pause();
    try { localStorage.setItem('weekaboo-mascot-sound', value ? 'on' : 'off'); } catch { /* Sound still works without storage. */ }
  }
  function play() {
    if (!enabled || !sources.length) return;
    const choices = sources.filter(source => source !== previous.current);
    const available = choices.length ? choices : sources;
    const source = available[Math.floor(Math.random() * available.length)];
    previous.current = source;
    const audio = player.current ||= new Audio();
    audio.volume = .55;
    audio.pause();
    audio.src = source;
    audio.currentTime = 0;
    // Called only from a user action. A blocked/unavailable sound never stops
    // the animation, and repeat clicks restart one player rather than stacking.
    void audio.play().catch(() => {});
  }
  return { enabled, toggle, play };
}
