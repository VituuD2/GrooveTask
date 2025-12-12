// Simple synth to avoid external dependencies
export const playSound = (type: 'check' | 'complete' | 'click' | 'notification', frequencyOverride?: number) => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  if (type === 'notification') {
    // "GrooveTask Signature": A soft, modern synth chime (Major 3rd ascending)
    // Oscillator 1: The body
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Oscillator 2: The sparkle (Harmonic)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Note 1: C5 (523.25 Hz)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.1);
    // Slide to E5 (659.25 Hz) for a happy "ding"
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

    // Envelope for main tone
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.05); // Soft attack
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5); // Long smooth tail

    // Note 2: Overtone for texture
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25 * 2, now); // Octave up
    
    // Envelope for overtone (shorter)
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.05, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.start(now);
    osc1.stop(now + 1.5);
    osc2.start(now);
    osc2.stop(now + 1.5);

    return;
  }

  // Standard Logic for other sounds
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'check') {
    // Satisfying pluck
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'complete') {
    // Success chord arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
    notes.forEach((freq, i) => {
      const oscC = ctx.createOscillator();
      const gainC = ctx.createGain();
      oscC.connect(gainC);
      gainC.connect(ctx.destination);
      
      oscC.type = 'triangle';
      oscC.frequency.value = freq;
      
      const time = now + (i * 0.1);
      gainC.gain.setValueAtTime(0, time);
      gainC.gain.linearRampToValueAtTime(0.2, time + 0.05);
      gainC.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
      
      oscC.start(time);
      oscC.stop(time + 1.5);
    });
  } else if (type === 'click') {
    // Subtle mechanical click
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  }
};