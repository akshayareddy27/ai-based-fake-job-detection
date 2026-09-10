import os
import re
import json
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATIC_DIR = os.path.join(PROJECT_ROOT, "frontend")
SRC_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize FastAPI app
app = FastAPI(title="Fake Job Posting Detection System API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load NLP resources
lemmatizer = WordNetLemmatizer()
try:
    stop_words = set(stopwords.words('english'))
except Exception:
    nltk.download('stopwords')
    stop_words = set(stopwords.words('english'))

def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = re.sub(r'<[^>]*>', ' ', text)
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    try:
        tokens = word_tokenize(text)
    except Exception:
        nltk.download('punkt')
        nltk.download('punkt_tab')
        tokens = word_tokenize(text)
    cleaned = [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words and len(word) > 2]
    return " ".join(cleaned)

# Pydantic input schema
class JobPostingInput(BaseModel):
    title: str
    company_profile: str
    description: str
    requirements: str
    benefits: str
    telecommuting: bool
    has_company_logo: bool
    has_questions: bool

# Load models at startup
model = None
explain_data = None

@app.on_event("startup")
def load_models():
    global model, explain_data
    model_path = os.path.join(SRC_DIR, "model.joblib")
    explain_path = os.path.join(SRC_DIR, "explain_weights.joblib")
    
    if not os.path.exists(model_path):
        raise RuntimeError(f"Model file not found at {model_path}. Please run train.py first.")
    if not os.path.exists(explain_path):
        raise RuntimeError(f"Explain weights file not found at {explain_path}. Please run train.py first.")
        
    print("Loading ML model...")
    model = joblib.load(model_path)
    print("Loading explainability weights...")
    explain_data = joblib.load(explain_path)
    print("All models loaded successfully!")

@app.post("/api/predict")
async def predict_job(job: JobPostingInput):
    if model is None or explain_data is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")
        
    try:
        # 1. Combine and clean text
        combined_text = (
            f"{job.title} {job.company_profile} {job.description} {job.requirements} {job.benefits}"
        )
        cleaned = clean_text(combined_text)
        
        # 2. Prepare prediction input
        input_data = pd.DataFrame([{
            'cleaned_text': cleaned,
            'telecommuting': int(job.telecommuting),
            'has_company_logo': int(job.has_company_logo),
            'has_questions': int(job.has_questions)
        }])
        
        # 3. Classify and get probability
        prediction = int(model.predict(input_data)[0])
        probabilities = model.predict_proba(input_data)[0]
        
        # The probability of being fraudulent
        fraud_probability = float(probabilities[1])
        
        # 4. Generate local explainability (highlight weights for words in the input)
        # Split original combined text into raw words to match and score them
        raw_words = re.findall(r'[a-zA-Z]+', combined_text.lower())
        
        matched_words = {}
        for rw in raw_words:
            # Lemmatize to match with feature keys
            lemma = lemmatizer.lemmatize(rw)
            if lemma in explain_data['suspicious_words']:
                matched_words[rw] = {
                    'lemma': lemma,
                    'score': float(explain_data['suspicious_words'][lemma]),
                    'type': 'suspicious'
                }
            elif lemma in explain_data['genuine_words']:
                # The score in genuine_words is negative
                matched_words[rw] = {
                    'lemma': lemma,
                    'score': float(explain_data['genuine_words'][lemma]),
                    'type': 'genuine'
                }
                
        # Limit to unique matching words to send to client
        unique_matches = []
        for word, info in matched_words.items():
            unique_matches.append({
                'word': word,
                'lemma': info['lemma'],
                'score': info['score'],
                'type': info['type']
            })
            
        # Sort matched words by absolute score
        unique_matches = sorted(unique_matches, key=lambda x: abs(x['score']), reverse=True)
        
        # Determine risk level
        if fraud_probability < 0.25:
            risk_level = "Low"
        elif fraud_probability < 0.60:
            risk_level = "Medium"
        else:
            risk_level = "High"
            
        # Predict result
        return {
            'is_fraudulent': prediction,
            'fraud_probability': fraud_probability,
            'risk_level': risk_level,
            'matched_words': unique_matches[:100]  # Return top 100 explanatory words
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/api/stats")
async def get_stats():
    stats_path = os.path.join(STATIC_DIR, "data_stats.json")
    if not os.path.exists(stats_path):
        raise HTTPException(status_code=404, detail="Stats file not found.")
    try:
        with open(stats_path, 'r') as f:
            stats = json.load(f)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read stats: {str(e)}")

# Serve frontend index.html at root
@app.get("/")
async def read_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
         return {"message": "Welcome to Fake Job Posting Detection API. Static files are not built yet."}
    return FileResponse(index_path)

# Serve all static files (JS, CSS, images) from the static folder
app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
