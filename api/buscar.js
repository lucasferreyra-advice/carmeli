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
  "promedio": 15000000,
  "minimo": 12000000,
  "maximo": 18000000,
  "mediana": 14500000,
  "confianza": "alta",
  "analisis": "texto aqui",
  "precio_justo": "texto aqui",
  "consejo_compra": "texto aqui",
  "puntos_atencion": "texto aqui",
  "publicaciones_estimadas": 150
}

Reemplazá los valores con datos reales para ${vehiculo} en el mercado argentino de marzo 2026. Solo devolvé el JSON, nada más.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({
        error: 'Gemini rechazó la solicitud',
        status: geminiRes.status,
        detalle: geminiData?.error?.message || JSON.stringify(geminiData),
      });
    }

    let texto = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar markdown
    texto = texto.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(texto);
    } catch(parseErr) {
      return res.status(500).json({
        error: 'Gemini no devolvió JSON válido',
        texto_recibido: texto.slice(0, 500),
        parse_error: parseErr.message,
      });
    }

    const mlLink = `https://autos.mercadolibre.com.ar/${marca.toLowerCase().replace(/\s+/g,'-')}/${modelo.toLowerCase().replace(/\s+/g,'-')}/_OrderId_PRICE*ASC`;

    return res.status(200).json({
      fuente: 'gemini',
      vehiculo,
      estadisticas: {
        promedio: parsed.promedio,
        minimo:   parsed.minimo,
        maximo:   parsed.maximo,
        mediana:  parsed.mediana,
      },
      confianza:               parsed.confianza,
      analisis:                parsed.analisis,
      precio_justo:            parsed.precio_justo,
      consejo_compra:          parsed.consejo_compra,
      puntos_atencion:         parsed.puntos_atencion,
      publicaciones_estimadas: parsed.publicaciones_estimadas,
      ml_link: mlLink,
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Error inesperado',
      detalle: err.message,
      stack: err.stack?.slice(0, 300),
    });
  }
}
