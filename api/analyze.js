export default async function handler(req, res) {
  // CORS pour permettre les appels depuis le navigateur
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Méthode non autorisée' });

  // Clé API stockée dans Vercel Environment Variables — jamais visible côté client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: 'Clé API non configurée sur le serveur.' });

  const { text, lang } = req.body || {};

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Texte trop court.' });
  }

  // Vérification de la langue
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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Journal entry:\n---\n${text}\n---\nJSON only.` }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data?.error?.message || 'Erreur Claude API' });
    }

    // Extraction et nettoyage du JSON
    const rawText = data?.completion?.[0]?.content?.[0]?.text || data?.completion?.[0]?.text || '';
    const clean = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch (jsonErr) {
      return res.status(500).json({ success: false, error: 'Erreur lors du parsing du JSON renvoyé par Claude.' });
    }

    return res.status(200).json({ success: true, analysis });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erreur serveur' });
  }
}
