export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { busqueda, estadisticas, vehiculos, km } = req.body;

  if (!busqueda || !estadisticas) {
    return res.status(400).json({ error: 'Datos insuficientes' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  const { promedio, minimo, maximo, mediana } = estadisticas;

  const listaPrecios = vehiculos.slice(0, 10).map((v, i) =>
    `${i+1}. ${v.titulo} — $${v.precio.toLocaleString('es-AR')} ARS${v.anio ? ` (${v.anio})` : ''}${v.km ? `, ${Number(v.km).toLocaleString('es-AR')} km` : ''}`
  ).join('\n');

  const prompt = `Sos un experto en el mercado automotor argentino. Analizá estos datos de MercadoLibre Argentina y dá consejos concretos y útiles.

VEHÍCULO CONSULTADO: ${busqueda}${km ? `\nKILÓMETROS DEL VEHÍCULO: ${Number(km).toLocaleString('es-AR')} km` : ''}

ESTADÍSTICAS DE MERCADO (en ARS):
- Precio promedio: $${promedio.toLocaleString('es-AR')}
- Precio mediana: $${mediana.toLocaleString('es-AR')}
- Precio mínimo: $${minimo.toLocaleString('es-AR')}
- Precio máximo: $${maximo.toLocaleString('es-AR')}
- Dispersión: $${(maximo - minimo).toLocaleString('es-AR')} entre el más barato y el más caro

MUESTRA DE PUBLICACIONES ACTUALES:
${listaPrecios}

Respondé con un análisis claro y directo organizado en estas 4 secciones. Usá emojis al inicio de cada sección:

💰 ANÁLISIS DE PRECIO
[2-3 oraciones sobre si el mercado está caro, barato o normal para este modelo, y por qué hay tanta o poca dispersión de precios]

🎯 PRECIO JUSTO
[Indicá un rango de precio justo para comprar y para vender este vehículo según los datos. Si tiene muchos km, mencionalo.]

✅ CONSEJO DE COMPRA
[2-3 consejos concretos si alguien quiere COMPRAR este auto: qué revisar, qué precio ofrecer, qué versiones convienen]

⚠️ PUNTOS A TENER EN CUENTA
[2-3 puntos de atención específicos de este modelo/marca en el mercado argentino: problemas comunes, historial, qué documentar]

Respondé en español rioplatense, de manera directa y concisa. Sin preamble, ir directo a las secciones.`;

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
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const texto = data.content?.[0]?.text || '';

    return res.status(200).json({ consejo: texto });
  } catch (err) {
    return res.status(500).json({ error: 'Error generando análisis IA', detalle: err.message });
  }
}
