export default async function handler(req, res) {
  // CORS pour permettre les appels depuis le navigateur
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Clé API stockée dans Vercel Environment Variables — jamais visible par l'utilisateur
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée sur le serveur.' });
  }

  const { text, lang } = req.body || {};

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Texte trop court.' });
  }

  const langInstruction =
    lang === 'fr' ? 'Réponds entièrement en FRANÇAIS.' :
    lang === 'pt' ? 'Responde completamente em PORTUGUÊS.' :
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
        system: systemPrompt,
        messages: [{ role: 'user', content: `Journal entry:\n---\n${text}\n---\nJSON only.` }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Erreur Claude API'
      });
    }

    const rawText = data.content?.[0]?.text || '';
    const clean = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const analysis = JSON.parse(clean);

    return res.status(200).json({ analysis });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
  }
      
