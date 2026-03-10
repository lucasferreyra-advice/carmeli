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
    return res.status(500).json({ error: 'Variables no encontradas' });
  }

  // PASO 1: obtener token
  const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  const tokenBody = await tokenRes.json();

  if (!tokenRes.ok) {
    return res.status(500).json({
      paso: 'TOKEN FALLIDO',
      status: tokenRes.status,
      respuesta: tokenBody,
    });
  }

  const { access_token } = tokenBody;

  // PASO 2: buscar
  let query = `${marca} ${modelo}`;
  if (version?.trim()) query += ` ${version}`;
  if (anio?.trim())    query += ` ${anio}`;

  const searchRes = await fetch(
    `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=50`,
    { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' } }
  );

  const searchBody = await searchRes.json();

  if (!searchRes.ok) {
    return res.status(500).json({
      paso: 'BUSQUEDA FALLIDA',
      status: searchRes.status,
      respuesta: searchBody,
      token_usado: access_token?.slice(0, 20) + '...',
    });
  }

  // Procesar
  const items = (searchBody.results || []).filter(i =>
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
    total:        searchBody.paging?.total || 0,
    muestra:      items.length,
    estadisticas: { promedio, minimo, maximo, mediana },
    vehiculos,
  });
}
