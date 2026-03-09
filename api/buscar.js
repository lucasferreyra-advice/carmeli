export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { marca, modelo, version, anio } = req.query;

  if (!marca || !modelo) {
    return res.status(400).json({ error: 'Marca y modelo son requeridos' });
  }

  try {
    let query = `${marca} ${modelo}`;
    if (version && version.trim()) query += ` ${version}`;
    if (anio && anio.trim()) query += ` ${anio}`;

    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&category=MLA1744&limit=50`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MercadoLibre API error: ${response.status}`);
    }

    const data = await response.json();

    // Filtrar solo autos con precio en ARS
    const items = (data.results || []).filter(
      (item) => item.price && item.currency_id === 'ARS'
    );

    // Calcular estadísticas
    const precios = items.map((i) => i.price);
    const promedio = precios.length
      ? Math.round(precios.reduce((a, b) => a + b, 0) / precios.length)
      : 0;
    const minimo = precios.length ? Math.min(...precios) : 0;
    const maximo = precios.length ? Math.max(...precios) : 0;

    // Mediana
    const sorted = [...precios].sort((a, b) => a - b);
    const mediana = sorted.length
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

    const vehiculos = items.slice(0, 20).map((item) => ({
      id: item.id,
      titulo: item.title,
      precio: item.price,
      moneda: item.currency_id,
      anio: item.attributes?.find((a) => a.id === 'VEHICLE_YEAR')?.value_name || null,
      km: item.attributes?.find((a) => a.id === 'KILOMETERS')?.value_name || null,
      version: item.attributes?.find((a) => a.id === 'TRIM')?.value_name || null,
      link: item.permalink,
      imagen: item.thumbnail,
      ubicacion: item.address?.state_name || null,
      condicion: item.condition === 'used' ? 'Usado' : 'Nuevo',
    }));

    return res.status(200).json({
      total: data.paging?.total || 0,
      muestra: items.length,
      estadisticas: { promedio, minimo, maximo, mediana },
      vehiculos,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error al consultar MercadoLibre', detalle: error.message });
  }
}
