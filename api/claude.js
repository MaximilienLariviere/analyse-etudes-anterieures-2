// Fonction serverless Vercel pour proxy vers l'API Anthropic
// Fichier à placer dans : api/claude.js

export default async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Api-Key');

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Accepter uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey, model, max_tokens, messages } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Configuration du timeout et headers pour streaming
    res.setHeader('Content-Type', 'application/json');
    
    // Créer un timeout plus long côté client
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280000); // 280 secondes (un peu moins que la limite Vercel)

    try {
      // Appel à l'API Anthropic
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens,
          messages
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return res.status(408).json({ 
          error: {
            type: 'timeout_error',
            message: 'La requête a pris trop de temps. Essayez avec un document plus petit ou contactez le support.'
          }
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ 
      error: {
        type: 'server_error',
        message: error.message || 'Erreur interne du serveur'
      }
    });
  }
}
