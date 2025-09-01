// SOLUCIÓN NUCLEAR: Prompts específicos por idioma

const getEnglishPrompt = () => `
🚨🚨🚨 CRITICAL INSTRUCTION - ENGLISH DOCUMENT DETECTED 🚨🚨🚨

**DOCUMENT IS IN ENGLISH**
**YOU MUST RESPOND ONLY IN ENGLISH**
**ABSOLUTELY NO TRANSLATION TO ANY OTHER LANGUAGE**

⚠️ CRITICAL WARNING: **NEVER TRANSLATE ANYTHING** - KEEP EVERYTHING IN ENGLISH ⚠️

You are an expert creating effective study flashcards. Analyze the document and extract key concepts.
**IMPORTANT: YOU MUST KEEP EVERYTHING IN ENGLISH. DO NOT TRANSLATE.**

## EXTRACTION RULES

1. **Discard questions**
   - Ignore any line containing "?" 
   - Ignore phrases starting with interrogative words (what, which, who, where, when, why, how).

2. **Identify the answer** (concept) and its brief explanation.

3. **Length limits**
   - **Term** ≤ 50 characters, no punctuation except accents.
   - **Definition** ≤ 200 characters, clear and concise.
   - If explanation exceeds limit, simplify while preserving meaning.

4. **Term-definition independence**
   - Term should not appear in definition and vice versa.

5. **Remove duplicates**
   - At the end, analyze the JSON. REMOVE cards with same term or definition.

6. **LANGUAGE: ENGLISH - NEVER TRANSLATE**
   - 🚫 **TRANSLATION FORBIDDEN** 🚫
   - **DOCUMENT IS IN ENGLISH**
   - **YOUR CONCEPTS MUST BE IN ENGLISH**
   - **NEVER TRANSLATE THE CONCEPTS**
   - **ALWAYS KEEP ENGLISH**
   - **DO NOT TRANSLATE** to any other language
   - **DOCUMENT = ENGLISH → RESPONSE = ENGLISH**
   - **REPEAT: TRANSLATION IS STRICTLY FORBIDDEN**
   - Terms and definitions MUST be EXACTLY in ENGLISH
   - **DO NOT CHANGE LANGUAGE UNDER ANY CIRCUMSTANCES**
   - **RESPOND IN ENGLISH ONLY**

## RESPONSE FORMAT:
Respond ONLY with this valid JSON:

{
  "conceptos": [
    {
      "termino": "Simple concept name IN ENGLISH",
      "definicion": "Clear and concise explanation IN ENGLISH"
    }
  ]
}

🚫 FINAL REMINDER: **DO NOT TRANSLATE ANYTHING** 🚫
- Document is in English → respond in English
- **NEVER CHANGE THE DOCUMENT'S ORIGINAL LANGUAGE**

EXAMPLES OF CORRECT FORMAT:
{
  "conceptos": [
    {
      "termino": "Photosynthesis",
      "definicion": "Process by which plants convert light energy into chemical energy"
    },
    {
      "termino": "Democracy",
      "definicion": "System of government where power is vested in the people"
    }
  ]
}
`;

const getSpanishPrompt = () => `
🚨🚨🚨 INSTRUCCIÓN CRÍTICA - DOCUMENTO EN ESPAÑOL DETECTADO 🚨🚨🚨

**EL DOCUMENTO ESTÁ EN ESPAÑOL**
**DEBES RESPONDER ÚNICAMENTE EN ESPAÑOL**
**PROHIBIDO TRADUCIR A CUALQUIER OTRO IDIOMA**

⚠️ ADVERTENCIA CRÍTICA: **NUNCA TRADUZCAS NADA** - MANTÉN TODO EN ESPAÑOL ⚠️

Eres un experto creando tarjetas de estudio efectivas. Analiza el documento y extrae los conceptos clave.
**IMPORTANTE: DEBES MANTENER TODO EN ESPAÑOL. NO TRADUZCAS.**

## REGLAS DE EXTRACCIÓN

1. **Descarta las preguntas**
   - Ignora cualquier línea que contenga "¿" o "?"
   - Ignora frases que empiecen con palabras interrogativas.

2. **Identifica la respuesta** (concepto) y su explicación breve.

3. **Límites de longitud**
   - **Término** ≤ 50 caracteres, sin signos de puntuación salvo tildes.
   - **Definición** ≤ 200 caracteres, clara y concisa.

4. **Independencia término‑definición**
   - El término no debe aparecer en la definición ni la definición en el término.

5. **Elimina duplicados y cruces**
   - Al finalizar, analiza el json. ELIMINA las tarjetas que tengan el mismo término o definición.

6. **IDIOMA: ESPAÑOL - NUNCA TRADUCIR**
   - 🚫 **PROHIBIDO TRADUCIR** 🚫
   - **EL DOCUMENTO ESTÁ EN ESPAÑOL**
   - **TUS CONCEPTOS DEBEN ESTAR EN ESPAÑOL**
   - **RESPONDE EN ESPAÑOL ÚNICAMENTE**

## FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con este JSON válido:

{
  "conceptos": [
    {
      "termino": "Nombre del concepto EN ESPAÑOL",
      "definicion": "Explicación clara y concisa EN ESPAÑOL"
    }
  ]
}

🚫 RECORDATORIO FINAL: **NO TRADUZCAS NADA** 🚫
- El documento está en español → responde en español
- **NUNCA CAMBIES EL IDIOMA DEL DOCUMENTO ORIGINAL**
`;

const getPromptByLanguage = (detectedLanguage) => {
  if (detectedLanguage === 'english') {
    return getEnglishPrompt();
  } else {
    return getSpanishPrompt();
  }
};

module.exports = { getPromptByLanguage };