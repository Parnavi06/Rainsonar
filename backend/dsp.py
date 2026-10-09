import numpy as np
import soundfile as sf
import scipy.signal as signal

def load_audio(file_path):
    """
    Loads a WAV file and returns the audio samples and sampling rate.
    """
    try:
        audio, sr = sf.read(file_path)
        if len(audio) == 0:
            raise ValueError("Audio file is empty.")
        return audio, sr
    except Exception as e:
        raise ValueError(f"Failed to load audio: {e}")

def convert_to_mono(audio):
    """
    Converts stereo or multi-channel audio to mono by averaging channels.
    """
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    return audio

def normalize_audio(audio):
    """
    Normalizes audio using peak normalization.
    """
    max_val = np.max(np.abs(audio))
    if max_val == 0:
        return audio
    return audio / max_val

def fir_filter(audio, sr):
    """
    Applies a simple Low-Pass FIR filter to reduce high-frequency noise.
    Cutoff frequency: 4000 Hz.
    """
    numtaps = 101
    cutoff_hz = 4000.0
    nyq_rate = sr / 2.0
    
    if cutoff_hz >= nyq_rate:
        cutoff_hz = nyq_rate - 100.0 # Adjust if sample rate is very low

    # Design FIR filter
    fir_coeff = signal.firwin(numtaps, cutoff_hz / nyq_rate)
    
    # Apply filter
    filtered_audio = signal.lfilter(fir_coeff, 1.0, audio)
    return filtered_audio

def frame_signal(audio, frame_size=1024, hop_size=512):
    """
    Splits the audio signal into frames of frame_size with 50% overlap.
    Pads the final frame with zeros if it's shorter than frame_size.
    """
    frames = []
    for i in range(0, len(audio), hop_size):
        frame = audio[i:i + frame_size]
        if len(frame) < frame_size:
            # Zero-pad the last frame
            pad_length = frame_size - len(frame)
            frame = np.pad(frame, (0, pad_length), mode='constant')
        frames.append(frame)
    return frames

def apply_hamming_window(frame):
    """
    Applies a Hamming window to a frame.
    w[n] = 0.54 - 0.46 * cos(2pi * n / (N - 1))
    """
    N = len(frame)
    # Numpy has a built-in hamming window, but implementing manually as requested for explainability
    n = np.arange(N)
    window = 0.54 - 0.46 * np.cos(2 * np.pi * n / (N - 1))
    return frame * window

def calculate_fft(frame, sr):
    """
    Calculates the real FFT and magnitude spectrum of a frame.
    Returns frequencies and magnitude spectrum.
    """
    N = len(frame)
    fft_result = np.fft.rfft(frame)
    magnitude_spectrum = np.abs(fft_result)
    
    # Frequency resolution = sr / N
    frequencies = np.fft.rfftfreq(N, 1.0 / sr)
    
    return frequencies, magnitude_spectrum

def extract_features(frame, sr):
    """
    Extracts the 4 required features from a single frame:
    1. RMS Energy
    2. Peak Amplitude
    3. Spectral Energy
    4. Dominant Frequency
    """
    # 1. RMS Energy
    rms = np.sqrt(np.mean(frame**2))
    
    # 2. Peak Amplitude
    peak = np.max(np.abs(frame))
    
    # 3. Spectral Energy & 4. Dominant Frequency
    frequencies, magnitude_spectrum = calculate_fft(frame, sr)
    
    spectral_energy = np.sum(magnitude_spectrum**2)
    
    # Dominant frequency is the frequency with the maximum magnitude
    dominant_freq_index = np.argmax(magnitude_spectrum)
    dominant_frequency = frequencies[dominant_freq_index]
    
    return {
        "rms": rms,
        "peak": peak,
        "spectral_energy": spectral_energy,
        "dominant_frequency": dominant_frequency
    }, frequencies, magnitude_spectrum

def process_audio(file_path):
    """
    Complete DSP pipeline for a single audio file.
    Returns aggregated features and a representative FFT.
    """
    audio, sr = load_audio(file_path)
    audio = convert_to_mono(audio)
    audio = normalize_audio(audio)
    audio = fir_filter(audio, sr)
    
    frames = frame_signal(audio, frame_size=1024, hop_size=512)
    
    all_rms = []
    all_peaks = []
    all_spectral_energy = []
    all_dominant_freqs = []
    
    representative_fft_freq = None
    representative_fft_mag = None
    
    for i, frame in enumerate(frames):
        windowed_frame = apply_hamming_window(frame)
        features, freqs, mag = extract_features(windowed_frame, sr)
        
        all_rms.append(features["rms"])
        all_peaks.append(features["peak"])
        all_spectral_energy.append(features["spectral_energy"])
        all_dominant_freqs.append(features["dominant_frequency"])
        
        # Save the FFT of the middle frame to send to frontend
        if i == len(frames) // 2:
            representative_fft_freq = freqs
            representative_fft_mag = mag
            
    # Aggregation
    aggregated_features = {
        "rms": float(np.mean(all_rms)),
        "peak_amplitude": float(np.max(all_peaks)), # max across frames
        "spectral_energy": float(np.mean(all_spectral_energy)),
        "dominant_frequency": float(np.median(all_dominant_freqs))
    }
    
    return aggregated_features, representative_fft_freq.tolist(), representative_fft_mag.tolist()
