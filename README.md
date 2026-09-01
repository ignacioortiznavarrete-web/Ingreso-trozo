# Dashboard de ingreso de trozo

Dashboard de Google Apps Script para el control de abastecimiento de trozo:
cruza los ingresos de la planilla contra el plan mensual, calcula la tendencia
día a día de cada proveedor y arma el plan de acción de compra.

---

## Qué se agregó en esta versión

**Pestaña Plan de acción.** Prioriza a quién llamar hoy. Cada proveedor recibe
un puntaje de riesgo de 0 a 100 que pondera cuatro cosas: cuánto falta contra
el plan a fecha, hacia dónde va la tendencia, hace cuántos días hábiles que no
despacha y cuánto pesa dentro del plan del mes. Con eso genera un semáforo de
cinco niveles, una acción sugerida concreta y la pregunta que hay que llevar a
la llamada.

**Tendencia día a día en la tabla de cumplimiento.** La tabla central ahora
muestra, por proveedor: si sube o baja (últimos días hábiles contra los
anteriores), un sparkline de la serie diaria con la meta como referencia, y
cuántos días hábiles lleva sin despachar. Un proveedor que cumple el plan pero
viene cayendo tres días seguidos deja de ser invisible.

**Bitácora de apuntes.** Una hoja `Apuntes` en la misma planilla guarda la
pregunta, la respuesta, el responsable, la fecha comprometida y los m³ que el
proveedor comprometió. Se escribe desde el dashboard o a mano en la planilla.
La columna de apuntes de la tabla de cumplimiento muestra cuántos hay abiertos
por proveedor y abre el formulario con la pregunta ya redactada.

**KPIs de compra.** Además del cumplimiento, ahora calcula el ritmo requerido
para cerrar el mes (en m³ y en camiones por día hábil restante), el esfuerzo
adicional que eso significa sobre el ritmo actual, los m³ de brecha acumulada,
los proveedores en riesgo y la concentración del suministro (participación del
top 3 y HHI).

**Rediseño en seis pestañas.** Se conserva la paleta verde original y se
reorganiza el contenido: Resumen, Plan de acción, Territorio, Detalle, Valores
y Apuntes. Los filtros son compartidos y aplican a todas las pestañas.

**Aperturas de la entrega diaria.** El gráfico del mes se puede apilar por
proveedor, calidad o largo, y cada día se abre en su propio detalle. Ver más
abajo.

**Distribución de la cubicación por largo y por diámetro.** Cuánto de lo
recibido viene en cada largo, y el histograma de diámetros con su porcentaje
acumulado.

**Los gráficos muestran sus cifras.** Cada barra lleva su valor a la vista,
para poder llevarlas a una presentación sin depender del tooltip.

**Los mapas ya no frenan la carga.** Los KML y KMZ son lo más caro del
dashboard: hay que listar Drive, descomprimir y parsear XML por cada predio.
Ahora nada de eso ocurre al abrir la página. Ver más abajo.

---

## Archivos del proyecto

El código está en `src/`. En Apps Script cada archivo se agrega con el mismo
nombre y el tipo que indica la tabla.

| Archivo | Tipo en Apps Script | Obligatorio | Qué hace |
|---|---|---|---|
| `Codigo.gs` | Secuencia de comandos | Sí | Núcleo: lee las hojas, arma el payload, caché, GIS |
| `Analisis.gs` | Secuencia de comandos | Sí | Tendencia día a día, riesgo y plan de acción |
| `Apuntes.gs` | Secuencia de comandos | Sí | Bitácora de preguntas y compromisos |
| `Index.html` | HTML | Sí | Armazón de la página |
| `Estilos.html` | HTML | Sí | Sistema de diseño |
| `JsCore.html` | HTML | Sí | Estado, carga, pestañas, filtros, formato |
| `JsResumen.html` | HTML | Sí | KPIs, tabla de cumplimiento y gráficos |
| `JsPlan.html` | HTML | Sí | Pestaña Plan de acción |
| `JsApuntes.html` | HTML | Sí | Pestaña Apuntes |
| `JsMapas.html` | HTML | Sí | Mapas por ROL y por comuna |
| `JsValores.html` | HTML | Sí | Bloque de precios de recepción |
| `JsPresentacion.html` | HTML | Sí | Modo presentación y envío a Slides |
| `JsInit.html` | HTML | Sí | Arranque |
| `Valores.gs` | Secuencia de comandos | No | Precios de recepción (cruce con la hoja de valores) |
| `Slides.gs` | Secuencia de comandos | No | Envío de gráficos a Google Slides |
| `appsscript.json` | Manifiesto | No | Zona horaria y permisos |

Los dos archivos opcionales se pueden omitir: el dashboard detecta que no
están y esconde o desactiva solo esas funciones.

---

## Instalación

1. Abre la planilla y entra a **Extensiones → Apps Script**.
2. Crea cada archivo de la tabla anterior con el mismo nombre, sin la
   extensión (Apps Script la agrega solo). Pega el contenido de `src/`.
3. Guarda, selecciona la función **onOpen** y presiona **Ejecutar**.
4. Acepta los permisos que pida Google.
5. Recarga la planilla. En el menú aparece **MASISA GIS**.

Si actualizas desde una versión anterior, usa **MASISA GIS → Limpiar caché**
después de pegar los archivos. Las claves de caché cambiaron de versión, así
que la caché vieja se descarta sola, pero limpiarla evita cualquier duda.

### Como aplicación web

**Implementar → Nueva implementación → Aplicación web**. El parámetro
`?present=1` en la URL abre el dashboard directo en modo presentación, útil
para dejarlo en una pantalla de sala.

---

## Configuración

En `Codigo.gs`, al inicio:

```js
const CONFIG = {
  SPREADSHEET_ID: '...',              // planilla de datos
  SHEET_NAME: 'Hoja 1',               // ingresos
  PLAN_SHEET_NAME: 'Hoja 2',          // plan mensual por proveedor
  PROJECTION_SHEET_NAME: 'ProyeccionCamiones',
  NOTES_SHEET_NAME: 'Apuntes',
  M3_PER_CAMION: 26,                  // conversión camión a m³
  CACHE_SECONDS: 21600                // 6 horas
};
```

En `Analisis.gs` se ajusta la sensibilidad del análisis:

```js
const ANALISIS_CONFIG = {
  VENTANA_COMPARACION: 3,        // días hábiles de cada mitad de la comparación
  VENTANA_PENDIENTE: 6,          // días hábiles para la regresión
  UMBRAL_VARIACION: 0.15,        // variación mínima para no ser "estable"
  DIAS_SIN_INGRESO_ALERTA: 2,
  DIAS_SIN_INGRESO_CRITICO: 4,   // a partir de aquí la tendencia es "cortado"
  CORTE_CRITICO: 0.60,           // cortes de cumplimiento a fecha
  CORTE_ALERTA: 0.85,
  CORTE_SEGUIMIENTO: 0.95,
  CORTE_SOBRE_PLAN: 1.05
};
```

---

## Cómo se calcula la tendencia

Para cada proveedor se arma una serie con un punto por día hábil transcurrido
del mes. Los días sin despacho se rellenan con cero a propósito: un día en
blanco es información, no un hueco.

Sobre esa serie se calculan tres cosas:

- **Variación**: suma de los últimos 3 días hábiles contra los 3 anteriores.
- **Pendiente**: regresión lineal por mínimos cuadrados sobre los últimos 6
  días hábiles, en m³ por día.
- **Días sin ingreso**: días hábiles desde el último despacho.

Con eso se clasifica:

| Tendencia | Condición |
|---|---|
| `CORTADO` | 4 o más días hábiles sin despachar |
| `BAJA` | variación bajo -15%, o pendiente bajo -1 m³/día |
| `SUBE` | variación sobre +15%, o pendiente sobre +1 m³/día |
| `ESTABLE` | el resto, con al menos 2 días de despacho |
| `SIN INGRESO` | no ha despachado nada en el mes |

### Puntaje de riesgo

```
riesgo = 45 x déficit de cumplimiento
       + 25 cortado / 22 sin ingreso / 20 a la baja / 6 estable
       + 18 x (días sin despacho / 4, tope 1)
       + 12 x (peso en el plan / 15%, tope 1)
       +  5 si despachó en menos del 40% de los días hábiles
```

El peso en el plan es deliberado: un proveedor grande al 80% del plan hace más
daño al mes que uno chico al 50%.

---

## Las aperturas de la entrega diaria

El gráfico "Entrega diaria: m³ real contra meta diaria hábil" tiene dos
aperturas distintas, que responden a dos preguntas distintas.

### A lo largo del mes, por dimensión

El selector **Aperturar por** apila las barras del mes:

| Opción | Qué muestra |
|---|---|
| Total | Proyección de camiones, m³ reales y la meta. Es la vista por defecto |
| Proveedor | Los 8 mayores del mes, cada uno con su color; el resto agrupado en "Otros" |
| Calidad | Siniestrado, verde y manchado, con los colores que ya usa el dashboard |
| Largo | Un paso de verde por largo, del más corto al más largo |

En modo aperturado la proyección de camiones se oculta a propósito: apilarla
sobre los m³ reales daría una columna cuya altura no significa nada. La meta
diaria sigue como línea.

### Por el día que toque

Un clic en cualquier barra abre el detalle de ese día, debajo del gráfico:
m³ recibidos, diferencia contra la meta, camiones equivalentes y trozos, más
las tres aperturas del día en paralelo (proveedor, calidad y largo) con la
participación de cada uno. El selector que está bajo el gráfico hace lo mismo
sin depender de la precisión del puntero.

### Los colores

El color sigue a la entidad, no a su posición: se asigna sobre el mes
completo, así que filtrar por un proveedor no repinta a los largos que quedan,
y el mismo verde identifica al mismo largo en el gráfico de distribución, en
el apilado y en el detalle del día.

- **Proveedor** es identidad sin orden, así que usa una paleta categórica de 8
  tonos en orden fijo. Está validada sobre fondo blanco en pares adyacentes:
  peor par con protanopia dE 9,1 (objetivo 8) y en visión normal dE 19,6
  (piso 15). Tres de sus tonos quedan bajo 3:1 de contraste, lo que obliga a
  que los valores se puedan leer de otra forma: por eso el tooltip trae las
  cifras y el detalle del día es una tabla.
- **Largo** es una magnitud ordenada, así que usa una rampa de un solo tono
  derivada del verde de marca (`#2D6A4F` es el `--forest2` del dashboard).
  Cumple luminosidad monótona, un solo tono (5° de recorrido) y 2,13:1 en el
  extremo claro sobre blanco.
- **Calidad** conserva los colores semánticos que ya tenía el dashboard.

Un noveno proveedor nunca genera un tono nuevo: se agrupa en "Otros". Para
cambiar el corte, en `JsResumen.html`:

```js
const MAX_SERIES_APERTURA = 8;
```

---

## Las dos distribuciones

Son dos tarjetas parecidas pero con datos de naturaleza distinta, y por eso se
dibujan distinto.

**Por largo.** El largo tiene un puñado de valores fijos (2,44 · 3,2 · 4 · 5,5
metros), así que es una categoría ordenada: una columna por valor, con la rampa
de verdes que va del más corto al más largo. Ese color se reutiliza cuando se
apertura la entrega diaria por largo, así que el mismo verde identifica al
mismo largo en los tres lugares donde aparece.

**Por diámetro.** El diámetro es una medida continua, así que es un
histograma. Cuando hay más de 22 valores distintos se agrupan en tramos del
ancho necesario para que la forma de la distribución se lea, en vez de un peine
de barras de un píxel. Va en un solo verde: la posición ya codifica el
diámetro, y pintarlo además con una rampa sería decir lo mismo dos veces. Solo
se destaca en verde oscuro el tramo donde cae el diámetro promedio ponderado,
que sí es un dato.

La tabla del diámetro trae el **porcentaje acumulado**, que responde la
pregunta de compra: hasta qué diámetro se concentra el volumen. El encabezado
de la tarjeta resume el promedio, la mediana y el percentil 80. Ese acumulado
va en la tabla y no como segunda línea en el gráfico a propósito: mezclar m³ y
porcentaje en un mismo gráfico obligaría a dos ejes, que es la forma más común
de hacer ilegible una comparación.

Para cambiar el corte de agrupación, en `JsResumen.html`:

```js
const MAX_TRAMOS_DIAMETRO = 22;   // sobre esto, agrupa en tramos
```

---

## Las cifras en los gráficos

Los gráficos se usan en presentaciones, donde nadie va a pasar el mouse por
encima. Cada marca muestra su valor, con una regla simple:

| Situación | Dónde va la cifra |
|---|---|
| Barra o columna simple | Al extremo de la marca, en tinta oscura |
| Segmento de una barra apilada | Dentro del segmento, en blanco o en tinta oscura según el relleno |
| Segmento demasiado chico | Sin cifra: el valor queda en el tooltip y en el detalle del día |

La tinta de las etiquetas de adentro **se calcula**, no se elige: se mide la
luminancia relativa del relleno y por sobre 0,42 se usa tinta oscura. Por eso
en la apertura por largo los segmentos claros llevan texto oscuro y los
oscuros texto blanco, sin tener que mantener una lista a mano.

Los ejes llevan holgura al final para que la etiqueta del valor mayor no
quede cortada contra el borde del área de dibujo, que es lo que pasa con la
opción `alwaysOutside` de Google Charts si no se reserva ese espacio.

El botón **Ocultar valores** del encabezado las apaga en todos los gráficos a
la vez, para cuando la densidad estorbe. En modo presentación la tipografía de
las cifras y los ejes crece automáticamente.

Los gráficos que se envían a Google Slides llevan las mismas cifras, activadas
con `dataLabel` en `Slides.gs`.

---

## Cómo se cargan los mapas

Antes, abrir el dashboard disparaba una sola llamada que releía la hoja de
datos completa, listaba Drive y abría todos los archivos antes de responder.
Esa llamada competía con la carga de los KPIs aunque nadie fuera a mirar el
mapa. Ahora son tres cambios:

**1. Solo al abrir la pestaña Territorio.** Ni Leaflet se inicializa hasta que
se entra ahí. El resto del dashboard no espera nada del GIS.

**2. El índice va separado de la geometría.**

| Llamada | Qué devuelve | Costo |
|---|---|---|
| `getRolesIndex(force)` | Predios con archivo, con predio, proveedor y volumen. Sin geometría. | Un listado de Drive |
| `getRolesPolygons(rolKeys)` | La geometría de un lote de roles | Un archivo abierto por rol |

La lista lateral aparece apenas llega el índice y ya es utilizable. La
distancia a planta y el área se completan cuando baja la geometría.

**3. La geometría llega por tandas de 8.** Entre tanda y tanda el mapa se
redibuja, así se va poblando en vez de aparecer de golpe al final. Ninguna
llamada se acerca al tiempo límite de Apps Script, y si una tanda falla las
demás siguen.

Además, la agregación por ROL se calcula en la misma pasada que arma el
resumen y queda cacheada, así que construir el índice **ya no relee Hoja 1**.
Con la caché tibia, abrir el dashboard hace una sola lectura completa de la
hoja en vez de dos.

El botón **Recargar mapas** fuerza una relectura de la carpeta de Drive, útil
cuando se agregan archivos nuevos sin querer esperar las 6 horas de caché.

### Ajustar el tamaño de las tandas

En `JsMapas.html`:

```js
const GIS_TAMANO_TANDA = 8;   // predios por llamada
```

Subirlo hace menos llamadas pero cada una tarda más; bajarlo da un dibujado
más progresivo. Con archivos KMZ grandes conviene bajarlo.

---

## La hoja Apuntes

Se crea sola la primera vez que se guarda un apunte, con listas desplegables y
formato condicional por estado. Columnas:

| Columna | Contenido |
|---|---|
| ID | Identificador generado (`AP260828-131500-742`) |
| Fecha registro | Cuándo se anotó |
| Mes plan | Mes del plan al que corresponde |
| Proveedor / Faena | A quién apunta |
| Tipo | Pregunta, Compromiso, Riesgo, Reclamo, Nota |
| Prioridad | Alta, Media, Baja |
| Pregunta u observación | Lo que hay que preguntar o dejar registrado |
| Respuesta / acuerdo | Lo que respondió el proveedor |
| Responsable | Quién hace seguimiento |
| Fecha compromiso | Para cuándo quedó |
| m³ comprometidos | Volumen comprometido |
| Estado | Abierto, En curso, Cerrado |
| Cumplimiento al registrar | Foto del cumplimiento en ese momento |
| Tendencia al registrar | Foto de la tendencia en ese momento |
| Origen | Dashboard, Sugerencia automática, Menú planilla |

Las dos columnas de "al registrar" existen para poder leer después en qué
escenario se hizo la pregunta, no solo qué se preguntó.

Se puede escribir directo en la hoja: el dashboard la lee sin caché, así que
lo que se anota aparece de inmediato.

---

## Estructura que espera de la planilla

**Hoja 1 (ingresos).** Los encabezados se buscan por nombre, sin importar el
orden ni las mayúsculas: `Fecha`, `Proveedor`, `Predio`, `Comuna`, `Rol`,
`Cal Trz`, `Calidad`, `Diametro`, `Largo`, `Cantidad`, `Cubicacion`.

La calidad se deriva de `Cal Trz`: `1` siniestrado, `2` verde, `3` manchado.

**Hoja 2 (plan).** Una columna `Proveedores`, opcionalmente `Origen` para las
faenas de MASISA, y una columna por mes (`ago-26`, o una fecha con formato
`mmm-yyyy`). Las filas que empiezan con `Total` se ignoran.

**ProyeccionCamiones.** Proveedor en la columna A, origen en la B, y desde la C
una columna por fecha con el número de camiones proyectados.

> El dashboard asume que la Hoja 1 contiene **solo el mes en curso**. Si
> detecta varios meses lo avisa en un banner, porque en ese caso los m³ de los
> otros meses inflan el cumplimiento contra un plan que es mensual.

---

## Notas de operación

- **Fecha de referencia**: todo se calcula sobre la fecha del último ingreso
  cargado, no sobre la fecha real de hoy. Así el dashboard no salta al plan del
  mes siguiente apenas cambia el calendario si los datos aún son del mes anterior.
- **Feriados**: la lista está en `FERIADOS_CHILE` en `Codigo.gs` y llega hasta
  2026. Hay que extenderla cada año.
- **Comunas**: `REGION_BY_COMUNA` cubre Biobío, Ñuble, Maule y La Araucanía, y
  `ABREVIATURAS_COMUNA` resuelve las formas cortas que se escriben a mano
  (`STA BARBARA`, `SN CARLOS`). Una comuna que no esté en la tabla aparece
  como "Sin región asignada": eso es a propósito, para que una comuna mal
  escrita en la planilla se note en vez de quedar mapeada a la región
  equivocada. La tabla viaja al cliente en el payload, así que solo se
  mantiene en un lugar.
- **Caché**: 6 horas, troceada para no chocar con el límite de 100 KB por clave
  de `CacheService`. El botón Actualizar la salta.
- **Resiliencia**: cada bloque se renderiza protegido. Si Leaflet o Google
  Charts no cargan, los KPIs y las tablas funcionan igual.
