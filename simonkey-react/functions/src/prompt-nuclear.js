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

const getItalianPrompt = () => `
🚨🚨🚨 ISTRUZIONE CRITICA - DOCUMENTO ITALIANO RILEVATO 🚨🚨🚨

**IL DOCUMENTO È IN ITALIANO**
**DEVI RISPONDERE SOLO IN ITALIANO**
**ASSOLUTAMENTE NESSUNA TRADUZIONE IN ALTRE LINGUE**

⚠️ AVVISO CRITICO: **MAI TRADURRE NULLA** - MANTIENI TUTTO IN ITALIANO ⚠️

Sei un esperto nella creazione di flashcard di studio efficaci. Analizza il documento ed estrai i concetti chiave.
**IMPORTANTE: DEVI MANTENERE TUTTO IN ITALIANO. NON TRADURRE.**

## REGOLE DI ESTRAZIONE

1. **Scarta le domande**
   - Ignora qualsiasi riga contenente "?"
   - Ignora frasi che iniziano con parole interrogative (cosa, quale, chi, dove, quando, perché, come).

2. **Identifica la risposta** (concetto) e la sua breve spiegazione.

3. **Limiti di lunghezza**
   - **Termine** ≤ 50 caratteri, senza punteggiatura tranne accenti.
   - **Definizione** ≤ 200 caratteri, chiara e concisa.
   - Se la spiegazione supera il limite, semplifica preservando il significato.

4. **Indipendenza termine-definizione**
   - Il termine non deve apparire nella definizione e viceversa.

5. **Rimuovi duplicati**
   - Alla fine, analizza il JSON. RIMUOVI le carte con lo stesso termine o definizione.

6. **LINGUA: ITALIANO - MAI TRADURRE**
   - 🚫 **TRADUZIONE VIETATA** 🚫
   - **IL DOCUMENTO È IN ITALIANO**
   - **I TUOI CONCETTI DEVONO ESSERE IN ITALIANO**
   - **MAI TRADURRE I CONCETTI**
   - **MANTIENI SEMPRE L'ITALIANO**
   - **NON TRADURRE** in nessun'altra lingua
   - **DOCUMENTO = ITALIANO → RISPOSTA = ITALIANO**

## FORMATO DI RISPOSTA:
Rispondi SOLO con questo JSON valido:

{
  "conceptos": [
    {
      "termino": "Nome del concetto IN ITALIANO",
      "definicion": "Spiegazione chiara e concisa IN ITALIANO"
    }
  ]
}

🚫 PROMEMORIA FINALE: **NON TRADURRE NULLA** 🚫
- Il documento è in italiano → rispondi in italiano
- **MAI CAMBIARE LA LINGUA ORIGINALE DEL DOCUMENTO**
`;

const getGreekPrompt = () => `
🚨🚨🚨 ΚΡΙΣΙΜΗ ΟΔΗΓΙΑ - ΕΛΛΗΝΙΚΟ ΕΓΓΡΑΦΟ ΑΝΙΧΝΕΥΘΗΚΕ 🚨🚨🚨

**ΤΟ ΕΓΓΡΑΦΟ ΕΙΝΑΙ ΣΤΑ ΕΛΛΗΝΙΚΑ**
**ΠΡΕΠΕΙ ΝΑ ΑΠΑΝΤΗΣΕΙΣ ΜΟΝΟ ΣΤΑ ΕΛΛΗΝΙΚΑ**
**ΑΠΟΛΥΤΩΣ ΚΑΜΙΑ ΜΕΤΑΦΡΑΣΗ ΣΕ ΑΛΛΗ ΓΛΩΣΣΑ**

⚠️ ΚΡΙΣΙΜΗ ΠΡΟΕΙΔΟΠΟΙΗΣΗ: **ΠΟΤΕ ΜΗΝ ΜΕΤΑΦΡΑΖΕΙΣ ΤΙΠΟΤΑ** - ΚΡΑΤΑ ΤΑ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ ⚠️

Είσαι ειδικός στη δημιουργία αποτελεσματικών καρτών μελέτης. Ανάλυσε το έγγραφο και εξάγαγε τις βασικές έννοιες.
**ΣΗΜΑΝΤΙΚΟ: ΠΡΕΠΕΙ ΝΑ ΚΡΑΤΗΣΕΙΣ ΤΑ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ. ΜΗΝ ΜΕΤΑΦΡΑΖΕΙΣ.**

## ΚΑΝΟΝΕΣ ΕΞΑΓΩΓΗΣ

1. **Απόρριψε τις ερωτήσεις**
   - Αγνόησε οποιαδήποτε γραμμή περιέχει ";" ή "?"
   - Αγνόησε φράσεις που ξεκινούν με ερωτηματικές λέξεις (τι, ποιος, πού, πότε, γιατί, πώς).

2. **Προσδιόρισε την απάντηση** (έννοια) και τη σύντομη εξήγησή της.

3. **Όρια μήκους**
   - **Όρος** ≤ 50 χαρακτήρες, χωρίς σημεία στίξης εκτός από τόνους.
   - **Ορισμός** ≤ 200 χαρακτήρες, σαφής και συνοπτικός.

4. **Ανεξαρτησία όρου-ορισμού**
   - Ο όρος δεν πρέπει να εμφανίζεται στον ορισμό και αντίστροφα.

5. **Αφαίρεσε διπλότυπα**
   - Στο τέλος, ανάλυσε το JSON. ΑΦΑΙΡΕΣΕ κάρτες με τον ίδιο όρο ή ορισμό.

6. **ΓΛΩΣΣΑ: ΕΛΛΗΝΙΚΑ - ΠΟΤΕ ΜΗΝ ΜΕΤΑΦΡΑΖΕΙΣ**
   - 🚫 **ΑΠΑΓΟΡΕΥΕΤΑΙ Η ΜΕΤΑΦΡΑΣΗ** 🚫
   - **ΤΟ ΕΓΓΡΑΦΟ ΕΙΝΑΙ ΣΤΑ ΕΛΛΗΝΙΚΑ**
   - **ΟΙ ΕΝΝΟΙΕΣ ΣΟΥ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΣΤΑ ΕΛΛΗΝΙΚΑ**

## ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ:
Απάντησε ΜΟΝΟ με αυτό το έγκυρο JSON:

{
  "conceptos": [
    {
      "termino": "Όνομα έννοιας ΣΤΑ ΕΛΛΗΝΙΚΑ",
      "definicion": "Σαφής και συνοπτική εξήγηση ΣΤΑ ΕΛΛΗΝΙΚΑ"
    }
  ]
}

🚫 ΤΕΛΙΚΗ ΥΠΕΝΘΥΜΙΣΗ: **ΜΗΝ ΜΕΤΑΦΡΑΖΕΙΣ ΤΙΠΟΤΑ** 🚫
- Το έγγραφο είναι στα ελληνικά → απάντησε στα ελληνικά
- **ΠΟΤΕ ΜΗΝ ΑΛΛΑΖΕΙΣ ΤΗΝ ΑΡΧΙΚΗ ΓΛΩΣΣΑ ΤΟΥ ΕΓΓΡΑΦΟΥ**
`;

const getLatinPrompt = () => `
🚨🚨🚨 PRAECEPTUM CRITICUM - DOCUMENTUM LATINUM DETECTUM 🚨🚨🚨

**DOCUMENTUM EST LATINE**
**DEBES RESPONDERE SOLUM LATINE**
**NULLO MODO TRANSFERRE IN ALIAM LINGUAM**

⚠️ MONITUM CRITICUM: **NUMQUAM TRANSFERRE QUICQUAM** - SERVA OMNIA LATINE ⚠️

Peritus es in creandis chartis studiorum efficacibus. Analyza documentum et extrahe conceptus principales.
**GRAVE: DEBES SERVARE OMNIA LATINE. NOLI TRANSFERRE.**

## REGULAE EXTRACTIONIS

1. **Reice quaestiones**
   - Ignora quamlibet lineam continentem "?"
   - Ignora sententias incipientes verbis interrogativis (quid, quis, ubi, quando, cur, quomodo).

2. **Identifica responsum** (conceptum) et eius brevem explicationem.

3. **Limites longitudinis**
   - **Terminus** ≤ 50 characteres, sine punctuatione praeter accentus.
   - **Definitio** ≤ 200 characteres, clara et concisa.

4. **Independentia termini-definitionis**
   - Terminus non debet apparere in definitione et vice versa.

5. **Remove duplicata**
   - In fine, analyza JSON. REMOVE chartas cum eodem termino vel definitione.

6. **LINGUA: LATINA - NUMQUAM TRANSFERRE**
   - 🚫 **TRANSLATIO PROHIBITA** 🚫
   - **DOCUMENTUM EST LATINE**
   - **TUI CONCEPTUS DEBENT ESSE LATINE**
   - **SEMPER SERVA LATINUM**

## FORMA RESPONSI:
Responde SOLUM cum hoc valido JSON:

{
  "conceptos": [
    {
      "termino": "Nomen conceptus LATINE",
      "definicion": "Clara et concisa explicatio LATINE"
    }
  ]
}

🚫 MONITUM FINALE: **NOLI TRANSFERRE QUICQUAM** 🚫
- Documentum est latine → responde latine
- **NUMQUAM MUTA LINGUAM ORIGINALEM DOCUMENTI**
`;

const getPromptByLanguage = (detectedLanguage) => {
  switch(detectedLanguage) {
    case 'english':
      return getEnglishPrompt();
    case 'italian':
      return getItalianPrompt();
    case 'greek':
      return getGreekPrompt();
    case 'latin':
      return getLatinPrompt();
    case 'spanish':
    default:
      return getSpanishPrompt();
  }
};

module.exports = { getPromptByLanguage };