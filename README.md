# MelaminaDesign 🪵

Diseñador de muebles en melamina para Perú. Calcula planchas, genera planos de corte y visualiza en 3D.

## Características (Fase 1 — Frontend)

- **Wizard de inicio** — selección guiada: tipo de mueble, montaje (libre / anclaje a pared), dimensiones, grosor y formato de plancha
- **Editor 2D** — vista de plano en corte frontal con capa de dimensiones en cm (exporta en mm)
- **Vista 3D isométrica** — rotación libre con mouse o botones
- **Plano de corte** — optimizador tipo bin-packing guillotine, muestra todas las piezas ubicadas en planchas
- **Panel derecho** — lista todas las piezas con medidas en mm y cuenta de planchas necesarias
- **Cálculo inteligente** — descuenta grosor de laterales en tapas (18mm c/u por defecto)
- **Anclaje a pared** — incluye rail horizontal de 8cm como refuerzo trasero en lugar de fondo de melamina
- **Atajo de teclado** — `D` división, `S` estante, `Del` eliminar, `1/2/3` cambio de vista, `+/-` zoom

## Medidas estándar Perú (baked-in)

| Formato | Dimensiones |
|---------|------------|
| Grande (Arauco, Pelikano) | 2150 × 2440 mm |
| 4×8 (Sodimac, Promart) | 1220 × 2440 mm |

Grosores disponibles: 15 mm, **18 mm** (default), 25 mm.

## Estructura del proyecto

```
melamina-designer/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── state.js      — Estado global
    ├── wizard.js     — Flujo de onboarding
    ├── canvas2d.js   — Motor de dibujo 2D
    ├── canvas3d.js   — Renderizado 3D isométrico
    ├── cutplan.js    — Optimizador de corte
    ├── calc.js       — Cálculo de piezas y planchas
    └── app.js        — Controlador principal
```

## Despliegue en GitHub Pages

1. Sube la carpeta a un repositorio GitHub
2. Ve a Settings → Pages → Source: Deploy from branch `main` / `root`
3. Listo en `https://usuario.github.io/melamina-designer/`

## Roadmap (próximas fases)

- [ ] Puertas (abatibles, corredizas)
- [ ] Cajones
- [ ] Selección de color de melamina
- [ ] Exportación PDF con membrete y lista de corte detallada
- [ ] Guardado de proyectos (localStorage)
- [ ] Múltiples módulos en un proyecto
- [ ] Precio estimado de materiales (precios Perú actualizables)
