# WoundWatch

AI-assisted, mobile-first clinical copilot for wound documentation and prevention.

## Overview
WoundWatch is a clinician-facing “photo-to-note” web application designed to support structured wound documentation and prevention workflows. It combines image analysis and risk inputs to generate draft clinical notes and prevention checklists, while keeping clinicians fully in control.

The system supports longitudinal tracking across patients, wounds, and encounters, and explicitly separates AI-estimated values from clinician-entered data.

## Problem
Pressure injuries are common, preventable, costly, and often under-documented. Early-stage identification is particularly difficult across different skin tones, making consistent documentation and prevention challenging in real-world care settings.

## Solution
WoundWatch supports a streamlined workflow:

`Upload -> Risk Form -> Analysis -> Review -> Export`

Core outputs:
- Structured nursing note draft  
- Non-diagnostic stage/concern suggestions with uncertainty handling  
- Prevention checklist linked to risk factors  

## Key Features
- Photo-to-note clinical documentation assistance  
- ROI (region-of-interest) localization with fallback handling  
- Structured separation of AI-estimated vs clinician-entered data  
- Editable and exportable outputs  
- Longitudinal wound tracking (patient → wound → encounter)  
- Retrieval-grounded, auditable workflow  

## System Design
- Mobile-first web application (Next.js + React + TypeScript)
- Modular pipeline: segmentation (ROI) → classification → generation
- Adapter-based architecture for swappable model components
- Deterministic fallback pipeline for full end-to-end execution

## Tech Stack
- Next.js 14 + React + TypeScript  
- Tailwind CSS  
- Python-compatible model adapters  
- Retrieval-augmented generation (RAG)  
- FAISS or Chroma  

## API
- `POST /api/upload`
- `POST /api/analyze-roi`
- `POST /api/classify`
- `POST /api/generate-checklist`
- `POST /api/generate-note`
- `POST /api/full-pipeline`

## Design Principles
- Human-in-the-loop  
- Non-diagnostic outputs  
- Clear uncertainty communication  
- Auditability and traceability  
- Bias-aware design  
- Conservative clinical framing  

## Hackathons
WoundWatch is being developed for:
- Harvard Health Systems Innovation Lab (HSIL) Hackathon 2026 (Top 22 teams, Dhaka Hub)  
- Gemma 4 Good Hackathon (Kaggle)  

Relevant links:
- https://www.kaggle.com/competitions/gemma-4-good-hackathon  
- https://hsph.harvard.edu/research/health-systems-innovation-lab/work/hsil-hackathon-2026-building-high-value-health-systems-leveraging-ai/  

## Disclaimer
WoundWatch is not a diagnostic tool. All outputs are draft suggestions intended for clinician review and must not replace professional medical judgment.

## Team
- Syed Naveed Mahmood  
- Tasfia Zaman  
- Diniya Tahrin Bhuiyan  

![WoundWatch banner](./assets/banner.jpg)
