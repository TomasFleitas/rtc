# Test G SDK

Este documento describe cómo integrar y utilizar la biblioteca `test-sdk-g` en tus proyectos.

## Instalación

Para utilizar `test-sdk-g`, primero debes instalar el paquete en tu proyecto. Esto se puede hacer mediante NPM o incluyendo directamente el SDK a través de un CDN.

### NPM

Para instalar la biblioteca usando npm, ejecuta el siguiente comando en tu terminal:

```batch
npm install test-sdk-g
```

### Uso

Para comenzar a utilizar la biblioteca después de instalarla, primero importa `initGueno` de `test-sdk-g` en tu archivo JavaScript:

```javascript
import { initGueno } from 'test-sdk-g';
```

Luego, inicializa la biblioteca con tu clave secreta:

```javascript
initGueno({ clientKey: 'secret' });
```

### CDN

Si prefieres no instalar la biblioteca y utilizarla directamente desde un CDN, puedes hacerlo añadiendo el siguiente script a tu página HTML:

```javascript
<script
  type="module"
  src="https://storage.googleapis.com/gueno-sdk/sdk.js"
></script>
```

Después de incluir el script, puedes inicializar la biblioteca de la siguiente manera:

```javascript
<script>
  window["Gueno"].initGueno({ clientKey: "secret" });
</script>
```
