# Original User Request

## Initial Request — 2026-06-21T20:41:57Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

A full-stack Angular and Node.js application that digitizes physical dive logbooks. Users can upload photos of logbook pages, the backend uses the Gemini API to extract dive data into a structured format, allows manual corrections in the frontend, and saves the entries to a database.

Working directory: /home/daniel/IdeaProjects/digital-dive-log
Integrity mode: development

## Requirements

### R1. Backend API & AI Integration
Build a Node.js/Express backend using SQLite for local development. It must provide an endpoint to upload images, process them using the real Gemini Vision API (using `GEMINI_API_KEY` from `.env`), and extract the data to match this JSON structure: 
`{"tauchgang_nr": 527, "ort": "...", "datum": "...", "sicht": "...", "gewicht_kg": null, "dauer_min": 60, "tiefe_m": 22, "temperatur_c": null, "stroemung": null, "unterschrift_partner": "...", "stempel": ["..."]}`. 
The validated data must then be stored in the database.

### R2. Frontend Web App
Build an Angular frontend that provides:
1. An upload view to select/capture and upload a dive log photo.
2. A verification view displaying a form with the AI-extracted data, allowing the user to correct any misread fields before final submission.
3. A list view displaying all previously saved dives from the database.

## Acceptance Criteria

### API & AI Extraction
- [ ] The backend starts successfully on a defined port without crashing.
- [ ] A sample test script can send an image to the backend endpoint and receives a valid JSON response containing the required fields.
- [ ] Database migrations/setup scripts correctly initialize the SQLite database with the `dives` table.

### Frontend Functionality
- [ ] The Angular application compiles successfully without errors (`ng build`).
- [ ] The frontend communicates with the backend API endpoints.
