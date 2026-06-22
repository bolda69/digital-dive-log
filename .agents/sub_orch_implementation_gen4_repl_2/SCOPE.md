# Scope: Implementation Track

## Architecture
- **Backend (Node.js/Express)**: Uses Express for server and routing. SQLite is used for database. Gemini API for AI extraction.
- **Frontend (Angular)**: Uses Angular for client application, DiveService to communicate with backend, and components for Upload, Verification, and List.
- **Data Flow**:
  - Upload: Frontend (image upload) -> Backend (/api/upload) -> Gemini API -> JSON response to Frontend.
  - Verification & Save: Frontend displays JSON -> User corrects -> Frontend POSTs JSON to Backend (/api/dives) -> DB (dives.db).
  - List: Frontend requests GET /api/dives -> Backend -> DB (dives.db) -> List Component.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | Backend Foundation & DB | SQLite DB configuration, migrations, app/server setup, basic health check | None | DONE |
| M3 | Backend API Endpoints | REST API for CRUD (GET /api/dives, POST /api/dives) | M2 | DONE |
| M4 | AI Gemini Integration | POST /api/upload endpoint, Gemini SDK setup, schema parsing and validation | M3 | DONE |
| M5 | Frontend Core & Services | Angular project structure, routing, HTTP service (DiveService) | None | IN_PROGRESS |
| M6 | Frontend View Components | Components for Upload, Verification, and List | M5, M4 | PLANNED |
| M7 | Full-Stack Integration & QA | Verification against E2E test suite (Phase 1) and Adversarial Coverage Hardening (Phase 2) | M1, M6 | PLANNED |

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
- **Request Body**:
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
