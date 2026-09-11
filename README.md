# AI-Based Fake Job Detection

A machine learning system for detecting potentially fraudulent job postings using natural language processing, metadata features, a FastAPI backend, and a web-based dashboard.

## Overview

This project analyzes job posting information and predicts whether a posting may be fraudulent.

The system combines:

- Natural language processing of job posting text
- TF-IDF text features
- Job-posting metadata features
- Machine learning classification
- A FastAPI prediction API
- A browser-based dashboard for interacting with the model

## Features

- Fraudulent job posting prediction
- Fraud probability and risk-level output
- Text preprocessing using NLTK
- TF-IDF feature extraction with unigram and bigram features
- Comparison of multiple machine learning classifiers
- Logistic-regression-based feature analysis for explainability
- Dataset statistics and model comparison dashboard
- FastAPI backend
- HTML, CSS, and JavaScript frontend

## Machine Learning Workflow

The training pipeline:

1. Loads the job-posting dataset.
2. Combines relevant text fields such as title, company profile, description, requirements, and benefits.
3. Cleans and tokenizes the text using NLTK.
4. Converts text into TF-IDF features.
5. Adds metadata features including telecommuting, company-logo availability, and screening questions.
6. Splits the data into training and test sets using a stratified split.
7. Trains and evaluates:
   - Naive Bayes
   - Logistic Regression
   - Random Forest
8. Compares the models using accuracy, fraud-class F1-score, macro F1-score, ROC-AUC, confusion matrix, and classification report.
9. Selects the best-performing pipeline based on fraud-class F1-score.
10. Saves the trained model and explainability data for use by the API.

## Project Structure

- `backend/`
  - `data/`
    - `fake_job_postings.csv`
  - `notebooks/`
    - `exploratory_data_analysis.ipynb`
    - `model_training.ipynb`
  - `src/`
    - `download_data.py`
    - `explain_weights.joblib`
    - `main.py`
    - `model.joblib`
    - `train.py`
- `frontend/`
  - `app.js`
  - `data_stats.json`
  - `index.html`
  - `styles.css`

## Technologies Used

- Python
- Pandas
- NumPy
- Scikit-learn
- NLTK
- FastAPI
- Uvicorn
- Joblib
- HTML
- CSS
- JavaScript

## Running the Project

The backend API is implemented using FastAPI.

The main application is located at `backend/src/main.py`.

The model training pipeline is located at `backend/src/train.py`.

The frontend files are located in `frontend/`.

Before running the project, make sure the required Python libraries and NLTK resources are available in your environment.

## Dataset

The project uses a fake job postings dataset.

The dataset download script references an external GitHub source:

https://raw.githubusercontent.com/abbylmm/fake_job_posting/main/data/fake_job_postings.csv

The dataset is included in the project for the current local setup.

## Disclaimer

This project is intended for educational and demonstration purposes. Predictions should not be treated as definitive proof that a job posting is fraudulent. Model outputs depend on the training data, features, and model behavior.

## Project Status

This repository contains the current project implementation, including the machine learning pipeline, trained model artifacts, FastAPI backend, and web dashboard.
