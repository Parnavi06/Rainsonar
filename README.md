# Rainfall Intensity Estimation Using Acoustic Signal Processing

## 1. Project Title
Rainfall Intensity Estimation Using Acoustic Signal Processing

## 2. Project Objective
Build a robust, reliable, and easily explainable Digital Signal Processing (DSP) application that accepts a rainfall WAV audio file and estimates rainfall intensity as Light, Moderate, or Heavy.

## 3. Problem Statement
Professional rainfall observation networks can be sparse, but ubiquitous surveillance cameras or simple microphones can record rainfall events via audio. This project extracts acoustic features from rainfall sounds purely through signal processing (without Machine Learning) to map the sound characteristics to rainfall intensity categories.

## 4. Technology Stack
- **Backend:** Python (FastAPI, Uvicorn, NumPy, SciPy, Soundfile)
- **Frontend:** React (Vite, Recharts, CSS)

## 5. Folder Structure
```
Rainfall_Intensity_Project/
├── backend/
│   ├── main.py
│   ├── dsp.py
│   ├── classifier.py
│   ├── requirements.txt
│   └── calibration.json
├── frontend/
│   ├── (React + Vite files)
│   └── src/
├── dataset/
│   └── (Rainfall audio files)
└── README.md
```

## 6. DSP Pipeline
WAV file → Load audio → Convert to mono → Normalize → FIR filter → Frame signal → 50% overlap → Hamming window → FFT → Magnitude spectrum → Feature extraction → Frame aggregation → Feature normalization → Weighted score → Classification

## 7. Audio Preprocessing
Audio is loaded using `soundfile`. If stereo, channels are averaged to mono. Then peak normalization is applied: `audio = audio / max(abs(audio))` to ensure consistent amplitudes before processing.

## 8. FIR Filtering
A Low-Pass Finite Impulse Response (FIR) filter (cutoff at 4000 Hz) is applied to remove irrelevant high-frequency environmental noise. FIR filters are stable, have linear phase, and are conceptually simple to explain.

## 9. Framing
The audio is split into short segments called frames (1024 samples). Since audio properties change over time, framing allows us to analyze the signal locally. 1024 samples is a power of 2, optimizing the FFT calculation speed.

## 10. 50% Overlap
Frames overlap by 512 samples. Overlapping prevents information loss at the boundaries of frames, especially because we apply a windowing function that tapers the edges to zero.

## 11. Hamming Window
We apply a Hamming window to each frame: `w[n] = 0.54 - 0.46 cos(2πn/(N-1))`. This tapers the frame edges, preventing spectral leakage (artificial high frequencies) that would occur if we just chopped the signal abruptly.

## 12. FFT (Fast Fourier Transform)
FFT converts the time-domain signal into the frequency domain, revealing which frequencies are present. We take the absolute value of the FFT output to get the Magnitude Spectrum.
At a 16 kHz sample rate and 1024 frame size, the frequency resolution is 16000 / 1024 = 15.625 Hz.

## 13. Four Features
1. **RMS Energy:** `sqrt(mean(frame²))` - The average power of the signal.
2. **Peak Amplitude:** `max(abs(frame))` - The maximum absolute value.
3. **Spectral Energy:** `sum(magnitude²)` - Total energy in the frequency domain.
4. **Dominant Frequency:** The frequency corresponding to the maximum magnitude.

## 14. Feature Normalization
Using calibration data, features are min-max normalized `(value - min) / (max - min)` and clamped between 0 and 1.

## 15. Weighted Score
Score = 0.40 * RMS + 0.30 * Spectral Energy + 0.15 * Dominant Frequency + 0.15 * Peak Amplitude.
Scaled to 0-100.
*Why these weights?* RMS and Spectral Energy strongly correlate with how "loud" or intense the rainfall is, while frequency and peak amplitude offer secondary characteristics about droplet sizes and impacts.

## 16. Rainfall Class Mapping
Based on established literature (e.g., the Amazon dataset):
- Light: ≤ 2.5 mm/h
- Moderate: 2.5 mm/h - 10 mm/h
- Heavy: > 10 mm/h

## 17. Dataset Sources
The system uses the SARID dataset (or equivalent labeled acoustic rainfall datasets). The current test files provided in the `dataset` folder are placeholders for pipeline verification.

## 18. Calibration Process
Run `python classifier.py --calibrate --dataset-dir ../dataset`. This offline process analyzes all labeled WAV files, finds the min/max feature values, and establishes score thresholds (saved to `calibration.json`).

## 19. API Usage
`POST /analyze`
Accepts a `.wav` file as `multipart/form-data`.
Returns JSON containing `rainfall_intensity`, `score`, `features`, and `fft` plotting data.

## 20. Frontend Usage
Open the React app in a browser. Click "Choose WAV File" and then "Analyze". It displays the results and an FFT chart.

## 21. Installation
**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # (Windows)
pip install -r requirements.txt
```
**Frontend:**
```bash
cd frontend
npm install
```

## 22. How to run backend
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

## 23. How to run frontend
```bash
cd frontend
npm run dev
```

## 24. Testing
Run tests by uploading the provided `dataset/*_test.wav` files in the frontend.

## 25. Limitations
This project is NOT a machine-learning model, and the thresholds are empirically derived based on a small calibration set. Accuracy depends heavily on the microphone, environment, surface material, and background noise. It should not replace a professional rain gauge.

## 26. Viva Questions / Important Concepts
- **What is an acoustic rainfall signal?** Sound produced by raindrops hitting a surface.
- **What is sampling?** Converting continuous sound waves into discrete digital numbers.
- **Why convert to mono?** Rain intensity estimation relies on overall acoustic energy; stereo channels provide spatial data that is unnecessary and computationally heavier.
- **Why normalize?** To remove volume differences caused by microphone gain settings.
- **Why is this not ML?** It uses explicitly programmed mathematical DSP rules and static thresholds, not a learned statistical model.
