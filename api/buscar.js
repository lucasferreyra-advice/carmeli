// api/buscar.js

export default async function handler(req, res) {
  // --- Cabeceras y manejo de OPTIONS (CORS) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // ---------------------------------------------

  // --- Lectura y validación de parámetros ---
  const { marca, modelo, version, anio } = req.query;
  if (!marca || !modelo) {
    return res.status(400).json({ error: 'Marca y modelo son requeridos' });
  }
  // ------------------------------------------

  try {
    // --- INICIO DE LA CORRECCIÓN ---
    // Esta es la parte que faltaba. Aquí se define la variable 'query'.
    let query = `${marca} ${modelo}`;
    if (version?.trim()) query += ` ${version}`;
    if (anio?.trim())    query += ` ${anio}`;
    // --- FIN DE LA CORRECCIÓN ---

    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query )}&category=MLA1744&limit=50`;
    
    const accessToken = process.env.ML_ACCESS_TOKEN;

    // Código de depuración que confirma que el token se lee bien
    if (!accessToken) {
      return res.status(500).json({ 
        error: 'Error de configuración del servidor', 
        detalle: 'La variable de entorno ML_ACCESS_TOKEN no fue encontrada.' 
      });
    }

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      // Si vuelve a fallar, veremos el nuevo status code aquí
      throw new Error(`ML API error: ${response.status}`);
    }

    const data = await response.json();
    
    // --- El resto de tu lógica para procesar los datos ---
    const items = (data.results || []).filter(i => i.price && i.currency_id === 'ARS');
    const precios = items.map(i => i.price);

    const promedio = precios.length ? Math.round(precios.reduce((a, b) => a + b, 0) / precios.length) : 0;
    const minimo   = precios.length ? Math.min(...precios) : 0;
    const maximo   = precios.length ? Math.max(...precios) : 0;
    const sorted   = [...precios].sort((a, b) => a - b);
    const mediana  = sorted.length
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2)
        : sorted[Math.floor(sorted.length/2)]
      : 0;

    const vehiculos = items.slice(0, 20).map(item => ({
      id:        item.id,
      titulo:    item.title,
      precio:    item.price,
      anio:      item.attributes?.find(a => a.id === 'VEHICLE_YEAR')?.value_name || null,
      km:        item.attributes?.find(a => a.id === 'KILOMETERS')?.value_name || null,
      version:   item.attributes?.find(a => a.id === 'TRIM')?.value_name || null,
      link:      item.permalink,
      imagen:    item.thumbnail,
      ubicacion: item.address?.state_name || null,
      condicion: item.condition === 'used' ? 'Usado' : 'Nuevo',
    }));

    return res.status(200).json({
      total: data.paging?.total || 0,
      muestra: items.length,
      estadisticas: { promedio, minimo, maximo, mediana },
      vehiculos,
    });
    // ----------------------------------------------------

  } catch (err) {
    // Captura cualquier error, incluido el 'query is not defined'
    return res.status(500).json({ error: 'Error consultando MercadoLibre', detalle: err.message });
  }
}
