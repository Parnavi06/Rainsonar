from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

from dsp import process_audio
from classifier import load_calibration, normalize_features, calculate_score, classify_intensity

app = FastAPI(title="Rainfall Intensity Estimation API")

# Allow CORS for React frontend
origins_env = os.getenv("FRONTEND_ORIGINS")
if origins_env:
    allow_origins = [origin.strip() for origin in origins_env.split(",")]
else:
    allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load calibration on startup
try:
    CALIB_DATA = load_calibration()
except Exception as e:
    print("Warning: Could not load calibration data. Please run classifier.py --calibrate")
    CALIB_DATA = None

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Only WAV files are supported.")
        
    if CALIB_DATA is None:
        raise HTTPException(status_code=500, detail="Calibration data missing. Please calibrate backend.")
        
    temp_file = f"temp_{file.filename}"
    try:
        # Save uploaded file temporarily
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # DSP Pipeline
        features, fft_freq, fft_mag = process_audio(temp_file)
        
        # Classification Pipeline
        norm_features = normalize_features(features, CALIB_DATA)
        score = calculate_score(norm_features)
        intensity = classify_intensity(score, CALIB_DATA)
        
        # Prepare response
        return {
            "rainfall_intensity": intensity.upper(),
            "score": round(score, 1),
            "features": {
                "rms": round(features["rms"], 4),
                "peak_amplitude": round(features["peak_amplitude"], 4),
                "spectral_energy": round(features["spectral_energy"], 1),
                "dominant_frequency": round(features["dominant_frequency"], 1)
            },
            "fft": {
                "frequencies": fft_freq,
                "magnitudes": fft_mag
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DSP Processing Error: {str(e)}")
    finally:
        # Cleanup
        if os.path.exists(temp_file):
            os.remove(temp_file)
