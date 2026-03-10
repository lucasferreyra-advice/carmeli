export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { marca, modelo, version, anio, km } = req.query;
  if (!marca || !modelo) {
    return res.status(400).json({ error: 'Marca y modelo son requeridos' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
  }

  const vehiculo = [marca, modelo, version, anio].filter(Boolean).join(' ');
  const kmInfo   = km ? ` con ${Number(km).toLocaleString('es-AR')} km` : '';

  const prompt = `Sos un experto tasador del mercado automotor argentino. El usuario consulta el precio de: ${vehiculo}${kmInfo}.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON:

{
  "promedio": <número entero en ARS>,
  "minimo": <número entero en ARS>,
  "maximo": <número entero en ARS>,
  "mediana": <número entero en ARS>,
  "confianza": "<alta|media|baja>",
  "analisis": "<2-3 oraciones sobre el precio de mercado actual de este auto en Argentina>",
  "precio_justo": "<rango recomendado para comprar y para vender>",
  "consejo_compra": "<2-3 consejos concretos para quien quiere comprar este auto>",
  "puntos_atencion": "<2-3 puntos de atención específicos de este modelo en Argentina>",
  "publicaciones_estimadas": <número estimado de publicaciones en MercadoLibre Argentina>
}

Basate en tu conocimiento del mercado argentino actual. Los precios deben estar en pesos argentinos (ARS) y ser realistas para marzo 2026.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.json();
      throw new Error(`Gemini ${geminiRes.status}: ${err.error?.message}`);
    }

    const geminiData = await geminiRes.json();
    let texto = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar markdown si Gemini lo agrega
    texto = texto.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(texto);

    // Link directo a ML para que el usuario vea publicaciones reales
    const mlQuery = encodeURIComponent([marca, modelo, version, anio].filter(Boolean).join(' '));
    const mlLink  = `https://autos.mercadolibre.com.ar/${marca.toLowerCase().replace(/\s+/g,'-')}/${modelo.toLowerCase().replace(/\s+/g,'-')}/_OrderId_PRICE*ASC`;

    return res.status(200).json({
      fuente:      'gemini',
      vehiculo,
      estadisticas: {
        promedio: parsed.promedio,
        minimo:   parsed.minimo,
        maximo:   parsed.maximo,
        mediana:  parsed.mediana,
      },
      confianza:    parsed.confianza,
      analisis:     parsed.analisis,
      precio_justo: parsed.precio_justo,
      consejo_compra:    parsed.consejo_compra,
      puntos_atencion:   parsed.puntos_atencion,
      publicaciones_estimadas: parsed.publicaciones_estimadas,
      ml_link: mlLink,
      ml_query: mlQuery,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Error generando análisis', detalle: err.message });
  }
}
