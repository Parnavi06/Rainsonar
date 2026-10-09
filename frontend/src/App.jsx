import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import './index.css';

// Minimal Inline Icons
const UploadIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const CloudRainIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>;
const WaveformIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
const PulseIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
const SpectrumIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const FreqIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>;
const CpuIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>;

function RainBackground() {
  const [drops, setDrops] = useState([]);
  
  useEffect(() => {
    // Generate static rain drops on mount (unchanged logic)
    const numDrops = 60;
    const newDrops = Array.from({ length: numDrops }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, 
      animationDelay: Math.random() * 2, 
      animationDuration: 0.8 + Math.random() * 0.7, 
      opacity: 0.2 + Math.random() * 0.5,
      height: 60 + Math.random() * 60, 
    }));
    setDrops(newDrops);
  }, []);

  return (
    <>
      <div className="ambient-glow" />
      <div className="rain-container">
        {drops.map(drop => (
          <div 
            key={drop.id}
            className="drop"
            style={{
              left: `${drop.left}%`,
              animationDelay: `${drop.animationDelay}s`,
              animationDuration: `${drop.animationDuration}s`,
              opacity: drop.opacity,
              height: `${drop.height}px`
            }}
          />
        ))}
      </div>
    </>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");
      
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to analyze audio');
        } else {
          // It's not JSON, probably an HTML error page from Vercel
          const errText = await response.text();
          if (response.status === 404) {
            throw new Error(`Endpoint not found (404). Target: ${API_BASE_URL}/analyze`);
          } else if (response.status === 413) {
            throw new Error("The WAV file exceeds the deployment request-size limit (Vercel max 4.5 MB).");
          } else {
            throw new Error(`Backend error (${response.status}). Response was not JSON. Target: ${API_BASE_URL}/analyze`);
          }
        }
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result?.fft ? result.fft.frequencies.map((freq, i) => ({
    frequency: Math.round(freq),
    magnitude: result.fft.magnitudes[i]
  })).filter((_, i) => i % 5 === 0) : [];

  const getIntensityMessage = (intensity) => {
    if (intensity === 'HEAVY') return "High rainfall intensity detected";
    if (intensity === 'MODERATE') return "Moderate rainfall intensity detected";
    return "Low rainfall intensity detected";
  };
  
  // Calculate stroke dashoffset for the circular gauge (Score out of 100)
  // Circle circumference is approx 314 (2 * pi * r where r=50)
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const score = result?.score || 0;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <>
      <RainBackground />
      <div className="app-container">
        
        {/* HEADER */}
        <header>
          <div className="title-container">
            <span className="title-icon"><CloudRainIcon /></span>
            <h1>Rain<span>Sonar</span></h1>
          </div>
          <p className="subtitle">Rainfall Intensity Estimation Using Acoustic Signal Processing</p>
        </header>

        {/* 1. UPLOAD AUDIO */}
        <section className="glass-card">
          <div className="section-header">
            <h2 className="section-title">Upload Audio File</h2>
            <p className="section-subtitle">Upload a rainfall WAV file to analyze its acoustic characteristics.</p>
          </div>
          
          <div className="upload-compact">
            <label className="upload-area">
              <UploadIcon style={{color: 'rgba(255,255,255,0.7)'}} />
              <div style={{display: 'flex', flexDirection: 'column'}}>
                <span className="upload-prompt">Choose WAV File / Drop area</span>
                <span style={{fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)'}}>Supports .wav files</span>
              </div>
              <input type="file" accept=".wav" onChange={handleFileChange} />
            </label>

            <div className="file-info">
              {file ? (
                <>
                  <span className="file-name">{file.name}</span>
                  <span className="file-meta">Selected for analysis</span>
                </>
              ) : (
                <>
                  <span className="file-name" style={{color: 'rgba(255,255,255,0.3)'}}>No file selected</span>
                  <span className="file-meta">-</span>
                </>
              )}
            </div>

            <button 
              className="btn-analyze" 
              onClick={handleAnalyze} 
              disabled={!file || loading}
            >
              {loading ? 'ANALYZING...' : 'ANALYZE'}
            </button>
          </div>
          
          {error && <div className="error-msg">{error}</div>}
        </section>

        {result && !loading && (
          <>
            {/* 2. RAINFALL INTENSITY */}
            <section className="glass-card">
              <div className="section-header">
                <h2 className="section-title">Rainfall Intensity</h2>
              </div>
              <div className="intensity-container">
                <div className="intensity-text-area">
                  <div className={`intensity-level intensity-${result.rainfall_intensity}`}>
                    {result.rainfall_intensity}
                  </div>
                  <div className="intensity-desc">
                    {getIntensityMessage(result.rainfall_intensity)}
                  </div>
                </div>

                <div className="score-gauge-container">
                  <svg className="score-gauge-svg" viewBox="0 0 120 120">
                    <circle 
                      className="gauge-bg" 
                      cx="60" cy="60" r={radius} 
                    />
                    <circle 
                      className="gauge-progress" 
                      cx="60" cy="60" r={radius} 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="gauge-text">
                    <span className="gauge-value">{result.score}</span>
                    <span className="gauge-label">/ 100</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. FOUR EXTRACTED FEATURES */}
            <section className="glass-card">
              <div className="section-header">
                <h2 className="section-title">Extracted Features</h2>
                <p className="section-subtitle">Key acoustic features extracted from the rainfall signal</p>
              </div>
              
              <div className="features-grid">
                <div className="feature-card feat-rms">
                  <div className="feature-icon-wrapper"><WaveformIcon /></div>
                  <div className="feature-info">
                    <span className="feature-name">RMS Energy</span>
                    <div>
                      <span className="feature-value">{result.features.rms}</span>
                    </div>
                  </div>
                </div>
                
                <div className="feature-card feat-peak">
                  <div className="feature-icon-wrapper"><PulseIcon /></div>
                  <div className="feature-info">
                    <span className="feature-name">Peak Amplitude</span>
                    <div>
                      <span className="feature-value">{result.features.peak_amplitude}</span>
                    </div>
                  </div>
                </div>
                
                <div className="feature-card feat-spectral">
                  <div className="feature-icon-wrapper"><SpectrumIcon /></div>
                  <div className="feature-info">
                    <span className="feature-name">Spectral Energy</span>
                    <div>
                      <span className="feature-value">{result.features.spectral_energy}</span>
                    </div>
                  </div>
                </div>
                
                <div className="feature-card feat-freq">
                  <div className="feature-icon-wrapper"><FreqIcon /></div>
                  <div className="feature-info">
                    <span className="feature-name">Dominant Frequency</span>
                    <div>
                      <span className="feature-value">{result.features.dominant_frequency}</span>
                      <span className="feature-unit">Hz</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. FFT SPECTRUM */}
            <section className="glass-card">
              <div className="section-header">
                <h2 className="section-title">FFT Spectrum</h2>
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="frequency" 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}}
                      label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -15, fill: 'rgba(255,255,255,0.7)' }}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.5)" 
                      tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12}}
                      label={{ value: 'Magnitude', angle: -90, position: 'insideLeft', offset: -5, fill: 'rgba(255,255,255,0.7)' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#ffffff' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="magnitude" 
                      stroke="#22d3ee" 
                      dot={false}
                      strokeWidth={2}
                      activeDot={{ r: 5, fill: '#ffffff', stroke: '#22d3ee' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 5. DSP PROCESSING PIPELINE */}
            <section className="glass-card">
              <div className="section-header">
                <h2 className="section-title">DSP Processing Pipeline</h2>
                <p className="section-subtitle">Signal processing stages applied to the rainfall audio</p>
              </div>
              
              <div className="pipeline-container">
                <div className="pipeline-node"><CpuIcon /> Audio Input</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">Mono Conversion</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">Normalize</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">FIR Filter</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">Framing</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">50% Overlap</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">Hamming Window</div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-node">FFT</div>
              </div>

              <div className="pipeline-params">
                <div className="param-badge"><span>Frame Size:</span> 1024 samples</div>
                <div className="param-badge"><span>Overlap:</span> 50%</div>
                <div className="param-badge"><span>Window:</span> Hamming</div>
                <div className="param-badge"><span>Filter:</span> FIR</div>
                <div className="param-badge"><span>FFT:</span> Real FFT</div>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default App;
