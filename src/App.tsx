import { useState, useEffect, useRef } from 'react';

// Interfaces
interface AudioNodeConfig {
  id: string;
  name: string;
  type: 'oscillator' | 'adsr' | 'filter' | 'delay' | 'distortion' | 'visualizer';
  x: number;
  y: number;
}

interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

const INITIAL_NODES: AudioNodeConfig[] = [
  { id: 'osc', name: 'OSCILLATOR [VCO]', type: 'oscillator', x: 20, y: 50 },
  { id: 'env', name: 'ENVELOPE [ADSR]', type: 'adsr', x: 270, y: 50 },
  { id: 'flt', name: 'RESONANT FILTER [VCF]', type: 'filter', x: 520, y: 50 },
  { id: 'dst', name: 'BITCRUSHER [FX]', type: 'distortion', x: 20, y: 310 },
  { id: 'dly', name: 'SPACE DELAY [FX]', type: 'delay', x: 270, y: 310 },
  { id: 'vis', name: 'MASTER OUTPUT [VCA]', type: 'visualizer', x: 520, y: 310 },
];

const PRESETS = [
  {
    name: 'NEO-TOKYO LEAD',
    connections: [
      { id: 'c1', fromId: 'osc', toId: 'env' },
      { id: 'c2', fromId: 'env', toId: 'flt' },
      { id: 'c3', fromId: 'flt', toId: 'dly' },
      { id: 'c4', fromId: 'dly', toId: 'vis' },
    ],
    settings: {
      waveType: 'sawtooth',
      frequency: 220,
      detune: 8,
      lfoSpeed: 4,
      lfoDepth: 15,
      attack: 0.1,
      decay: 0.3,
      sustain: 0.6,
      release: 0.4,
      filterType: 'lowpass',
      cutoff: 1200,
      q: 4,
      distortion: 15,
      delayTime: 0.3,
      delayFeedback: 0.4,
    }
  },
  {
    name: 'CYBER-BASS',
    connections: [
      { id: 'c1', fromId: 'osc', toId: 'env' },
      { id: 'c2', fromId: 'env', toId: 'dst' },
      { id: 'c3', fromId: 'dst', toId: 'flt' },
      { id: 'c4', fromId: 'flt', toId: 'vis' },
    ],
    settings: {
      waveType: 'sawtooth',
      frequency: 65.4, // C2
      detune: 15,
      lfoSpeed: 0.5,
      lfoDepth: 30,
      attack: 0.02,
      decay: 0.2,
      sustain: 0.8,
      release: 0.2,
      filterType: 'lowpass',
      cutoff: 400,
      q: 8,
      distortion: 45,
      delayTime: 0.1,
      delayFeedback: 0.1,
    }
  },
  {
    name: 'SPACE AMBIENT',
    connections: [
      { id: 'c1', fromId: 'osc', toId: 'flt' },
      { id: 'c2', fromId: 'flt', toId: 'dly' },
      { id: 'c3', fromId: 'dly', toId: 'vis' },
    ],
    settings: {
      waveType: 'triangle',
      frequency: 330, // E4
      detune: 5,
      lfoSpeed: 1.2,
      lfoDepth: 25,
      attack: 0.8,
      decay: 1.2,
      sustain: 0.9,
      release: 1.5,
      filterType: 'bandpass',
      cutoff: 900,
      q: 2,
      distortion: 0,
      delayTime: 0.5,
      delayFeedback: 0.7,
    }
  },
  {
    name: 'DIGITAL GLITCH',
    connections: [
      { id: 'c1', fromId: 'osc', toId: 'dst' },
      { id: 'c2', fromId: 'dst', toId: 'dly' },
      { id: 'c3', fromId: 'dly', toId: 'vis' },
    ],
    settings: {
      waveType: 'square',
      frequency: 440,
      detune: 20,
      lfoSpeed: 12,
      lfoDepth: 60,
      attack: 0.01,
      decay: 0.05,
      sustain: 0.1,
      release: 0.1,
      filterType: 'highpass',
      cutoff: 2000,
      q: 12,
      distortion: 90,
      delayTime: 0.15,
      delayFeedback: 0.6,
    }
  }
];

export default function App() {
  const [audioContextActive, setAudioContextActive] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [sequencerRunning, setSequencerRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Audio parameters state
  const [waveType, setWaveType] = useState<OscillatorType>('sawtooth');
  const [frequency, setFrequency] = useState(110);
  const [detune, setDetune] = useState(8);
  const [lfoSpeed, setLfoSpeed] = useState(4);
  const [lfoDepth, setLfoDepth] = useState(15);
  const [attack, setAttack] = useState(0.1);
  const [decay, setDecay] = useState(0.3);
  const [sustain, setSustain] = useState(0.6);
  const [release, setRelease] = useState(0.4);
  const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass');
  const [cutoff, setCutoff] = useState(1200);
  const [q, setQ] = useState(4);
  const [distortion, setDistortion] = useState(15);
  const [delayTime, setDelayTime] = useState(0.3);
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [visualizerMode, setVisualizerMode] = useState<'wave' | 'frequency' | 'radial'>('radial');

  // Interactive Node Connection State
  const [connections, setConnections] = useState<Connection[]>(PRESETS[0].connections);
  const [activeWireStart, setActiveWireStart] = useState<string | null>(null);

  // Sequencer notes state (8 steps, each can trigger a pitch multiplier)
  const [seqSteps, setSeqSteps] = useState<boolean[]>([true, false, true, false, true, true, false, true]);
  const [seqPitches, setSeqPitches] = useState<number[]>([1, 1.2, 1.5, 1, 1.8, 1.5, 2, 0.8]);

  // Audio API Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const distortionNodeRef = useRef<WaveShaperNode | null>(null);

  // Refs for tracking interactive synth voices
  const activeOscillators = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map());

  // Visualizer Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerAnimRef = useRef<number | null>(null);

  // Sequencer loop Ref
  const stepIntervalId = useRef<any>(null);

  // Initialize Web Audio API elements
  const initAudio = () => {
    if (audioCtxRef.current) return;
    
    // Create AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Master Gain
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.3, ctx.currentTime);
    mainGainRef.current = mainGain;

    // Filter Node
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);
    filterNodeRef.current = filter;

    // Delay Node
    const delay = ctx.createDelay(2.0);
    delay.delayTime.setValueAtTime(delayTime, ctx.currentTime);
    const delayGain = ctx.createGain();
    delayGain.gain.setValueAtTime(delayFeedback, ctx.currentTime);
    
    // Feedback loop
    delay.connect(delayGain);
    delayGain.connect(delay);

    delayNodeRef.current = delay;
    delayGainRef.current = delayGain;

    // Distortion Node
    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(distortion);
    dist.oversample = '4x';
    distortionNodeRef.current = dist;

    // Analyser Node
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Setup visualizer loop
    drawVisualizer();

    setAudioContextActive(true);
  };

  // Helper to construct distortion curve
  const makeDistortionCurve = (amount: number) => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  // Preset Selection handler
  const loadPreset = (preset: typeof PRESETS[0]) => {
    setConnections(preset.connections);
    setWaveType(preset.settings.waveType as OscillatorType);
    setFrequency(preset.settings.frequency);
    setDetune(preset.settings.detune);
    setLfoSpeed(preset.settings.lfoSpeed);
    setLfoDepth(preset.settings.lfoDepth);
    setAttack(preset.settings.attack);
    setDecay(preset.settings.decay);
    setSustain(preset.settings.sustain);
    setRelease(preset.settings.release);
    setFilterType(preset.settings.filterType as BiquadFilterType);
    setCutoff(preset.settings.cutoff);
    setQ(preset.settings.q);
    setDistortion(preset.settings.distortion);
    setDelayTime(preset.settings.delayTime);
    setDelayFeedback(preset.settings.delayFeedback);

    // Apply directly if audio context is active
    if (audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      if (filterNodeRef.current) {
        filterNodeRef.current.type = preset.settings.filterType as BiquadFilterType;
        filterNodeRef.current.frequency.setValueAtTime(preset.settings.cutoff, now);
        filterNodeRef.current.Q.setValueAtTime(preset.settings.q, now);
      }
      if (delayNodeRef.current) {
        delayNodeRef.current.delayTime.setValueAtTime(preset.settings.delayTime, now);
      }
      if (delayGainRef.current) {
        delayGainRef.current.gain.setValueAtTime(preset.settings.delayFeedback, now);
      }
      if (distortionNodeRef.current) {
        distortionNodeRef.current.curve = makeDistortionCurve(preset.settings.distortion);
      }
    }
  };

  // Real-time parameter updates
  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    if (filterNodeRef.current) {
      filterNodeRef.current.type = filterType;
      filterNodeRef.current.frequency.setValueAtTime(cutoff, now);
      filterNodeRef.current.Q.setValueAtTime(q, now);
    }
  }, [filterType, cutoff, q]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.setValueAtTime(delayTime, now);
    }
  }, [delayTime]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    if (delayGainRef.current) {
      delayGainRef.current.gain.setValueAtTime(delayFeedback, now);
    }
  }, [delayFeedback]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    if (distortionNodeRef.current) {
      distortionNodeRef.current.curve = makeDistortionCurve(distortion);
    }
  }, [distortion]);

  // Synthesizer voice trigger function (supports both keyboard and sequencer)
  const triggerVoice = (freq: number, duration: number = 0.5) => {
    if (!audioCtxRef.current) {
      initAudio();
      return;
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const voiceId = Math.random().toString(36).substring(7);

    // Create Oscillator
    const osc = ctx.createOscillator();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(detune, now);

    // LFO modulation (pitch vibrato)
    if (lfoDepth > 0) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(lfoSpeed, now);
      lfoGain.gain.setValueAtTime(lfoDepth, now);
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      lfo.start(now);
      lfo.stop(now + duration + release + 0.1);
    }

    // Voice Gain Node (for ADSR envelope)
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    
    // ADSR Envelope Phase
    voiceGain.gain.linearRampToValueAtTime(0.5, now + attack); // Attack
    voiceGain.gain.exponentialRampToValueAtTime(0.5 * sustain, now + attack + decay); // Decay -> Sustain
    voiceGain.gain.setValueAtTime(0.5 * sustain, now + duration);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release); // Release

    osc.connect(voiceGain);
    
    // Dynamic routing according to current connection wire graph
    let currentOutNode: AudioNode = voiceGain;

    // Find sequence of connected nodes starting from VCO (osc)
    const getNextConnectedId = (nodeId: string): string | null => {
      const conn = connections.find(c => c.fromId === nodeId);
      return conn ? conn.toId : null;
    };

    let nextNodeId = getNextConnectedId('osc');
    let delayConnected = false;
    let filterConnected = false;
    let distortionConnected = false;
    let maxConnections = 10; // Prevent infinite loops

    while (nextNodeId && maxConnections > 0) {
      maxConnections--;
      if (nextNodeId === 'env') {
        nextNodeId = getNextConnectedId('env');
      } else if (nextNodeId === 'flt' && filterNodeRef.current) {
        currentOutNode.connect(filterNodeRef.current);
        currentOutNode = filterNodeRef.current;
        filterConnected = true;
        nextNodeId = getNextConnectedId('flt');
      } else if (nextNodeId === 'dly' && delayNodeRef.current) {
        currentOutNode.connect(delayNodeRef.current);
        currentOutNode = delayNodeRef.current;
        delayConnected = true;
        nextNodeId = getNextConnectedId('dly');
      } else if (nextNodeId === 'dst' && distortionNodeRef.current) {
        currentOutNode.connect(distortionNodeRef.current);
        currentOutNode = distortionNodeRef.current;
        distortionConnected = true;
        nextNodeId = getNextConnectedId('dst');
      } else if (nextNodeId === 'vis' && analyserRef.current && mainGainRef.current) {
        currentOutNode.connect(analyserRef.current);
        analyserRef.current.connect(mainGainRef.current);
        mainGainRef.current.connect(ctx.destination);
        break; // Reached master visualizer & speaker out
      } else {
        break;
      }
    }

    // Direct fallback if VCO output path is disconnected or incomplete
    if (nextNodeId !== 'vis') {
      if (!filterConnected && filterNodeRef.current) {
        voiceGain.connect(filterNodeRef.current);
        currentOutNode = filterNodeRef.current;
      }
      if (!distortionConnected && distortionNodeRef.current) {
        currentOutNode.connect(distortionNodeRef.current);
        currentOutNode = distortionNodeRef.current;
      }
      if (!delayConnected && delayNodeRef.current) {
        currentOutNode.connect(delayNodeRef.current);
        if (analyserRef.current) {
          delayNodeRef.current.connect(analyserRef.current);
        }
      }
      
      if (analyserRef.current && mainGainRef.current) {
        currentOutNode.connect(analyserRef.current);
        analyserRef.current.connect(mainGainRef.current);
        mainGainRef.current.connect(ctx.destination);
      }
    }

    // Start voice
    osc.start(now);
    osc.stop(now + duration + release + 0.1);

    // Save active voice reference
    activeOscillators.current.set(voiceId, { osc, gain: voiceGain });
    setTimeout(() => {
      activeOscillators.current.delete(voiceId);
    }, (duration + release + 0.2) * 1000);
  };

  // Patch terminal clicks
  const handleTerminalClick = (terminalId: string) => {
    if (!activeWireStart) {
      setActiveWireStart(terminalId);
    } else {
      if (activeWireStart === terminalId) {
        setActiveWireStart(null);
        return;
      }

      // Determine source and target node
      const fromNode = activeWireStart.split('-')[0];
      const toNode = terminalId.split('-')[0];
      const fromType = activeWireStart.split('-')[1];
      const toType = terminalId.split('-')[1];

      // A wire must connect an Output to an Input, and be from different nodes
      if (fromType === 'out' && toType === 'in' && fromNode !== toNode) {
        // Remove existing connection from source node to maintain monophonic node flow routing
        const cleanConnections = connections.filter(c => c.fromId !== fromNode);
        const newConnection: Connection = {
          id: `c-${Date.now()}`,
          fromId: fromNode,
          toId: toNode
        };
        setConnections([...cleanConnections, newConnection]);
      }
      
      setActiveWireStart(null);
    }
  };

  const removeConnection = (connId: string) => {
    setConnections(connections.filter(c => c.id !== connId));
  };

  // Keyboard notes mapping
  const KEYBOARD_KEYS = [
    { label: 'C3', freq: 130.81, rgb: '255, 0, 127' },
    { label: 'D3', freq: 146.83, rgb: '0, 242, 254' },
    { label: 'E3', freq: 164.81, rgb: '57, 255, 20' },
    { label: 'F3', freq: 174.61, rgb: '255, 94, 0' },
    { label: 'G3', freq: 196.00, rgb: '255, 0, 127' },
    { label: 'A3', freq: 220.00, rgb: '0, 242, 254' },
    { label: 'B3', freq: 246.94, rgb: '57, 255, 20' },
    { label: 'C4', freq: 261.63, rgb: '255, 94, 0' },
    { label: 'D4', freq: 293.66, rgb: '255, 0, 127' },
    { label: 'E4', freq: 329.63, rgb: '0, 242, 254' },
    { label: 'F4', freq: 349.23, rgb: '57, 255, 20' },
    { label: 'G4', freq: 392.00, rgb: '255, 94, 0' },
    { label: 'A4', freq: 440.00, rgb: '255, 0, 127' },
  ];

  // Visualizer drawing function
  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) {
      visualizerAnimRef.current = requestAnimationFrame(drawVisualizer);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    ctx.clearRect(0, 0, width, height);

    if (visualizerMode === 'wave') {
      analyser.getByteTimeDomainData(dataArray);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f2fe';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else if (visualizerMode === 'frequency') {
      analyser.getByteFrequencyData(dataArray);
      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff007f';

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#ff007f');
        gradient.addColorStop(0.5, '#ff5e00');
        gradient.addColorStop(1, 'rgba(6, 6, 16, 0.9)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    } else if (visualizerMode === 'radial') {
      analyser.getByteFrequencyData(dataArray);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) * 0.45;

      ctx.shadowBlur = 15;
      ctx.shadowColor = '#39ff14';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const value = dataArray[i] / 3.5;
        const r = radius + value;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // Outer neon particle field ring
      ctx.beginPath();
      ctx.shadowColor = '#00f2fe';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < bufferLength; i += 4) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const value = dataArray[i] / 5.5;
        const r = radius * 1.3 - value;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    visualizerAnimRef.current = requestAnimationFrame(drawVisualizer);
  };

  // Run Sequencer loop
  useEffect(() => {
    if (sequencerRunning) {
      const intervalMs = (60 / bpm / 2) * 1000; // Eighth notes
      stepIntervalId.current = setInterval(() => {
        setCurrentStep((prev) => {
          const nextStep = (prev + 1) % 8;
          if (seqSteps[nextStep]) {
            const pitchMultiplier = seqPitches[nextStep];
            triggerVoice(frequency * pitchMultiplier, 0.2);
          }
          return nextStep;
        });
      }, intervalMs);
    } else {
      if (stepIntervalId.current) {
        clearInterval(stepIntervalId.current);
      }
    }

    return () => {
      if (stepIntervalId.current) {
        clearInterval(stepIntervalId.current);
      }
    };
  }, [sequencerRunning, bpm, seqSteps, seqPitches, frequency, waveType, detune, lfoSpeed, lfoDepth, attack, decay, sustain, release, filterType, cutoff, q, distortion, delayTime, delayFeedback, connections]);

  return (
    <div className="synth-container">
      
      {/* 📡 HEADER */}
      <header className="synth-header">
        <div className="brand-section">
          <div className="brand-indicator"></div>
          <div>
            <h1 className="brand-title">NEO_PATCHER_v2.5</h1>
            <p className="brand-subtitle">CYBERPUNK AUDIO NODE SYNTHESIZER</p>
          </div>
        </div>

        {/* Preset selections */}
        <div className="preset-selector">
          <span className="preset-label">PATCHES:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPreset(p)}
              className="preset-btn"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Master controller panel */}
        <div className="global-controls">
          <div className="bpm-panel">
            <span className="bpm-label font-mono">BPM</span>
            <input
              type="range"
              min="60"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
              className="dial-input"
              style={{ width: '96px' }}
            />
            <span className="bpm-val font-mono">{bpm}</span>
          </div>

          <button
            onClick={() => setConnections([])}
            className="btn-clear font-mono"
          >
            CLEAR PATCHES
          </button>

          {!audioContextActive ? (
            <button
              onClick={initAudio}
              className="btn-power-off"
            >
              INITIALIZE AUDIO
            </button>
          ) : (
            <div className="status-online">
              <span className="status-dot-ping"></span>
              <span>SYS_ONLINE</span>
            </div>
          )}
        </div>
      </header>

      {/* 🚀 WORKSPACE VIEWPORT */}
      <main className="synth-workspace">
        
        {/* LEFT PATCHING WORKSPACE */}
        <section className="patching-deck">
          <div className="deck-info-overlay">
            <span className="deck-info-title font-orbitron">NODE PATCH BAY</span>
            <span className="deck-info-desc font-mono">(Connect output port to input port)</span>
          </div>

          {/* SVG Connection Wires Drawing Area */}
          <svg className="wire-svg">
            {activeWireStart && (() => {
              const startNode = INITIAL_NODES.find(n => n.id === activeWireStart.split('-')[0]);
              if (!startNode) return null;
              
              const x1 = startNode.x + 225; 
              const y1 = startNode.y + 45;
              
              return (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x1 + 15}
                  y2={y1}
                  stroke="#ff007f"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                />
              );
            })()}

            {/* Existing patched connections */}
            {connections.map((c) => {
              const fromNode = INITIAL_NODES.find(n => n.id === c.fromId);
              const toNode = INITIAL_NODES.find(n => n.id === c.toId);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + 225;
              const y1 = fromNode.y + 45;

              const x2 = toNode.x + 5;
              const y2 = toNode.y + 45;

              const dx = Math.abs(x2 - x1) * 0.5;
              const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => removeConnection(c.id)}>
                  <path
                    d={path}
                    fill="none"
                    stroke="#ff007f"
                    strokeWidth="6"
                    opacity="0.2"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="#00f2fe"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}
          </svg>

          {/* Render draggable/interactive Module Cards */}
          <div className="nodes-container">
            {INITIAL_NODES.map((node) => (
              <div
                key={node.id}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="node-card"
              >
                {/* Node Header */}
                <div className="node-header">
                  <span className="node-title">{node.name}</span>
                  <div className="node-indicator"></div>
                </div>

                {/* Node Terminals Port strip */}
                <div className="node-ports">
                  {node.id !== 'osc' ? (
                    <button
                      onClick={() => handleTerminalClick(`${node.id}-in`)}
                      className={`port-btn ${activeWireStart === `${node.id}-in` ? 'active' : ''}`}
                    >
                      <span className="port-circle"></span>
                      IN
                    </button>
                  ) : (
                    <div></div>
                  )}

                  {node.id !== 'vis' ? (
                    <button
                      onClick={() => handleTerminalClick(`${node.id}-out`)}
                      className={`port-btn ${activeWireStart === `${node.id}-out` ? 'active-out' : ''}`}
                    >
                      OUT
                      <span className="port-circle"></span>
                    </button>
                  ) : (
                    <div></div>
                  )}
                </div>

                {/* Node controls dynamically populated */}
                <div className="node-body">
                  {node.type === 'oscillator' && (
                    <div>
                      <div className="control-row">
                        <span>WAVEFORM</span>
                        <span className="control-val magenta">{waveType.toUpperCase()}</span>
                      </div>
                      <div className="waveform-grid">
                        {['sine', 'triangle', 'sawtooth', 'square'].map(w => (
                          <button
                            key={w}
                            onClick={() => setWaveType(w as OscillatorType)}
                            className={`wave-select-btn font-mono ${waveType === w ? 'active' : ''}`}
                          >
                            {w.slice(0, 4).toUpperCase()}
                          </button>
                        ))}
                      </div>

                      <div className="slider-group">
                        <div className="control-row">
                          <span>FREQUENCY</span>
                          <span className="control-val">{frequency} Hz</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="880"
                          value={frequency}
                          onChange={(e) => setFrequency(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>

                      <div className="slider-group">
                        <div className="control-row">
                          <span>DETUNE</span>
                          <span className="control-val">±{detune}c</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={detune}
                          onChange={(e) => setDetune(parseInt(e.target.value))}
                          className="dial-input"
                        />
                      </div>

                      <div className="slider-group" style={{ borderTop: '1px solid rgba(0, 242, 254, 0.1)', paddingTop: '6px', marginTop: '6px' }}>
                        <div className="control-row">
                          <span>LFO RATE</span>
                          <span className="control-val magenta">{lfoSpeed} Hz</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={lfoSpeed}
                          onChange={(e) => setLfoSpeed(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>
                    </div>
                  )}

                  {node.type === 'adsr' && (
                    <div className="adsr-grid">
                      <div className="slider-group">
                        <label>ATTACK (A)</label>
                        <input
                          type="range"
                          min="0.01"
                          max="2"
                          step="0.01"
                          value={attack}
                          onChange={(e) => setAttack(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                        <div className="control-row" style={{ marginTop: '2px' }}>
                          <span></span>
                          <span className="control-val font-mono">{attack}s</span>
                        </div>
                      </div>

                      <div className="slider-group">
                        <label>DECAY (D)</label>
                        <input
                          type="range"
                          min="0.01"
                          max="2"
                          step="0.01"
                          value={decay}
                          onChange={(e) => setDecay(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                        <div className="control-row" style={{ marginTop: '2px' }}>
                          <span></span>
                          <span className="control-val font-mono">{decay}s</span>
                        </div>
                      </div>

                      <div className="slider-group">
                        <label>SUSTAIN (S)</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={sustain}
                          onChange={(e) => setSustain(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                        <div className="control-row" style={{ marginTop: '2px' }}>
                          <span></span>
                          <span className="control-val font-mono">{sustain}</span>
                        </div>
                      </div>

                      <div className="slider-group">
                        <label>RELEASE (R)</label>
                        <input
                          type="range"
                          min="0.01"
                          max="3"
                          step="0.05"
                          value={release}
                          onChange={(e) => setRelease(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                        <div className="control-row" style={{ marginTop: '2px' }}>
                          <span></span>
                          <span className="control-val font-mono">{release}s</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {node.type === 'filter' && (
                    <div>
                      <div className="control-row">
                        <span>MODE</span>
                        <span className="control-val green">{filterType.toUpperCase()}</span>
                      </div>
                      <div className="filter-grid">
                        {['lowpass', 'highpass', 'bandpass'].map(t => (
                          <button
                            key={t}
                            onClick={() => setFilterType(t as BiquadFilterType)}
                            className={`filter-btn font-mono ${filterType === t ? 'active' : ''}`}
                          >
                            {t.slice(0, 4).toUpperCase()}
                          </button>
                        ))}
                      </div>

                      <div className="slider-group">
                        <div className="control-row">
                          <span>CUTOFF</span>
                          <span className="control-val">{cutoff} Hz</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="4000"
                          step="10"
                          value={cutoff}
                          onChange={(e) => setCutoff(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>

                      <div className="slider-group">
                        <div className="control-row">
                          <span>RESONANCE</span>
                          <span className="control-val">{q}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={q}
                          onChange={(e) => setQ(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>
                    </div>
                  )}

                  {node.type === 'distortion' && (
                    <div>
                      <div className="slider-group">
                        <div className="control-row">
                          <span>DRIVE / GRIT</span>
                          <span className="control-val orange">{distortion}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={distortion}
                          onChange={(e) => setDistortion(parseInt(e.target.value))}
                          className="dial-input"
                        />
                      </div>
                    </div>
                  )}

                  {node.type === 'delay' && (
                    <div>
                      <div className="slider-group">
                        <div className="control-row">
                          <span>DELAY TIME</span>
                          <span className="control-val">{delayTime}s</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="1.5"
                          step="0.05"
                          value={delayTime}
                          onChange={(e) => setDelayTime(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>

                      <div className="slider-group">
                        <div className="control-row">
                          <span>FEEDBACK</span>
                          <span className="control-val">{Math.round(delayFeedback * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="0.9"
                          step="0.05"
                          value={delayFeedback}
                          onChange={(e) => setDelayFeedback(parseFloat(e.target.value))}
                          className="dial-input"
                        />
                      </div>
                    </div>
                  )}

                  {node.type === 'visualizer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        {['wave', 'frequency', 'radial'].map(m => (
                          <button
                            key={m}
                            onClick={() => setVisualizerMode(m as any)}
                            className={`wave-select-btn font-mono ${visualizerMode === m ? 'active' : ''}`}
                            style={{ fontSize: '8px' }}
                          >
                            {m.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="font-mono" style={{ padding: '6px', textAlign: 'center', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 242, 254, 0.1)', borderRadius: '4px', fontSize: '9px', color: 'var(--neon-cyan)', animation: 'pulse 1.5s infinite' }}>
                        OUTPUT STABLE (24-BIT)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT CONTROL DECK & KEYBOARD */}
        <section className="control-deck">
          
          {/* ANALYSER MONITOR PANEL */}
          <div className="visualizer-panel">
            <div className="visualizer-header">
              <span className="visualizer-title font-mono">SIGNAL_OUTPUT</span>
            </div>
            <canvas
              ref={canvasRef}
              width={280}
              height={160}
              className="visualizer-canvas"
            />
          </div>

          {/* SEQUENCER BLOCK */}
          <div className="sequencer-panel">
            <div className="sequencer-header">
              <span className="sequencer-title">STEP_SEQUENCER</span>
              <button
                onClick={() => setSequencerRunning(!sequencerRunning)}
                className={`btn-seq-toggle ${sequencerRunning ? 'running' : 'stopped'}`}
              >
                {sequencerRunning ? 'STOP' : 'RUN'}
              </button>
            </div>

            {/* Step triggers grid */}
            <div className="sequencer-steps">
              {seqSteps.map((step, idx) => (
                <div key={idx} className="step-col">
                  <button
                    onClick={() => {
                      const copy = [...seqSteps];
                      copy[idx] = !copy[idx];
                      setSeqSteps(copy);
                    }}
                    className={`step-btn ${step ? 'active' : ''}`}
                  />
                  <div className={`step-indicator ${currentStep === idx && sequencerRunning ? 'active' : ''}`} />
                </div>
              ))}
            </div>

            {/* Pitch shifts per step */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="font-mono" style={{ fontSize: '9px', color: '#708090' }}>STEP NOTE HEIGHT:</span>
              <div className="sequencer-steps">
                {seqPitches.map((pitch, idx) => (
                  <select
                    key={idx}
                    value={pitch}
                    onChange={(e) => {
                      const copy = [...seqPitches];
                      copy[idx] = parseFloat(e.target.value);
                      setSeqPitches(copy);
                    }}
                    className="pitch-select font-mono"
                  >
                    <option value="0.8">0.8x</option>
                    <option value="1.0">1.0x</option>
                    <option value="1.2">1.2x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.8">1.8x</option>
                    <option value="2.0">2.0x</option>
                  </select>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 🎹 NEON AUDIO KEYBOARD */}
      <footer className="synth-footer">
        <div className="footer-info">
          <span className="footer-title">LIVE_TRIGGER_KEYS</span>
          <span className="footer-subtitle font-mono">Press keys to generate analog frequencies</span>
        </div>

        <div className="keyboard-keys">
          {KEYBOARD_KEYS.map((k) => (
            <button
              key={k.label}
              onClick={() => triggerVoice(k.freq, 0.4)}
              style={{ '--key-color-rgb': k.rgb } as any}
              className="key-btn"
            >
              <span>{k.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
