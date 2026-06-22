const { GoogleGenAI } = require('@google/genai');

/**
 * Extracts dive log data from an image buffer using Google Gemini API.
 * 
 * @param {Buffer} imageBuffer - The binary image buffer.
 * @param {string} mimeType - The MIME type of the image.
 * @returns {Promise<Object>} The parsed JSON dive log object.
 */
async function extractDiveLog(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const ai = new GoogleGenAI({ apiKey });

  const schema = {
    type: 'OBJECT',
    properties: {
      tauchgang_nr: { type: 'INTEGER', description: 'Dive number' },
      ort: { type: 'STRING', description: 'Dive location/site name' },
      datum: { type: 'STRING', description: 'Date of the dive in YYYY-MM-DD format' },
      sicht: { type: 'STRING', description: 'Visibility, e.g. 20m' },
      gewicht_kg: { type: 'NUMBER', description: 'Weight used in kilograms' },
      dauer_min: { type: 'INTEGER', description: 'Duration of the dive in minutes' },
      tiefe_m: { type: 'NUMBER', description: 'Depth of the dive in meters' },
      temperatur_c: { type: 'INTEGER', description: 'Water temperature in Celsius' },
      stroemung: { type: 'STRING', description: 'Current details, e.g. mild' },
      unterschrift_partner: { type: 'STRING', description: 'Buddy/instructor signature or name' },
      stempel: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'Stamps or certifications visible on the page'
      }
    },
    required: ['ort', 'datum']
  };

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      },
      'Extract the dive log data from this image. Ensure to populate all fields according to the response schema.'
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  });

  if (!response || !response.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return JSON.parse(response.text);
}

module.exports = { extractDiveLog };
