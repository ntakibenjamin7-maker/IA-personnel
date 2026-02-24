try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Journal entry:\n---\n${text}\n---\nJSON only.` }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({
      error: "Erreur API Anthropic",
      details: data
    });
  }

  const rawText = data.content?.[0]?.text;

  if (!rawText) {
    return res.status(500).json({
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
      error: "Erreur JSON.parse",
      rawResponse: rawText
    });
  }

  return res.status(200).json({ analysis });

} catch (err) {
  return res.status(500).json({
    error: "Erreur serveur",
    message: err.message
  });
                 }
