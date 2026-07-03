const { GoogleGenAI } = require('@google/genai');

/**
 * Extracts ALL dive log entries from an image buffer using Google Gemini API.
 * A single photo may contain multiple dive log entries (e.g. 2 per page, 2 pages = 4 dives).
 *
 * @param {Buffer} imageBuffer - The binary image buffer.
 * @param {string} mimeType - The MIME type of the image.
 * @returns {Promise<Array<Object>>} Array of parsed dive log objects (1 or more).
 */
async function extractDiveLog(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const ai = new GoogleGenAI({ apiKey });

  const diveEntrySchema = {
    type: 'OBJECT',
    properties: {
      tauchgang_nr: { type: 'INTEGER', description: 'Dive number (Nr./No. field). Null if not filled in.' },
      ort: { type: 'STRING', description: 'Dive location/site name (Ort/Place/Lugar/Lieu field).' },
      datum: { type: 'STRING', description: 'Date of the dive in YYYY-MM-DD format (Datum/Date field).' },
      sicht: { type: 'STRING', description: 'Visibility (Sicht/Visibility field), e.g. "20m". Null if not filled.' },
      gewicht_kg: { type: 'NUMBER', description: 'Weight used in kilograms (Gewicht/Weight field). MUST be null if the field is empty. Do NOT copy the temperature value into this field!' },
      dauer_min: { type: 'INTEGER', description: 'Duration of the dive in minutes (Dauer/Duration field). Null if not filled.' },
      tiefe_m: { type: 'NUMBER', description: 'Maximum depth in meters (Tiefe/Depth/Profundidad field). Null if not filled.' },
      temperatur_c: { type: 'INTEGER', description: 'Water temperature in Celsius (Temperatur/Temperature field). Null if not filled.' },
      stroemung: { type: 'STRING', description: 'Current strength/details (Strömung/Current field). Null if not filled.' },
      unterschrift_partner: { type: 'STRING', description: 'Buddy name or signature text (Unterschrift des Partners field). Null if not filled.' },
      bemerkungen: { type: 'STRING', description: 'General notes, description, sightings (e.g. fishes, wrecks, events). Do NOT put these in the buddy signature field.' },
      stempel: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'Text from any stamps or seals visible on this dive entry. Empty array if none.'
      }
    },
    required: ['ort', 'datum']
  };

  const schema = {
    type: 'OBJECT',
    properties: {
      dives: {
        type: 'ARRAY',
        items: diveEntrySchema,
        description: 'All dive log entries found in the image, in top-to-bottom, left-to-right order.'
      }
    },
    required: ['dives']
  };

  const prompt = [
    'This image shows one or more physical dive log pages (Tauchprotokoll / Dive-log).',
    'Each page may contain UP TO 2 separate dive log entries stacked vertically.',
    'If 2 pages are visible side by side, each page may have 2 entries = up to 4 total.',
    '',
    'INSTRUCTIONS:',
    '- Identify and extract EVERY individual dive log entry visible in the image.',
    '- STRICTLY SEPARATE DATA: Each dive log entry is contained in its own visual box/boundary. NEVER mix data (like buddy signatures or stamps) from Dive 2 into the data for Dive 1.',
    '- Each entry has its own: Ort (location), Datum (date), Nr. (dive number), Dauer (duration), Tiefe (depth), Temperatur, Gewicht, Sicht, Strömung, buddy signature, and stamps.',
    '- Read handwritten text carefully.',
    '- Return dates in YYYY-MM-DD format (e.g. "10.6.26" → "2026-06-10").',
    '',
    'SICHT (Visibility):',
    '- The form uses 3 face icon checkboxes for visibility. Look VERY closely for pen marks (cross, line, dot) near or inside the faces:',
    '  * Happy/laughing face (Lachengesicht) marked = return "gut"',
    '  * Neutral/bar face (Mondgesicht/Balkengesicht) marked = return "mässig"',
    '  * Sad/frowning face (Traurigesgesicht) marked = return "schlecht"',
    '- IMPORTANT: strictly return only "gut", "mässig", or "schlecht".',
    '- If no face is marked at all, return null.',
    '',
    'STRÖMUNG (Current):',
    '- If the field is blank / nothing written / no checkbox checked, return "keine".',
    '- Only return null if the field is completely illegible.',
    '',
    'OTHER FIELDS:',
    '- For fields that are empty, unwritten, or illegible, you MUST return null (except Strömung as noted above).',
    '- NEVER return the number 0 for an empty field. Empty means null.',
    '- WARNING: The "Temperatur" and "Gewicht" fields are close to each other. You frequently copy the temperature into the weight field by mistake when weight is empty. Look STRICTLY at the "Gewicht" box. If there is NO ink inside the "Gewicht" box, you MUST return null for gewicht_kg.',
    '- DO NOT hallucinate values. Do not use placeholder values like 0, 8, or -99.',
    '- If "Buddy/Unterschrift" is empty, return null. Do not guess names.',
    '- If there are general notes about the dive like "Grosse Eglis + Hecht", put them in the "bemerkungen" field, NOT in the buddy signature field.',
    '- Include ALL stamp/seal text found in the stempel array for each entry.',
    '- Return the entries in reading order: top-left first, then bottom-left, then top-right, then bottom-right.'
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  });

  if (!response || !response.text) {
    throw new Error('Invalid response from Gemini API');
  }

  const parsed = JSON.parse(response.text);

  let result = [];
  // Normalize: always return an array
  if (Array.isArray(parsed)) result = parsed;
  else if (parsed && Array.isArray(parsed.dives)) result = parsed.dives;
  // Fallback: single object wrapped in array
  else if (parsed && typeof parsed === 'object' && parsed.ort) result = [parsed];
  else throw new Error('Gemini returned an unexpected structure: ' + JSON.stringify(parsed).slice(0, 200));

  // Post-processing to fix stubborn AI hallucinations
  return result.map(dive => {
    // The AI frequently copies the temperature into the weight field due to their proximity.
    // If they are exactly equal, it is 99% a hallucination. Clear it.
    if (dive.gewicht_kg !== null && dive.gewicht_kg !== undefined && dive.gewicht_kg === dive.temperatur_c) {
      dive.gewicht_kg = null;
    }
    return dive;
  });
}

module.exports = { extractDiveLog };
