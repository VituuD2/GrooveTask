// Simple synth to avoid external dependencies
export const playSound = (type: 'check' | 'complete' | 'click' | 'notification', frequencyOverride?: number) => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  if (type === 'notification') {
    // UPDATED: "GrooveTask Smooth Chime" - Less sharp, warmer tone.
    // Lowered pitch range (C4 -> E4 instead of C5 -> E5)
    // Slower attack to remove "click" or sharpness.
    
    // Oscillator 1: The warm body (Sine)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Oscillator 2: Subtle harmonic (Sine, not triangle to avoid buzz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Note 1: C4 (Middle C - 261.63 Hz)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(261.63, now);
    osc1.frequency.linearRampToValueAtTime(329.63, now + 0.15); // Slide to E4 slowly

    // Envelope for main tone - Slower attack (0.1s)
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.1); 
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2); 

    // Note 2: Harmonic (Octave + 5th) for "shine" but soft
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(392.00, now); // G4
    
    // Envelope for harmonic - very subtle
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.05, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.start(now);
    osc1.stop(now + 1.2);
    osc2.start(now);
    osc2.stop(now + 1.2);

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