export default async function handler(req, res) {
  // CORS pour le navigateur
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Méthode non autorisée' });

  // 🔹 DEBUG : vérifier le body reçu
  console.log('req.body:', req.body);
  console.log('type of req.body:', typeof req.body);

  const { text, lang } = req.body || {};

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Aucun texte reçu. Vérifie que tu envoies du JSON avec Content-Type: application/json.'
    });
  }

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Texte trop court.' });
  }

  const supportedLangs = ['fr', 'pt', 'en'];
  const language = supportedLangs.includes(lang) ? lang : 'en';
  const langInstruction =
    language === 'fr' ? 'Réponds entièrement en FRANÇAIS.' :
    language === 'pt' ? 'Responde completamente em PORTUGUÊS.' :
                        'Reply entirely in ENGLISH.';

  const systemPrompt = `You are a compassionate, empathetic, non-judgmental AI therapeutic journal coach.
${langInstruction}

Analyze the journal entry and return ONLY a valid JSON object with this exact structure:
{
  "mood": "Short label for the detected mood",
  "moodEmoji": "A single emoji representing the mood",
  "patterns": ["Pattern observed", "Second pattern if present"],
  "deepQuestions": ["Question 1", "Question 2", "Question 3"],
  "reframing": "A gentle positive reframing in 2-3 sentences.",
  "microAction": "One small concrete action for today."
}
NO text outside the JSON.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: 'Clé API non configurée sur le serveur.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3', // modèle standard recommandé
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Journal entry:\n---\n${text}\n---\nJSON only.` }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('Erreur API Anthropic:', data); // 🔹 debug complet dans les logs
      return res.status(response.status).json({
        success: false,
        error: "Erreur API Anthropic",
        details: data
      });
    }

    const rawText = data?.completion?.[0]?.content?.[0]?.text || data?.completion?.[0]?.text || '';

    if (!rawText) {
      return res.status(500).json({
        success: false,
        error: "Réponse vide du modèle",
        details: data
      });
    }

    const clean = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: "Erreur JSON.parse",
        rawResponse: rawText
      });
    }

    return res.status(200).json({ success: true, analysis });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur",
      message: err.message
    });
  }
      }
