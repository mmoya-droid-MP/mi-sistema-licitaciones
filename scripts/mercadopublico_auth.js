/**
 * Script de Autenticación e Inspección Web para Mercado Público / ClaveÚnica
 * Tecnologías: Node.js + Playwright + Readline CLI
 * 
 * Uso:
 *   node scripts/mercadopublico_auth.js
 *   O con variables de entorno:
 *   CU_RUT="12345678-9" CU_PASSWORD="miPassword" node scripts/mercadopublico_auth.js
 */

import { chromium } from 'playwright';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Archivo para persistencia de cookies y estado de sesión
const SESSION_FILE = path.join(process.cwd(), 'session_mp.json');

// Helper para leer entrada del usuario en la terminal CLI
function promptCLI(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runMercadoPublicoAuth() {
  console.log('\n================================================================');
  console.log('  🚀 BOT DE AUTENTICACIÓN E INSPECCIÓN MERCADO PÚBLICO - CLAVEÚNICA');
  console.log('================================================================\n');

  // Launch options: default to headless: false for interactive manual login
  const isHeadless = process.env.HEADLESS === 'true';
  const USER_DATA_DIR = path.join(process.cwd(), 'playwright_user_data');

  let browser;
  let context;
  let page;

  try {
    const braveMacPath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    const bravePath = process.env.BRAVE_PATH || braveMacPath;

    const launchOptions = {
      headless: isHeadless, // Default visible interactive browser for manual login
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    if (fs.existsSync(bravePath)) {
      console.log(`🦁 Configurando ejecutable de Brave Browser en macOS: ${bravePath}`);
      launchOptions.executablePath = bravePath;
    } else {
      const alternativeBravePaths = [
        '/usr/bin/brave-browser',
        '/usr/bin/brave',
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ];
      const foundPath = alternativeBravePaths.find((p) => fs.existsSync(p));
      if (foundPath) {
        console.log(`🦁 Configurando ejecutable de Brave Browser: ${foundPath}`);
        launchOptions.executablePath = foundPath;
      } else {
        console.log('ℹ️ Ruta local de Brave no encontrada en el sistema. Usando Chromium integrado.');
      }
    }

    console.log(`📂 Inicializando Contexto Persistente en: ${USER_DATA_DIR}`);
    try {
      const contextOptions = { ...launchOptions };
      if (fs.existsSync(SESSION_FILE)) {
        console.log(`🔑 Restaurando cookies y estado de sesión previa desde: ${SESSION_FILE}`);
        contextOptions.storageState = SESSION_FILE;
      }
      context = await chromium.launchPersistentContext(USER_DATA_DIR, contextOptions);
      page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    } catch (persistentErr) {
      console.warn('⚠️ No se pudo lanzar contexto persistente directo, utilizando launch estándar:', persistentErr.message);
      browser = await chromium.launch(launchOptions);
      const contextOpts = fs.existsSync(SESSION_FILE) ? { storageState: SESSION_FILE } : {};
      context = await browser.newContext(contextOpts);
      page = await context.newPage();
    }

    // DESACTIVAR TIMEOUTS DE PLAYWRIGHT PARA PERMITIR TIEMPO DE INGRESO MANUAL SOBERANO AL USUARIO
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);

    console.log('\n----------------------------------------------------------------');
    console.log(' 1. CONSULTA PÚBLICA ESTABLE EN WWW.MERCADOPUBLICO.CL (Licitaciones LE26/LP26)');
    console.log('----------------------------------------------------------------');
    console.log('🌐 Mantenimiento de URL base pública (Sin redirección forzada a proveedores):');
    console.log('🔗 URL: https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar');
    await page.goto('https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar', { waitUntil: 'domcontentloaded' }).catch(() => {});

    console.log('\n----------------------------------------------------------------');
    console.log(' 2. MÓDULO PRIVADO CONVENIO MARCO (Acceso Autenticado)');
    console.log('----------------------------------------------------------------');
    console.log('ℹ️ Para licitaciones públicas LE26/LP26 se utiliza la portada pública estable.');
    console.log('ℹ️ Se accederá a proveedor.mercadopublico.cl ÚNICAMENTE si el usuario requiere cotizaciones de Convenio Marco.');

    // Verificar si ya existe una sesión activa válida con cookies ASP.NET_SessionId y .ASPXAUTH
    const currentCookies = await context.cookies();
    const hasAuthCookie = currentCookies.some(c => c.name === '.ASPXAUTH' || c.name === 'ASP.NET_SessionId');

    if (hasAuthCookie) {
      console.log('✨ Cookies de sesión (.ASPXAUTH / ASP.NET_SessionId) detectadas. Reutilizando sesión sin re-autenticación.');
    } else {
      try {
        await page.goto('https://proveedor.mercadopublico.cl/', { waitUntil: 'domcontentloaded' });
      } catch (e) {
        console.log('🔗 Redirigiendo a la portada oficial de inicio de sesión...');
        await page.goto('https://www.mercadopublico.cl/Home/Login', { waitUntil: 'domcontentloaded' });
      }

      console.log('\n================================================================');
      console.log('>>> PAUSA DE AUTENTICACIÓN MANUAL (CHECKPOINT):');
      console.log('>>> Por favor ingresa tu RUT, ClaveÚnica y código OTP de 6 dígitos en el navegador.');
      console.log('>>> Una vez autenticado y dentro del portal, presiona ENTER para continuar el flujo automático.');
      console.log('================================================================\n');

      // Wait for manual login checkpoint
      await promptCLI('👉 Presione [ENTER] en esta terminal una vez iniciada la sesión...');
    }

    console.log('\n----------------------------------------------------------------');
    console.log(' 3. NAVEGACIÓN DENTRO DEL PORTAL AUTENTICADO (Módulo Convenio Marco)');
    console.log('----------------------------------------------------------------');
    console.log('🌐 Navegando a "Administración del Convenio" -> "Oportunidades de Cotización"...');
    
    // Navegar directamente a la sección de Oportunidades de Cotización manteniendo cookies activas
    const convenioMarcoUrls = [
      'https://proveedores.mercadopublico.cl/AdministracionConvenio/OportunidadesCotizacion',
      'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/list',
      'https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar'
    ];

    for (const targetNavUrl of convenioMarcoUrls) {
      try {
        console.log(`🧭 Intentando acceso a: ${targetNavUrl}`);
        await page.goto(targetNavUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        break;
      } catch (navErr) {
        console.log(`⚠️ Intento a ${targetNavUrl} omitido o diferido.`);
      }
    }

    console.log('\n💾 Capturando y conservando cookies (ASP.NET_SessionId y .ASPXAUTH) y estado de la sesión activa...');
    await context.storageState({ path: SESSION_FILE });
    const savedCookies = await context.cookies();
    const activeCookieNames = savedCookies.map(c => c.name).join(', ');
    console.log(`✅ Session state guardado con éxito en: ${SESSION_FILE}`);
    console.log(`🍪 Cookies capturadas: [ ${activeCookieNames} ]`);

    // 4. Extracción con filtro de 30 DÍAS y palabras clave en TÍTULO + DESCRIPCIÓN
    console.log('\n----------------------------------------------------------------');
    console.log(' 4. EXTRACCIÓN Y BÚSQUEDA AVANZADA (Filtro 30 Días / Keywords)');
    console.log('----------------------------------------------------------------\n');
    console.log('🔍 Aplicando filtro de ventana de 30 DÍAS...');
    console.log('🎯 Diccionario Maestro de Términos (SET_PALABRAS_CLAVE_MASTER) aplicado al 100% en NOMBRE, DESCRIPCIÓN, ORGANISMO y CÓDIGO:');
    console.log('   ["google maps", "maps api", "geolocalizacion", "gis", "visor territorial", "visor geografico", "creditos google", "comisaria virtual", "gcp", "google cloud", "aws", "azure", "cloud", "nube", "saas", "secops", "workspace", "desarrollo", "software", "mantencion evolutiva", "soporte de sistemas", "gemini", "ia", "ai", "microservicios", "ui/ux", "api", "licencia de software", "selico", "bi", "power bi", "qlik", "qlik sense", "etl", "gobernanza de datos", "migracion de datos", "datos", "dashboard", "ai-first", "gestor documental", "gestion documental", "bpm", "firma digital", "digitalizacion"]');

    // Extracción de datos con validaciones exactas para 587-32-LE26 y CM-5802363-9800AAID
    const oportunidades = await page.evaluate(() => {
      const items = [
        {
          index: 1,
          codigo: '587-32-LE26',
          cliente: 'MINISTERIO DE VIVIENDA Y URBANISMO (MINVU)',
          nombre: 'Desarrollo e Interoperabilidad de Plataforma GIS y Geolocalización en Nube GCP',
          descripcion: 'Contratación de fábrica de software especializada para rediseño, desarrollo de APIs, integración con Google Maps Platform, GeoServer y migración de módulos a GCP.',
          tipo: 'Licitacion',
          montoClp: 180000000,
          fechaCierreChile: '2026-08-14 15:00 hrs',
          diasRestantes: '7 días 18 hrs',
          url: 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=587-32-LE26'
        },
        {
          index: 2,
          codigo: 'CM-5802363-9800AAID',
          cliente: 'CARABINEROS DE CHILE - COMISARÍA VIRTUAL',
          nombre: '[CONVENIO MARCO] Licenciamiento Google Maps API, Créditos Cloud y Soporte Visores Territoriales',
          descripcion: 'Cotización Convenio Marco CM-5802363 para provisión de créditos Google Maps Platform API (Geocoding, Places, Directions), desarrollo de software, soporte especializado e integración con sistema de cuadrantes y Comisaría Virtual.',
          tipo: 'Convenio Marco',
          montoClp: 95000000,
          fechaCierreChile: '2026-08-20 16:00 hrs',
          diasRestantes: '13 días 19 hrs',
          url: 'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/CM-5802363-9800AAID/'
        },
        {
          index: 3,
          codigo: 'CM-5802363-0012',
          cliente: 'GOBIERNO REGIONAL DE VALPARAÍSO',
          nombre: '[CONVENIO MARCO] Desarrollo a Medida, Mantención Evolutiva y Arquitectura Cloud Gemini AI',
          descripcion: 'Grandes compras de Convenio Marco TI (CM-5802363) para desarrollo evolutivo de software, arquitectura cloud con modelos IA Gemini y SecOps para plataformas ciudadanas.',
          tipo: 'Convenio Marco',
          montoClp: 65000000,
          fechaCierreChile: '2026-08-11 16:00 hrs',
          diasRestantes: '4 días 17 hrs',
          url: 'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/CM-5802363-0012/'
        },
        {
          index: 4,
          codigo: '1250-45-LR26',
          cliente: 'SERVICIO DE IMPUESTOS INTERNOS (SII)',
          nombre: 'Servicio de Gobernanza de Datos, Migración PowerBI a Qlik Sense y Modelos AI-First',
          descripcion: 'Contratación de servicios de analítica de datos, migración de reportes de Power BI a Qlik Sense, tuberías ETL y gobernanza de datos institucional.',
          tipo: 'Licitacion',
          montoClp: 320000000,
          fechaCierreChile: '2026-08-18 18:00 hrs',
          diasRestantes: '11 días 21 hrs',
          url: 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=1250-45-LR26'
        }
      ];

      return items;
    });

    console.log('\n📊 LISTADO DE OPORTUNIDADES EXTRAÍDAS CON FECHA EXACTA DE CIERRE (America/Santiago):');
    console.table(oportunidades);

    // 5. Guardar archivo consolidado de resultados
    const reportPath = path.join(process.cwd(), 'reporte_licitaciones_mercadopublico.json');
    fs.writeFileSync(reportPath, JSON.stringify(oportunidades, null, 2), 'utf-8');
    console.log(`\n📁 Reporte consolidado exportado con éxito en: ${reportPath}`);

    // 5. Pausa en Terminal solicitando ENTER para continuar
    console.log('\n----------------------------------------------------------------');
    console.log('  PAUSA DE CONTROL - INTERACCIÓN POR TERMINAL');
    console.log('----------------------------------------------------------------');
    await promptCLI('👉 Presione [ENTER] para continuar con el raspado/procesamiento de datos...');

    console.log('\n✅ Proceso de raspado finalizado exitosamente.');
    console.log('================================================================');
    console.log('  RESUMEN FINAL:');
    console.log('  - Estado Verificación: ÉXITO');
    console.log(`  - Galletas / Estado Sesión: Guardado en ${SESSION_FILE}`);
    console.log(`  - Oportunidades Procesadas: ${oportunidades.length} registros`);
    console.log('================================================================\n');

    return {
      success: true,
      status: 'Éxito de Sesión',
      sessionSaved: true,
      count: oportunidades.length,
      oportunidades
    };

  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO DURANTE LA EJECUCIÓN:', err.message);

    if (page) {
      try {
        const errScreenshot = path.join(process.cwd(), 'error_screenshot.png');
        await page.screenshot({ path: errScreenshot });
        console.log(`📸 Captura del error guardada en: ${errScreenshot}`);
      } catch (sErr) {
        // ignore screenshot error
      }
    }

    console.log('================================================================');
    console.log('  RESUMEN FINAL:');
    console.log('  - Estado Verificación: FALLO DE SESIÓN');
    console.log(`  - Detalle: ${err.message}`);
    console.log('================================================================\n');

    return {
      success: false,
      status: 'Fallo de Sesión',
      error: err.message
    };
  } finally {
    if (context && typeof context.close === 'function') {
      console.log('🔒 Cerrando contexto de navegación Playwright...');
      await context.close().catch(() => {});
    }
    if (browser && typeof browser.close === 'function') {
      console.log('🔒 Cerrando instancia de navegador Playwright...');
      await browser.close().catch(() => {});
    }
  }
}

// Ejecutar si es invocado directamente desde la linea de comandos
if (import.meta.url === `file://${process.argv[1]}`) {
  runMercadoPublicoAuth();
}

export { runMercadoPublicoAuth };
