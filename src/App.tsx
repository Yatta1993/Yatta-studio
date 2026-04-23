/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Mic2, 
  Settings, 
  Trash2, 
  Loader2,
  ChevronRight,
  Headphones,
  Info
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// Standard sample rate for Gemini TTS
const SAMPLE_RATE = 24000;

interface Voice {
  id: string;
  name: string;
  description: string;
}

const VOICES: Voice[] = [
  { id: 'Kore', name: 'Kore', description: 'Voix équilibrée et naturelle' },
  { id: 'Puck', name: 'Puck', description: 'Énergique et dynamique' },
  { id: 'Charon', name: 'Charon', description: 'Calme et profonde' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Autoritaire et claire' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Douce et aérienne' },
];

interface GeneratedAudio {
  id: string;
  text: string;
  voice: string;
  url: string;
  timestamp: number;
}

export default function App() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Function to convert PCM base64 to WAV Blob
  const pcmToWav = (base64Pcm: string, sampleRate: number): Blob => {
    const binaryString = atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // WAV Header constants
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // "RIFF"
    view.setUint32(0, 0x52494646, false);
    // Length (file size - 8)
    view.setUint32(4, 36 + len, true);
    // "WAVE"
    view.setUint32(8, 0x57415645, false);
    // "fmt "
    view.setUint32(12, 0x666d7420, false);
    // Subchunk1size (16 for PCM)
    view.setUint32(16, 16, true);
    // AudioFormat (1 for PCM)
    view.setUint16(20, 1, true);
    // NumChannels (1 for Mono)
    view.setUint16(22, 1, true);
    // SampleRate
    view.setUint32(24, sampleRate, true);
    // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint32(28, sampleRate * 1 * 2, true);
    // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(32, 1 * 2, true);
    // BitsPerSample (16)
    view.setUint16(34, 16, true);
    // "data"
    view.setUint32(36, 0x64617461, false);
    // Subchunk2Size (length of the actual data)
    view.setUint32(40, len, true);

    return new Blob([wavHeader, bytes], { type: 'audio/wav' });
  };

  const generateSpeech = async () => {
    if (!text.trim()) return;

    setIsGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say with a professional and natural tone: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice.id as any },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const wavBlob = pcmToWav(base64Audio, SAMPLE_RATE);
        const url = URL.createObjectURL(wavBlob);
        
        const newAudio: GeneratedAudio = {
          id: Math.random().toString(36).substring(7),
          text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
          voice: selectedVoice.name,
          url,
          timestamp: Date.now(),
        };

        setHistory(prev => [newAudio, ...prev]);
        setText('');
      }
    } catch (error) {
      console.error('Error generating speech:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = (item: GeneratedAudio) => {
    if (isPlaying === item.id) {
      audioRef.current?.pause();
      setIsPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = item.url;
        audioRef.current.play();
        setIsPlaying(item.id);
      }
    }
  };

  const deleteItem = (id: string) => {
    setHistory(prev => {
      const itemToDelete = prev.find(item => item.id === id);
      if (itemToDelete) URL.revokeObjectURL(itemToDelete.url);
      return prev.filter(item => item.id !== id);
    });
  };

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(null);
    return () => {
      audio.pause();
      history.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col p-6">
      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col">
        {/* Top Header Navigation */}
        <header className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Volume2 className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Vocalize <span className="text-indigo-400 font-medium">Pro</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Professional TTS Suite</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="text-white border-b-2 border-indigo-500 pb-1">Converter</a>
            <a href="#" className="hover:text-white transition-colors">Library</a>
            <a href="#" className="hover:text-white transition-colors">Voices</a>
            <a href="#" className="hover:text-white transition-colors">Settings</a>
          </nav>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-indigo-400 tracking-wider">
              BETA ACCESS
            </div>
            <button className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Bento Main Grid Layout */}
        <main className="grid grid-cols-12 gap-4 flex-grow">
          
          {/* Main Input Area */}
          <div className="col-span-12 lg:col-span-8 lg:row-span-4 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col relative group min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-2 tracking-widest uppercase">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Input Content
              </label>
              <span className="text-[10px] text-slate-600 font-mono tracking-wider">{text.length} / 5,000 CHARS</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Saisissez votre texte ici pour le convertir en audio professionnel..."
              className="bg-transparent border-none focus:ring-0 text-lg md:text-xl leading-relaxed text-slate-200 resize-none h-full placeholder-slate-800 scrollbar-none"
            />
            <div className="absolute bottom-6 right-6 flex gap-2">
              <button 
                onClick={() => setText('')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={async () => {
                  try {
                    const t = await navigator.clipboard.readText();
                    setText(t);
                  } catch (e) {}
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-indigo-600/20"
              >
                Paste
              </button>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 lg:row-span-3 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col">
            <h2 className="text-[10px] font-bold text-slate-500 mb-6 tracking-widest uppercase">Select Voice</h2>
            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 -mr-2 scrollbar-none">
              {VOICES.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`
                    w-full p-3 rounded-2xl flex items-center gap-3 transition-all duration-200 text-left group
                    ${selectedVoice.id === voice.id 
                      ? 'bg-indigo-600/10 border border-indigo-500/30' 
                      : 'bg-slate-800/40 border border-slate-800 hover:bg-slate-800/60'}
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg transition-transform group-hover:scale-105
                    ${selectedVoice.id === voice.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}
                  `}>
                    {voice.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-grow">
                    <p className={`text-sm font-bold ${selectedVoice.id === voice.id ? 'text-white' : 'text-slate-300'}`}>
                      {voice.name}
                    </p>
                    <p className={`text-[10px] ${selectedVoice.id === voice.id ? 'text-indigo-300' : 'text-slate-500'}`}>
                      {voice.description}
                    </p>
                  </div>
                  {selectedVoice.id === voice.id && (
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Library / History */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 lg:row-span-3 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Library</h2>
              <span className="text-[10px] font-mono text-indigo-400">{history.length} ITEMS</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none">
              <AnimatePresence mode="popLayout">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-4">
                    <Headphones size={32} className="mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No recordings</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mb-1">{item.voice}</p>
                          <p className="text-xs text-slate-400 line-clamp-1 italic">"{item.text}"</p>
                        </div>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-slate-700 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => togglePlay(item)}
                          className={`
                            flex-grow py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all
                            ${isPlaying === item.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                          `}
                        >
                          {isPlaying === item.id ? 'Playing...' : 'Play'}
                        </button>
                        <a
                          href={item.url}
                          download={`speech-${item.id}.wav`}
                          className="p-2 bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Generation & Visualizer Zone */}
          <div className="col-span-12 lg:col-span-8 lg:row-span-2 bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border border-indigo-500/10 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-8 min-h-[160px]">
             <div className="flex-grow w-full">
              <div className="flex items-end gap-1 h-12 mb-6 opacity-40 group-hover:opacity-60 transition-opacity">
                {[...Array(20)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={isGenerating ? { height: [12, 48, 12] } : { height: [12, 16, 12] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.05 }}
                    className="w-1 bg-indigo-500/40 rounded-full"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Format: WAV 24kHz</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Mode: Neural</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
                    {isGenerating ? 'Rendering Engine Active' : 'Ready to Render'}
                  </span>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateSpeech}
              disabled={isGenerating || !text.trim()}
              className={`
                h-20 w-full md:w-56 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-2xl transition-all group relative overflow-hidden
                ${isGenerating || !text.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30'}
              `}
            >
              {isGenerating && (
                <motion.div 
                  className="absolute inset-0 bg-white/10"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                />
              )}
              <span className="text-xl font-black tracking-tight">
                {isGenerating ? 'GÉNÉRATION' : 'GÉNÉRER'}
              </span>
              <span className="text-[10px] font-medium opacity-70 tracking-widest">
                {isGenerating ? 'Traitement en cours...' : 'AI Synthesizer v3.1'}
              </span>
            </motion.button>
          </div>

        </main>

        {/* Bottom Status Bar */}
        <footer className="mt-8 flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-slate-900 border border-slate-800 rounded-3xl gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Server: EU-Cloud-Synthesizer</span>
            </div>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">GPU Accel:</span>
              <span className="text-[9px] text-green-500 font-black uppercase tracking-widest">ENABLED</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-[9px] font-bold text-slate-500 hover:text-white transition-colors tracking-widest uppercase">Docs</button>
            <button className="text-[9px] font-bold text-slate-500 hover:text-white transition-colors tracking-widest uppercase">Support</button>
            <div className="text-[10px] font-bold bg-slate-800 px-3 py-1 rounded-lg text-slate-400 border border-slate-700 tracking-tighter">
              v3.1.2-STABLE
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
