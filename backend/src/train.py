import os
import re
import json
import joblib
import pandas as pd
import numpy as np
from tqdm import tqdm

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix, roc_auc_score

# Initialize NLP tools
lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))

def clean_text(text):
    if not isinstance(text, str):
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]*>', ' ', text)
    # Convert to lowercase
    text = text.lower()
    # Remove punctuation and special characters, keep letters and spaces
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    # Tokenize
    tokens = word_tokenize(text)
    # Remove stopwords, lemmatize, filter short words
    cleaned = [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words and len(word) > 2]
    return " ".join(cleaned)

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    
    data_path = os.path.join(backend_dir, "data", "fake_job_postings.csv")
    src_dir = current_dir
    static_dir = os.path.join(project_root, "frontend")
    os.makedirs(src_dir, exist_ok=True)
    os.makedirs(static_dir, exist_ok=True)
    
    print("Loading dataset...")
    df = pd.read_csv(data_path)
    
    print("Data Columns and Types:")
    print(df.dtypes)
    
    # 1. Fill missing text fields and combine
    print("\nCombining and cleaning text columns...")
    df['combined_text'] = (
        df['title'].fillna('') + " " +
        df['company_profile'].fillna('') + " " +
        df['description'].fillna('') + " " +
        df['requirements'].fillna('') + " " +
        df['benefits'].fillna('')
    )
    
    # Apply cleaning with progress bar
    tqdm.pandas(desc="Cleaning Text")
    df['cleaned_text'] = df['combined_text'].progress_apply(clean_text)
    
    # 2. Extract features and target
    X = df[['cleaned_text', 'telecommuting', 'has_company_logo', 'has_questions']]
    y = df['fraudulent']
    
    # 3. Train-Test Split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    print(f"\nTrain size: {len(X_train)}, Test size: {len(X_test)}")
    print(f"Train fraudulent ratio: {y_train.mean():.4f}")
    print(f"Test fraudulent ratio: {y_test.mean():.4f}")
    
    # 4. Define Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('text', TfidfVectorizer(max_features=10000, ngram_range=(1, 2)), 'cleaned_text'),
            ('meta', 'passthrough', ['telecommuting', 'has_company_logo', 'has_questions'])
        ]
    )
    
    # Models to evaluate
    models = {
        'Naive Bayes': MultinomialNB(),
        'Logistic Regression': LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42),
        'Random Forest': RandomForestClassifier(class_weight='balanced', n_estimators=100, random_state=42, n_jobs=-1)
    }
    
    results = {}
    best_f1 = 0
    best_model_name = None
    best_pipeline = None
    
    print("\nTraining and evaluating models...")
    for name, model in models.items():
        print(f"\n--- {name} ---")
        pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('classifier', model)
        ])
        
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        
        # Calculate metrics
        acc = accuracy_score(y_test, y_pred)
        f1_fraud = f1_score(y_test, y_pred, pos_label=1)
        f1_macro = f1_score(y_test, y_pred, average='macro')
        report = classification_report(y_test, y_pred, output_dict=True)
        cm = confusion_matrix(y_test, y_pred).tolist()
        
        try:
            y_prob = pipeline.predict_proba(X_test)[:, 1]
            auc = roc_auc_score(y_test, y_prob)
        except Exception:
            auc = 0.0
            
        print(f"Accuracy: {acc:.4f}")
        print(f"F1-Score (Fraudulent): {f1_fraud:.4f}")
        print(f"F1-Score (Macro): {f1_macro:.4f}")
        print(f"ROC-AUC: {auc:.4f}")
        
        results[name] = {
            'accuracy': acc,
            'f1_fraud': f1_fraud,
            'f1_macro': f1_macro,
            'roc_auc': auc,
            'confusion_matrix': cm,
            'classification_report': report
        }
        
        # We want to select the model with the best F1-Score for Fraudulent class (pos_label=1), 
        # since detection of fraudulent postings is the primary target and dataset is highly imbalanced.
        if f1_fraud > best_f1:
            best_f1 = f1_fraud
            best_model_name = name
            best_pipeline = pipeline

    print(f"\nBest model selected: {best_model_name} with Fraud F1-Score of {best_f1:.4f}")
    
    # Save the best pipeline
    model_dest = os.path.join(src_dir, "model.joblib")
    print(f"Saving best pipeline to {model_dest}...")
    joblib.dump(best_pipeline, model_dest)
    
    # 5. Extract explainability coefficients
    # We will train a logistic regression model specifically to extract word coefficients for explanation, 
    # as it represents linear contributions of words directly, making it perfect for UI word highlighting.
    print("\nExtracting feature importances/coefficients for explainability...")
    lr_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42))
    ])
    lr_pipeline.fit(X_train, y_train)
    
    # Extract feature names
    vec = lr_pipeline.named_steps['preprocessor'].named_transformers_['text']
    feature_names = list(vec.get_feature_names_out())
    # Add metadata features at the end
    feature_names.extend(['meta_telecommuting', 'meta_has_company_logo', 'meta_has_questions'])
    
    # Get coefficients
    coefs = lr_pipeline.named_steps['classifier'].coef_[0]
    
    # Map features to coefficients
    feature_coefs = dict(zip(feature_names, coefs))
    
    # Sort to find most suspicious words (highest positive coefficients)
    sorted_features = sorted(feature_coefs.items(), key=lambda x: x[1], reverse=True)
    
    suspicious_words = [word for word, score in sorted_features if score > 0 and not word.startswith('meta_')][:100]
    genuine_words = [word for word, score in sorted_features if score < 0 and not word.startswith('meta_')][-100:]
    
    # Prepare word weights file for frontend keyword matching
    explain_data = {
        'suspicious_words': {word: float(score) for word, score in sorted_features[:500] if score > 0 and not word.startswith('meta_')},
        'genuine_words': {word: float(score) for word, score in sorted_features[-500:] if score < 0 and not word.startswith('meta_')},
        'meta_weights': {
            'telecommuting': float(feature_coefs.get('meta_telecommuting', 0)),
            'has_company_logo': float(feature_coefs.get('meta_has_company_logo', 0)),
            'has_questions': float(feature_coefs.get('meta_has_questions', 0))
        }
    }
    
    explain_dest = os.path.join(src_dir, "explain_weights.joblib")
    joblib.dump(explain_data, explain_dest)
    print("Explainability weights saved to", explain_dest)
    
    # Save a JSON file with stats for frontend dashboard rendering
    print("\nComputing dataset statistics for frontend dashboard...")
    total_postings = len(df)
    total_fake = int(df['fraudulent'].sum())
    total_real = total_postings - total_fake
    
    # Grouping calculations for charts
    logo_stats = df.groupby('has_company_logo')['fraudulent'].mean().to_dict()
    logo_data = {
        'with_logo_fake_rate': float(logo_stats.get(1, 0)),
        'without_logo_fake_rate': float(logo_stats.get(0, 0))
    }
    
    questions_stats = df.groupby('has_questions')['fraudulent'].mean().to_dict()
    questions_data = {
        'with_questions_fake_rate': float(questions_stats.get(1, 0)),
        'without_questions_fake_rate': float(questions_stats.get(0, 0))
    }
    
    telecommuting_stats = df.groupby('telecommuting')['fraudulent'].mean().to_dict()
    telecommuting_data = {
        'remote_fake_rate': float(telecommuting_stats.get(1, 0)),
        'onsite_fake_rate': float(telecommuting_stats.get(0, 0))
    }
    
    # Top 5 industries for fake jobs
    top_fake_industries = df[df['fraudulent'] == 1]['industry'].value_counts().head(5).to_dict()
    # Top 5 functions for fake jobs
    top_fake_functions = df[df['fraudulent'] == 1]['function'].value_counts().head(5).to_dict()
    
    dashboard_stats = {
        'summary': {
            'total_postings': total_postings,
            'real_count': total_real,
            'fake_count': total_fake,
            'fake_percentage': float(total_fake / total_postings * 100)
        },
        'metadata_impacts': {
            'logo_impact': logo_data,
            'questions_impact': questions_data,
            'telecommuting_impact': telecommuting_data
        },
        'top_fake_industries': top_fake_industries,
        'top_fake_functions': top_fake_functions,
        'model_comparison': results,
        'best_model_name': best_model_name,
        'top_suspicious_words': [word for word, score in sorted_features if not word.startswith('meta_')][:20],
        'top_genuine_words': [word for word, score in reversed(sorted_features) if not word.startswith('meta_')][:20]
    }
    
    stats_json_path = os.path.join(static_dir, "data_stats.json")
    with open(stats_json_path, 'w') as f:
        json.dump(dashboard_stats, f, indent=4)
    print("Dashboard statistics saved to", stats_json_path)

if __name__ == "__main__":
    main()
