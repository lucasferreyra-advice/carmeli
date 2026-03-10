export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { marca, modelo, version, anio } = req.query;
  if (!marca || !modelo) {
    return res.status(400).json({ error: 'Marca y modelo son requeridos' });
  }

  const CLIENT_ID     = process.env.ML_CLIENT_ID;
  const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'ML_CLIENT_ID o ML_CLIENT_SECRET no configurados en Vercel' });
  }

  try {
    // 1. Obtener access token con client_credentials
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      throw new Error(`Token error: ${err.message || tokenRes.status}`);
    }

    const { access_token } = await tokenRes.json();

    // 2. Buscar con el token
    let query = `${marca} ${modelo}`;
    if (version?.trim()) query += ` ${version}`;
    if (anio?.trim())    query += ` ${anio}`;

    const searchUrl = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=50`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!searchRes.ok) {
      const err = await searchRes.json();
      throw new Error(`Search error ${searchRes.status}: ${err.message || JSON.stringify(err)}`);
    }

    const data = await searchRes.json();

    const items = (data.results || []).filter(i =>
      i.price && i.currency_id === 'ARS' && i.price > 100000
    );

    const precios = items.map(i => i.price);
    const promedio = precios.length ? Math.round(precios.reduce((a,b)=>a+b,0)/precios.length) : 0;
    const minimo   = precios.length ? Math.min(...precios) : 0;
    const maximo   = precios.length ? Math.max(...precios) : 0;
    const sorted   = [...precios].sort((a,b)=>a-b);
    const mediana  = sorted.length
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length/2-1]+sorted[sorted.length/2])/2)
        : sorted[Math.floor(sorted.length/2)]
      : 0;

    const vehiculos = items.slice(0,20).map(item => ({
      id:        item.id,
      titulo:    item.title,
      precio:    item.price,
      anio:      item.attributes?.find(a=>a.id==='VEHICLE_YEAR')?.value_name || null,
      km:        item.attributes?.find(a=>a.id==='KILOMETERS')?.value_name || null,
      link:      item.permalink,
      imagen:    item.thumbnail,
      ubicacion: item.address?.state_name || null,
      condicion: item.condition === 'used' ? 'Usado' : 'Nuevo',
    }));

    return res.status(200).json({
      total:        data.paging?.total || 0,
      muestra:      items.length,
      estadisticas: { promedio, minimo, maximo, mediana },
      vehiculos,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Error consultando ML', detalle: err.message });
  }
}
