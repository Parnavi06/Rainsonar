import json
import os
import argparse
from typing import Dict
import os
from dsp import process_audio

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CALIBRATION_FILE = os.path.join(BASE_DIR, "calibration.json")

# Score boundaries - defaults before calibration
LIGHT_MAX_SCORE = 33.0
MODERATE_MAX_SCORE = 66.0

def load_calibration() -> Dict:
    if not os.path.exists(CALIBRATION_FILE):
        raise FileNotFoundError(f"Calibration file {CALIBRATION_FILE} not found. Please run with --calibrate first.")
    with open(CALIBRATION_FILE, "r") as f:
        return json.load(f)

def normalize_value(val: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.5
    norm = (val - min_val) / (max_val - min_val)
    return max(0.0, min(1.0, norm))

def normalize_features(features: Dict, calib_data: Dict) -> Dict:
    return {
        "rms": normalize_value(features["rms"], calib_data["rms"]["min"], calib_data["rms"]["max"]),
        "peak_amplitude": normalize_value(features["peak_amplitude"], calib_data["peak_amplitude"]["min"], calib_data["peak_amplitude"]["max"]),
        "spectral_energy": normalize_value(features["spectral_energy"], calib_data["spectral_energy"]["min"], calib_data["spectral_energy"]["max"]),
        "dominant_frequency": normalize_value(features["dominant_frequency"], calib_data["dominant_frequency"]["min"], calib_data["dominant_frequency"]["max"])
    }

def calculate_score(norm_features: Dict) -> float:
    """
    Calculates weighted score 0-100.
    RMS Energy = 40%
    Spectral Energy = 30%
    Dominant Frequency = 15%
    Peak Amplitude = 15%
    """
    score = (
        0.40 * norm_features["rms"] +
        0.30 * norm_features["spectral_energy"] +
        0.15 * norm_features["dominant_frequency"] +
        0.15 * norm_features["peak_amplitude"]
    )
    return score * 100.0

def classify_intensity(score: float, calib_data: Dict) -> str:
    """
    Classifies based on thresholds defined in calibration.json.
    """
    thresholds = calib_data.get("thresholds", {})
    light_max = thresholds.get("light_max", LIGHT_MAX_SCORE)
    moderate_max = thresholds.get("moderate_max", MODERATE_MAX_SCORE)
    
    if score <= light_max:
        return "Light"
    elif score <= moderate_max:
        return "Moderate"
    else:
        return "Heavy"

def run_calibration(dataset_dir: str):
    """
    Offline calibration.
    Reads WAV files from dataset_dir. Expects filenames starting with 'Light_', 'Moderate_', 'Heavy_'.
    Computes min/max for features and estimates simple score boundaries.
    """
    print(f"Starting calibration using dataset directory: {dataset_dir}")
    if not os.path.exists(dataset_dir):
        print("Dataset directory not found.")
        return
        
    files = [f for f in os.listdir(dataset_dir) if f.endswith(".wav")]
    if not files:
        print("No WAV files found in dataset. Please add labeled WAV files.")
        print("Expected prefixes: 'Light_', 'Moderate_', 'Heavy_'.")
        return
        
    features_by_class = {"Light": [], "Moderate": [], "Heavy": []}
    all_features = {"rms": [], "peak_amplitude": [], "spectral_energy": [], "dominant_frequency": []}
    
    for f in files:
        filepath = os.path.join(dataset_dir, f)
        label = None
        if f.startswith("Light"): label = "Light"
        elif f.startswith("Moderate"): label = "Moderate"
        elif f.startswith("Heavy"): label = "Heavy"
        
        if label:
            print(f"Processing {f} as {label}...")
            feats, _, _ = process_audio(filepath)
            features_by_class[label].append(feats)
            for k, v in feats.items():
                all_features[k].append(v)
                
    if not all(len(all_features[k]) > 0 for k in all_features):
        print("Not enough labeled files to calibrate.")
        return

    # Calculate calibration ranges
    calib_data = {}
    for feature_name, values in all_features.items():
        calib_data[feature_name] = {
            "min": float(min(values)),
            "max": float(max(values))
        }
    
    # Estimate scores for the calibration set to find thresholds
    # We will temporarily use the calculated min/max to normalize
    scores = {"Light": [], "Moderate": [], "Heavy": []}
    for label, feats_list in features_by_class.items():
        for feats in feats_list:
            norm_f = normalize_features(feats, calib_data)
            s = calculate_score(norm_f)
            scores[label].append(s)
            
    # Simple threshold logic based on max scores
    # Fallback to defaults if a class is missing
    light_max = max(scores["Light"]) if scores["Light"] else LIGHT_MAX_SCORE
    mod_max = max(scores["Moderate"]) if scores["Moderate"] else MODERATE_MAX_SCORE
    heavy_min = min(scores["Heavy"]) if scores["Heavy"] else mod_max + 1
    
    # Adjust boundaries slightly to separate classes
    calib_data["thresholds"] = {
        "light_max": light_max + 1.0 if scores["Light"] else LIGHT_MAX_SCORE,
        "moderate_max": max(mod_max + 1.0, light_max + 5.0) if scores["Moderate"] else MODERATE_MAX_SCORE
    }
    
    with open(CALIBRATION_FILE, "w") as f:
        json.dump(calib_data, f, indent=4)
        
    print("Calibration successful. Saved to", CALIBRATION_FILE)
    print("Calibration data:", json.dumps(calib_data, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--calibrate", action="store_true", help="Run offline calibration on dataset.")
    parser.add_argument("--dataset-dir", type=str, default="../dataset", help="Path to dataset directory.")
    args = parser.parse_args()
    
    if args.calibrate:
        run_calibration(args.dataset_dir)
    else:
        print("Run with --calibrate to generate calibration parameters.")
