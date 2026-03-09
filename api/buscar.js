// api/buscar.js

export default async function handler(req, res) {
  // ... (código de headers y validaciones)

  try {
    // ... (código para construir la query)

    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query )}&category=MLA1744&limit=50`;

    const accessToken = process.env.ML_ACCESS_TOKEN;

    // --- LÍNEA DE DEPURACIÓN ---
    // Vamos a verificar si el token se está leyendo correctamente.
    if (!accessToken) {
      return res.status(500).json({ 
        error: 'Error de configuración del servidor', 
        detalle: 'La variable de entorno ML_ACCESS_TOKEN no fue encontrada.' 
      });
    }
    // --- FIN DE LA LÍNEA DE DEPURACIÓN ---

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const response = await fetch(url, options);

    if (!response.ok) throw new Error(`ML API error: ${response.status}`);

    // ... (resto del código)

  } catch (err) {
    return res.status(500).json({ error: 'Error consultando MercadoLibre', detalle: err.message });
  }
}
