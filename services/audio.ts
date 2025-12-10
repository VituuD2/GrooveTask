// Simple synth to avoid external dependencies
export const playSound = (type: 'check' | 'complete' | 'click', frequencyOverride?: number) => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

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
