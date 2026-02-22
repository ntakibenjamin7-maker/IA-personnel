// api/analyze.js
// Cette fonction tourne côté serveur Vercel.
// Ta clé API n'est JAMAIS envoyée au navigateur.

export default async function handler(req, res) {
  // Seulement les POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ta clé API vient de la variable d'environnement Vercel (jamais visible par l'utilisateur)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const { text, lang } = req.body;

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text too short' });
  }

  const systemPrompt = buildSystemPrompt(lang || 'fr');

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
        messages: [
          {
            role: 'user',
            content: `Journal entry:\n\n---\n${text}\n---\n\nReply ONLY with a valid JSON object, no other text.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.error?.message || 'Claude API error',
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
    const clean = rawText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const analysis = JSON.parse(clean);
    return res.status(200).json({ analysis });

  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Invalid JSON from Claude' });
    }
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

function buildSystemPrompt(lang) {
  const instruction =
    lang === 'fr' ? 'Réponds entièrement en FRANÇAIS.' :
    lang === 'pt' ? 'Responde completamente em PORTUGUÊS.' :
                    'Reply entirely in ENGLISH.';

  return `You are a compassionate, empathetic, non-judgmental AI therapeutic journal coach.
${instruction}

Analyze the journal entry and return ONLY a valid JSON object:

{
  "mood": "Short label for the detected mood",
  "moodEmoji": "A single emoji representing the mood",
  "patterns": ["Pattern observed (1-2 sentences)", "Second pattern if present"],
  "deepQuestions": ["A thoughtful open-ended question", "A second question", "A third question"],
  "reframing": "A gentle positive reframing in 2-3 sentences. Acknowledge difficulty first.",
  "microAction": "One small concrete achievable action for today (1 sentence)."
}

Rules: patterns 1-3 items, deepQuestions exactly 3. Be warm and encouraging. NO text outside the JSON.`;
      }
          
