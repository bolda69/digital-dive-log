# Project: Digital Dive Log

## Architecture
This is a full-stack web application for digitizing physical dive logbooks.

```
                  +-----------------------------------+
                  |          Angular Frontend         |
                  +-----------------+-----------------+
                                    |
            HTTP Requests           |   File Upload (Images)
            JSON Payloads           |   JSON API Interactions
                                    v
                  +-----------------+-----------------+
                  |      Node.js / Express Backend    |
                  +--------+-----------------+--------+
                           |                 |
                SQL        |                 |  AI Vision requests
                Queries    v                 v
                  +--------+---+     +-------+--------+
                  | SQLite DB  |     |   Gemini API   |
                  | (dives.db) |     |  (Gemini-1.5)  |
                  +------------+     +----------------+
```

### Components
1. **Frontend (Angular)**:
   - **Upload Component**: Selects/captures and uploads a photo of a physical dive log.
   - **Verification Component**: Form displaying extracted data, allowing manual edits before submitting.
   - **List Component**: Displays previously recorded dives.
   - **Dive Service**: Handles communication with the backend API.
2. **Backend (Node.js/Express)**:
   - **Express Server**: Exposes API endpoints.
   - **AI Extraction Service**: Handles interaction with Gemini Vision API using `GEMINI_API_KEY` for optical character recognition and parsing.
   - **Database Module**: Handles SQLite database migrations, setup, and queries (inserts, retrievals).
3. **Database (SQLite)**:
   - Single table `dives` to store structured dive log records.

## Code Layout
```
digital-dive-log/
├── backend/
│   ├── src/
│   │   ├── server.js       # Backend entry point
│   │   ├── app.js          # Express app setup
│   │   ├── db.js           # Database initialization and queries
│   │   ├── routes.js       # API route handlers
│   │   └── gemini.js       # Gemini API communication
│   ├── .env.example        # Environment variable template
│   ├── package.json        # Backend dependencies and scripts
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── upload/         # Upload view
│   │   │   │   ├── verification/   # Form editing view
│   │   │   │   └── list/           # Historical list view
│   │   │   ├── services/
│   │   │   │   └── dive.service.ts # HTTP API client
│   │   │   ├── app.component.ts
│   │   │   ├── app.module.ts
│   │   │   └── app-routing.module.ts
│   ├── angular.json
│   ├── package.json        # Frontend dependencies and scripts
│   └── README.md
├── package.json            # Monorepo/Root helper scripts
└── PROJECT.md              # Project plan and specifications
```

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Comprehensive E2E test suite (Tiers 1-4) | None | DONE (Conv: 0e749e1d-add7-40d2-935f-8d7089d825ce, Output: /home/daniel/IdeaProjects/digital-dive-log/e2e/api.spec.js) |
| 2 | Backend Foundation & DB | Project layout, SQLite database configuration, schema migrations | None | DONE (Conv: 6b8bb970-c994-4ec7-be84-1dd9a95c1a39, Output: backend/src/db.js) |
| 3 | Backend API Endpoints | Implementation of REST APIs for CRUD operations on dives | M2 | DONE (Conv: 0b267b6c-71cb-413c-8c1d-8f92342579c6, Output: backend/src/routes.js) |
| 4 | AI Gemini Integration | Image upload, Gemini API integration, JSON extraction validation | M3 | DONE (Conv: 0b267b6c-71cb-413c-8c1d-8f92342579c6, Output: backend/src/gemini.js) |
| 5 | Frontend Core & Services | Angular project structure, routing, HTTP dive service integration | None | DONE (Conv: a11adf0b-33fd-4b61-9c37-c4734d76c132, Output: frontend/src/app/services/dive.service.ts) |
| 6 | Frontend View Components | Implementation of Upload, Verification, and List views | M5, M4 | DONE (Conv: d1ef3f84-4113-4802-95a4-31386e015a5b, Output: frontend/src/app/components/) |
| 7 | Full-Stack Integration & QA | Verification against E2E test suite and adversarial coverage hardening | M1, M6 | DONE (Conv: d1ef3f84-4113-4802-95a4-31386e015a5b, 38/38 E2E tests passed) |

## Interface Contracts

### Backend REST API

#### 1. Upload Dive Log Image
- **Endpoint**: `POST /api/upload`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `image`: File (dive log image)
- **Response**: `200 OK`
  - **Body**:
    ```json
    {
      "tauchgang_nr": 527,
      "ort": "Dahab Blue Hole",
      "datum": "2026-06-20",
      "sicht": "20m",
      "gewicht_kg": 8.0,
      "dauer_min": 45,
      "tiefe_m": 28.5,
      "temperatur_c": 24,
      "stroemung": "mild",
      "unterschrift_partner": "John Doe",
      "stempel": ["Scuba Club Dahab", "2026-06-20"]
    }
    ```
- **Error Response**: `400 Bad Request` or `500 Internal Server Error`
  - **Body**: `{"error": "string"}`

#### 2. Get All Dives
- **Endpoint**: `GET /api/dives`
- **Response**: `200 OK`
  - **Body**:
    ```json
    [
      {
        "id": 1,
        "tauchgang_nr": 527,
        "ort": "Dahab Blue Hole",
        "datum": "2026-06-20",
        "sicht": "20m",
        "gewicht_kg": 8.0,
        "dauer_min": 45,
        "tiefe_m": 28.5,
        "temperatur_c": 24,
        "stroemung": "mild",
        "unterschrift_partner": "John Doe",
        "stempel": ["Scuba Club Dahab", "2026-06-20"],
        "created_at": "2026-06-21T20:42:00Z"
      }
    ]
    ```

#### 3. Save Verified Dive
- **Endpoint**: `POST /api/dives`
- **Content-Type**: `application/json`
- **Request Body**: (Same format as the Gemini response layout)
  ```json
  {
    "tauchgang_nr": 527,
    "ort": "Dahab Blue Hole",
    "datum": "2026-06-20",
    "sicht": "20m",
    "gewicht_kg": 8.0,
    "dauer_min": 45,
    "tiefe_m": 28.5,
    "temperatur_c": 24,
    "stroemung": "mild",
    "unterschrift_partner": "John Doe",
    "stempel": ["Scuba Club Dahab", "2026-06-20"]
  }
  ```
- **Response**: `201 Created`
  - **Body**: (The inserted dive including `id` and `created_at`)

### Gemini Extraction Instruction
- Model: `gemini-1.5-flash` or similar vision-capable model.
- Prompt details: Must instruct the model to return exactly a JSON object mapping to the requested schema. Nulls are allowed for missing data. Array representation for `stempel` (stamps).
