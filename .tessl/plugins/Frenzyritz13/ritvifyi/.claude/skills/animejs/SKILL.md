---
name: animejs
description: "Animate elements using Anime.js. USE WHEN user asks about animations, transitions, motion effects, or interactive UI movement. TRIGGER WORDS: animate, animation, transition, motion, keyframe, timeline, stagger, tween, fade, slide, bounce, spring, easing, scroll animation, draggable, SVG animation, path drawing, morphing, entrance animation, page transition, loading spinner, hover effect."
---

# Anime.js Animation Skill

Anime.js is a fast, lightweight JavaScript animation library (current stable: **v4.x**). This skill covers both **v4** (current) and **v3** (legacy). Always use v4 patterns unless the user is explicitly on v3.

---

## Installation

```bash
npm install animejs
```

```javascript
// ES Module (v4 — preferred)
import { animate, createTimeline, stagger, svg, createScope, onScroll, createDraggable, utils, engine } from 'animejs';

// CDN — ES Module
import { animate } from 'https://cdn.jsdelivr.net/npm/animejs/+esm';
import { animate } from 'https://esm.sh/animejs';

// CDN — UMD (global `anime` object)
// <script src="https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js"></script>
const { animate } = anime;

// CommonJS
const { animate } = require('animejs');
```

**Subpath imports** (tree-shakable, smaller bundles):
```javascript
import { animate } from 'animejs/animation';
import { createTimeline } from 'animejs/timeline';
import { stagger } from 'animejs/utils';
import { svg } from 'animejs/svg';
import { createScope } from 'animejs/scope';
import { onScroll } from 'animejs/events';
import { createDraggable } from 'animejs/draggable';
```

**WAAPI lightweight alternative** (3KB vs 10KB full):
```javascript
import { waapi } from 'animejs';
const animation = waapi.animate(targets, parameters);
```

---

## v3 to v4 Migration Reference

CRITICAL differences — always use v4 syntax unless told otherwise.

| Concept | v3 (legacy) | v4 (current) |
|---|---|---|
| Main function | `anime({ targets, ...props })` | `animate(targets, props)` |
| Timeline | `anime.timeline(opts)` | `createTimeline(opts)` |
| Easing key | `easing: 'easeOutQuad'` | `ease: 'outQuad'` |
| Easing prefix | `easeInOutElastic` | `inOutElastic` |
| Direction reverse | `direction: 'reverse'` | `reversed: true` |
| Direction alternate | `direction: 'alternate'` | `alternate: true` |
| End delay | `endDelay: 500` | `loopDelay: 500` |
| Loop count | `loop: 1` = 1 iteration | `loop: 1` = repeat once (2 total) |
| Round | `round: 100` | `modifier: utils.round(2)` |
| Callbacks | `update`, `begin`, `complete` | `onUpdate`, `onBegin`, `onComplete` |
| Loop callbacks | `loopBegin` / `loopComplete` | `onLoop` (single) |
| Promise | `animation.finished.then()` | `animation.then()` |
| SVG path | `anime.path('path')` | `svg.createMotionPath('path')` |
| SVG draw | `anime.setDashoffset` | `svg.createDrawable()` + `draw` prop |
| Remove | `anime.remove(target)` | `utils.remove(target)` |
| Get value | `anime.get(el, prop)` | `utils.get(el, prop)` |
| Set value | `anime.set(el, props)` | `utils.set(el, props)` |
| Engine hidden | `anime.suspendWhenDocumentHidden` | `engine.pauseOnDocumentHidden` |
| Property value | `{ value: 100 }` | `{ to: 100 }` |
| Imports | `import anime from 'animejs/lib/anime.es.js'` | `import { animate } from 'animejs'` |

**v3 example:**
```javascript
import anime from 'animejs/lib/anime.es.js';
anime({
  targets: '.box',
  translateX: 250,
  rotate: '1turn',
  easing: 'easeInOutQuad',
  direction: 'alternate',
  loop: true
});
```

**v4 equivalent:**
```javascript
import { animate } from 'animejs';
animate('.box', {
  x: 250,
  rotate: '1turn',
  ease: 'inOutQuad',
  alternate: true,
  loop: true
});
```

---

## Core animate() API

```javascript
const animation = animate(targets, parameters);
```

### Targets

```javascript
// CSS selector
animate('.card', { opacity: 0 });

// DOM element
animate(document.querySelector('#hero'), { y: -20 });

// NodeList / array of elements
animate(document.querySelectorAll('.item'), { x: 100 });

// Array of elements
animate([el1, el2, el3], { scale: 1.2 });

// Plain JavaScript object (non-DOM)
const obj = { count: 0 };
animate(obj, {
  count: 100,
  onUpdate: () => console.log(Math.round(obj.count))
});
```

### Animatable Properties

```javascript
animate('.el', {
  // CSS transforms (shorthand preferred)
  x: 100,           // translateX — default unit: px
  y: -50,           // translateY — default unit: px
  z: 0,             // translateZ — default unit: px
  rotate: '1turn',  // or 360 (degrees), '3.14rad'
  rotateX: 45,
  rotateY: 45,
  scale: 1.5,
  scaleX: 2,
  scaleY: 0.5,
  skew: 15,
  skewX: 10,
  skewY: 10,
  perspective: '500px',

  // CSS properties
  opacity: 0,
  width: '100%',
  height: '200px',
  backgroundColor: '#ff0000',
  color: 'rgb(255, 0, 0)',
  borderRadius: '50%',
  fontSize: '2rem',

  // CSS variables
  '--custom-prop': '100px',

  // HTML attributes
  'data-value': 100,

  // SVG attributes
  cx: 50,
  r: 10,
  fill: '#ff0000',
});
```

### Transform Property Reference

| Shorthand | Full name | Default unit |
|---|---|---|
| `x` | `translateX` | `px` |
| `y` | `translateY` | `px` |
| `z` | `translateZ` | `px` |
| `rotate` | `rotate` | `deg` |
| `rotateX` | `rotateX` | `deg` |
| `rotateY` | `rotateY` | `deg` |
| `scale` | `scale` | — |
| `scaleX` | `scaleX` | — |
| `scaleY` | `scaleY` | — |
| `skew` | `skew` | `deg` |
| `skewX` | `skewX` | `deg` |
| `skewY` | `skewY` | `deg` |
| `perspective` | `perspective` | `px` |

### Tween Value Types

```javascript
animate('.el', {
  x: 100,              // Numeric (uses default unit)
  x: '10rem',          // With unit
  x: '+=50',           // Relative add
  x: '-=50',           // Relative subtract
  x: '*=2',            // Relative multiply
  opacity: [0, 1],     // From → To (array shorthand)
  x: { from: -100, to: 100 },  // Explicit from/to object
  backgroundColor: '#ff0000',   // Color (hex, rgb, hsl)
  x: (target, index, length) => index * 50,  // Function-based
});
```

**Function-based values** — callback receives (target, index, length):
```javascript
animate('.card', {
  x: (el, i, total) => (i - total / 2) * 100,
  delay: (el, i) => i * 50,
  rotate: (el, i, total) => (i / total) * 360,
});
// Recalculate without recreating animation:
animation.refresh();
```

### Playback Parameters

```javascript
animate('.el', {
  x: 100,
  duration: 1000,      // ms, default: 500
  delay: 200,          // ms before start
  loopDelay: 500,      // ms pause between loops (v4) — was endDelay in v3
  ease: 'outQuad',     // easing function
  loop: true,          // infinite loop
  loop: 3,             // repeat 3 times (plays 4 total in v4)
  alternate: true,     // reverse direction each loop
  reversed: false,     // start in reverse
  autoplay: true,      // start immediately (default: true)
  frameRate: 60,       // custom fps cap
  playbackRate: 1,     // speed multiplier (0.5 = half speed)
  playbackEase: 'linear', // easing applied across full playback
  composition: 'replace', // 'replace' | 'add' | 'blend'
});
```

### Callbacks

```javascript
animate('.el', {
  x: 100,
  onBegin: (anim) => console.log('started'),
  onComplete: (anim) => console.log('done'),
  onUpdate: (anim) => console.log(anim.progress),
  onLoop: (anim) => console.log('looped'),
  onPause: (anim) => console.log('paused'),
  onBeforeUpdate: (anim) => {},  // JS only, before value updates
  onRender: (anim) => {},        // JS only, during render phase
});

// Promise-like chaining
animate('.el', { x: 100 }).then(() => {
  animate('.el', { y: 100 });
});
```

### Animation Controls

```javascript
const anim = animate('.el', { x: 100, autoplay: false });

anim.play();          // Play forward from current position
anim.pause();         // Pause at current position
anim.resume();        // Resume from paused position (respects direction)
anim.restart();       // Reset to start and play
anim.reverse();       // Play backward
anim.alternate();     // Toggle direction
anim.complete();      // Jump to end state
anim.reset();         // Return to initial values, stop
anim.cancel();        // Stop and clear
anim.revert();        // Undo all changes, return to DOM original
anim.seek(500);       // Jump to 500ms position
anim.stretch(2000);   // Change total duration to 2000ms
anim.refresh();       // Recalculate function-based values

// Properties
anim.duration;        // Total duration in ms
anim.currentTime;     // Current position in ms
anim.progress;        // 0 to 1
anim.paused;          // boolean
anim.completed;       // boolean
```

---

## Easing Functions

### Built-in Named Easings

```javascript
// Format: 'in', 'out', 'inOut', 'outIn' + curve name
// Parametric: pass strength value like out(3) or inOut(2)

ease: 'linear'
ease: 'in'          // ease: 'in(2)' for quad-equivalent
ease: 'out'         // ease: 'out(3)' for cubic-equivalent
ease: 'inOut'       // ease: 'inOut(4)'
ease: 'outIn'

ease: 'inSine'      // ease: 'outSine'     ease: 'inOutSine'
ease: 'inQuad'      // ease: 'outQuad'     ease: 'inOutQuad'
ease: 'inCubic'     // ease: 'outCubic'    ease: 'inOutCubic'
ease: 'inQuart'     // ease: 'outQuart'    ease: 'inOutQuart'
ease: 'inQuint'     // ease: 'outQuint'    ease: 'inOutQuint'
ease: 'inExpo'      // ease: 'outExpo'     ease: 'inOutExpo'
ease: 'inCirc'      // ease: 'outCirc'     ease: 'inOutCirc'
ease: 'inBack'      // ease: 'outBack'     ease: 'inOutBack'
ease: 'inElastic'   // ease: 'outElastic'  ease: 'inOutElastic'
ease: 'inBounce'    // ease: 'outBounce'   ease: 'inOutBounce'
```

**Note:** v3 used `easeOutQuad` prefix — v4 drops the `ease` prefix: `outQuad`.

### Special Easings

```javascript
// Spring physics (v4)
import { spring } from 'animejs';
ease: spring({ bounce: 0.35 })  // bounce: 0-1 (0 = no bounce)
ease: spring({ mass: 1, stiffness: 100, damping: 10, velocity: 0 })

// v3 spring (legacy):
easing: 'spring(1, 80, 10, 0)'  // mass, stiffness, damping, velocity

// Cubic Bezier
import { cubicBezier } from 'animejs';
ease: cubicBezier(0.7, 0.1, 0.5, 0.9)
ease: 'cubicBezier(.7, .1, .5, .9)'   // string syntax

// Steps
ease: 'steps(5)'               // 5 discrete steps

// Irregular (random organic movement)
ease: 'irregular'

// Default easing in v4: 'out(2)'  (was 'easeOutQuad' in v3)
```

---

## Keyframes

### 1. Array Value Shorthand
Duration between frames is auto-calculated as `total_duration / num_transitions`.

```javascript
animate('.square', {
  translateX: ['0rem', '10rem', '10rem', '0rem'],
  translateY: ['0rem', '0rem', '-5rem', '0rem'],
  scale: [1, 1, 0.5, 1],
  duration: 3000,
  ease: 'inOut',
  loop: true,
});
```

### 2. Per-Keyframe Object Control
Each keyframe is an object with `to`, `from`, `duration`, `ease`, `delay`, `modifier`.

```javascript
animate('.square', {
  x: [
    { to: '17rem', duration: 700, delay: 400, ease: 'outExpo' },
    { to: 0, duration: 700, delay: 800, ease: 'inExpo' },
  ],
  y: [
    { to: '-2.5rem', ease: 'outBounce', duration: 400 },
    { to: '2.5rem', duration: 800, delay: 700 },
    { to: 0, ease: 'inBounce', duration: 400, delay: 700 },
  ],
  duration: 3000,
  loop: true,
});
```

### 3. Percentage-Based Keyframes (CSS @keyframes Style)
Object syntax with percentage string keys. Only `ease` is available per keyframe.

```javascript
animate('.square', {
  keyframes: {
    '0%'  : { x: '0rem',  y: '0rem',    ease: 'out' },
    '25%' : { x: '0rem',  y: '-2.5rem' },
    '50%' : { x: '17rem', y: '-2.5rem', scale: 0.5 },
    '75%' : { x: '17rem', y: '2.5rem',  scale: 0.5 },
    '100%': { x: '0rem',  y: '0rem',    scale: 1, ease: 'in' },
  },
  rotate: { to: '1turn', ease: 'linear' },
  duration: 3000,
  ease: 'inOut',
  playbackEase: 'inOut(5)',
  loop: true,
});
```

### 4. Duration-Based Keyframes
Absolute time positioning in ms.

```javascript
animate('.el', {
  keyframes: [
    { x: 0,   duration: 0    },  // 0ms
    { x: 100, duration: 500  },  // 500ms
    { x: 200, duration: 1000 },  // 1500ms
    { x: 0,   duration: 500  },  // 2000ms
  ],
});
```

---

## Timelines

```javascript
import { createTimeline } from 'animejs';

// v3 equivalent: anime.timeline({ ... })
const tl = createTimeline({
  defaults: { duration: 750, ease: 'inOutSine' },  // Shared defaults
  loop: true,
  alternate: true,
  onComplete: () => console.log('all done'),
});
```

### Position Syntax

```javascript
tl
  .add('.box1', { x: 100 })              // Starts after previous ends
  .add('.box2', { x: 100 }, 200)         // Absolute position: 200ms
  .add('.box3', { x: 100 }, '+=200')     // 200ms after previous END
  .add('.box4', { x: 100 }, '-=100')     // 100ms before previous END
  .add('.box5', { x: 100 }, '<')         // Same start as previous
  .add('.box6', { x: 100 }, '<+=100')    // 100ms after previous START
  .add('.box7', { x: 100 }, '<-=100')    // 100ms before previous START
  .add('.box8', { x: 100 }, 'myLabel')   // At named label position
```

### Labels, Set, Call

```javascript
tl
  .label('phase1')
  .add('.el', { opacity: 1 }, 'phase1')
  .set('.el', { backgroundColor: 'red' }, 500)   // Instant set at 500ms
  .call(() => triggerSomething(), 1000)            // Callback at 1000ms
  .label('phase2')
  .add('.other', { scale: 2 }, 'phase2');
```

### Full Timeline Example

```javascript
const tl = createTimeline({
  defaults: { ease: 'outExpo', duration: 600 },
  onComplete: () => console.log('sequence done'),
});

tl
  .add('.hero-title',    { opacity: [0, 1], y: [30, 0] })
  .add('.hero-subtitle', { opacity: [0, 1], y: [20, 0] }, '-=400')
  .add('.hero-cta',      { opacity: [0, 1], scale: [0.8, 1] }, '-=300')
  .add('.hero-image',    { opacity: [0, 1], x: [50, 0] }, '<');
```

---

## Stagger

```javascript
import { stagger } from 'animejs';

// Basic time stagger
animate('.item', {
  x: 100,
  delay: stagger(100),  // Each element delayed 100ms more
});

// With options
animate('.item', {
  x: 100,
  delay: stagger(100, {
    start: 200,          // Initial offset before first element
    from: 'center',      // 'first' | 'last' | 'center' | index number
    reversed: false,     // Invert order
    ease: 'outQuad',     // Easing applied across stagger distribution
  }),
});

// Value staggering (not just delay)
animate('.bar', {
  height: stagger([10, 200]),   // Distribute heights from 10 to 200
  backgroundColor: stagger(['#ff0000', '#0000ff']),
});

// Grid stagger (2D layout)
animate('.grid-cell', {
  scale: [0, 1],
  delay: stagger(50, {
    grid: [10, 8],     // [columns, rows]
    from: 'center',    // Emanate from center of grid
    axis: 'x',         // 'x' | 'y' — constrain to one axis
  }),
});

// Timeline position staggering
const tl = createTimeline();
tl.add('.item', { x: 100 }, stagger(100));
```

---

## SVG Animations

### Line Drawing with createDrawable()

```javascript
import { animate, svg, stagger } from 'animejs';

// Wrap SVG elements to add `draw` property
const drawables = svg.createDrawable('.svg-path');

// `draw` value: '[start] [end]' — both are 0-1 normalized
animate(drawables, {
  draw: '0 1',           // Reveal full path
  ease: 'inOutQuad',
  duration: 2000,
});

// Draw on, then erase
animate(drawables, {
  draw: ['0 0', '0 1', '1 1'],  // Keyframes: empty → full → erase
  ease: 'inOutQuad',
  duration: 3000,
  delay: stagger(100),
  loop: true,
});

// SVG element must be: line | path | polyline | rect
// GOTCHA: vector-effect: non-scaling-stroke causes perf issues
```

### SVG Morphing with morphTo()

```javascript
import { animate, svg, utils } from 'animejs';

const [source, target] = utils.$('polygon');

animate(source, {
  points: svg.morphTo(target),           // Default precision: 0.33
  ease: 'inOutCirc',
  duration: 800,
  alternate: true,
  loop: true,
});

// With custom precision (0-1, 0 = no extrapolation)
animate('#path1', {
  d: svg.morphTo('#path2', 0.5),
  duration: 1000,
});

// Works with: path (d attr), polyline/polygon (points attr)
```

### Motion Path with createMotionPath()

```javascript
import { animate, svg } from 'animejs';

const motionPath = svg.createMotionPath('#track-path');

animate('.car', {
  ease: 'linear',
  duration: 5000,
  loop: true,
  ...motionPath,  // Spreads translateX, translateY, rotate
});

// With offset (start partway along path, 0-1)
const motionPath = svg.createMotionPath('#track-path', 0.25);
```

---

## Scroll Animations (v4 only)

```javascript
import { animate, onScroll } from 'animejs';

// Trigger animation when element enters viewport
animate('.card', {
  opacity: [0, 1],
  y: [50, 0],
  autoplay: onScroll(),  // Replaces autoplay: true
});

// With options
animate('.section', {
  x: ['-100%', '0%'],
  autoplay: onScroll({
    container: '.scroll-container',  // Default: window
    target: '.section',              // Element to observe (default: animated target)
    axis: 'y',                       // 'x' | 'y' (default: 'y')
    repeat: false,                   // Re-trigger on re-enter (default: false)
    debug: false,                    // Show debug overlay
    enter: 'bottom top',             // When bottom of container meets top of target
    leave: 'top bottom',             // When top of container meets bottom of target
  }),
});

// Scrub animation linked to scroll position
animate('.parallax', {
  y: [0, -200],
  ease: 'linear',
  autoplay: onScroll({
    sync: 0.1,  // Smooth lerp toward scroll-driven position
  }),
});

// Scroll callbacks (standalone)
onScroll({
  target: '.section',
  onEnter: () => console.log('entered'),
  onLeave: () => console.log('left'),
  onEnterForward: () => {},
  onEnterBackward: () => {},
  onLeaveForward: () => {},
  onLeaveBackward: () => {},
  onUpdate: (observer) => {},
});
```

---

## Scopes (v4 only)

Scopes are essential for React/component cleanup and responsive animations.

```javascript
import { createScope, animate } from 'animejs';

const scope = createScope({
  root: document.querySelector('.container'),  // Scope DOM queries to this root
  defaults: { ease: 'outQuad', duration: 500 }, // Shared defaults
  mediaQueries: {
    isMobile: '(max-width: 768px)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  },
});

scope.add((self) => {
  const { isMobile, reduceMotion } = self.matches;

  animate('.hero', {
    x: isMobile ? 0 : ['-35vw', '35vw'],
    duration: reduceMotion ? 0 : isMobile ? 500 : 1000,
  });

  // Register named methods callable from outside scope
  self.add('playEntrance', () => {
    animate('.hero', { opacity: [0, 1], y: [20, 0] });
  });

  self.add('playExit', () => {
    animate('.hero', { opacity: 0 });
  });
});

// Call registered methods
scope.methods.playEntrance();

// IMPORTANT: Revert all animations at once (cleanup)
scope.revert();

// Refresh on resize / media query change
scope.refresh();
```

---

## Draggable (v4 only)

```javascript
import { createDraggable } from 'animejs';

const draggable = createDraggable('.drag-target', {
  container: '.drag-area',      // Constrain within element
  containerPadding: 20,          // Padding inside container boundary
  containerFriction: 0.85,       // Resistance at container edge
  x: { snap: 50 },              // Snap to 50px grid on x
  y: false,                      // Disable vertical dragging
  releaseMass: 1,
  releaseStiffness: 200,
  releaseDamping: 20,
  dragSpeed: 1,
  cursor: 'grab',
  onGrab: (draggable) => {},
  onDrag: (draggable) => {},
  onRelease: (draggable) => {},
  onSettle: (draggable) => {},
  onSnap: (draggable) => {},
});

draggable.enable();
draggable.disable();
draggable.setX(100);
draggable.setY(50);
draggable.stop();
draggable.reset();
```

---

## React Patterns

### Pattern 1: Basic useEffect + useRef

```jsx
import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

function AnimatedCard() {
  const cardRef = useRef(null);

  useEffect(() => {
    const anim = animate(cardRef.current, {
      opacity: [0, 1],
      y: [30, 0],
      duration: 600,
      ease: 'outExpo',
    });
    return () => anim.revert();
  }, []);

  return <div ref={cardRef} className="card">Content</div>;
}
```

### Pattern 2: createScope (Recommended for Complex Animations)

```jsx
import { useEffect, useRef } from 'react';
import { createScope, animate, stagger } from 'animejs';

function AnimatedList() {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      // All selectors are scoped to root.current
      animate('.list-item', {
        opacity: [0, 1],
        x: [-20, 0],
        delay: stagger(80),
        duration: 500,
        ease: 'outQuad',
      });

      // Register methods for event handlers
      self.add('animateIn', () => {
        animate('.list-item', { opacity: 1, x: 0, delay: stagger(50) });
      });

      self.add('animateOut', () => {
        animate('.list-item', { opacity: 0, x: -20, delay: stagger(50) });
      });
    });

    // CRITICAL: Cleanup reverts all animations when component unmounts
    return () => scope.current.revert();
  }, []); // Empty deps — scope created once on mount

  return (
    <div ref={root}>
      {items.map(item => (
        <div key={item.id} className="list-item">{item.text}</div>
      ))}
      <button onClick={() => scope.current.methods.animateIn()}>
        Animate In
      </button>
    </div>
  );
}
```

### Pattern 3: Hover / State-Based Animation

```jsx
import { useRef } from 'react';
import { animate } from 'animejs';

function HoverCard() {
  const cardRef = useRef(null);
  const animRef = useRef(null);

  const handleMouseEnter = () => {
    if (animRef.current) animRef.current.pause();
    animRef.current = animate(cardRef.current, {
      scale: 1.05,
      y: -5,
      duration: 300,
      ease: 'outBack',
    });
  };

  const handleMouseLeave = () => {
    if (animRef.current) animRef.current.pause();
    animRef.current = animate(cardRef.current, {
      scale: 1,
      y: 0,
      duration: 300,
      ease: 'outQuad',
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-block' }}
    >
      Hover me
    </div>
  );
}
```

### Pattern 4: Scroll-Triggered in React

```jsx
import { useEffect, useRef } from 'react';
import { createScope, animate, stagger, onScroll } from 'animejs';

function ScrollSection() {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate('.fade-in', {
        opacity: [0, 1],
        y: [40, 0],
        duration: 700,
        ease: 'outExpo',
        delay: stagger(100),
        autoplay: onScroll({ repeat: false }),
      });
    });
    return () => scope.current.revert();
  }, []);

  return (
    <section ref={root}>
      <div className="fade-in">Item 1</div>
      <div className="fade-in">Item 2</div>
      <div className="fade-in">Item 3</div>
    </section>
  );
}
```

---

## Next.js / SSR Patterns

```jsx
// GOTCHA: Anime.js manipulates the DOM — it must only run client-side.

// Pattern 1: Dynamic import with ssr: false (Pages Router)
import dynamic from 'next/dynamic';
const AnimatedComponent = dynamic(
  () => import('../components/AnimatedComponent'),
  { ssr: false }
);

// Pattern 2: 'use client' directive (App Router — preferred)
'use client';
import { useEffect, useRef } from 'react';
import { animate, createScope } from 'animejs';

export default function HeroSection() {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    // Safe: only runs in browser after hydration
    scope.current = createScope({ root }).add(() => {
      animate('.hero-title', {
        opacity: [0, 1],
        y: [20, 0],
        duration: 800,
        ease: 'outExpo',
      });
    });
    return () => scope.current.revert();
  }, []);

  return (
    <section ref={root}>
      <h1 className="hero-title">Hello</h1>
    </section>
  );
}

// Pattern 3: typeof window guard (Pages Router fallback)
useEffect(() => {
  if (typeof window === 'undefined') return;
  // anime.js code here
}, []);

// GOTCHA: Never import anime.js at top level in Pages Router SSR context
// GOTCHA: Always start animations from element's default state to avoid
//         hydration mismatches on server-rendered elements
```

---

## Vanilla JavaScript Patterns

```javascript
import { animate, stagger } from 'animejs';

// Entrance animation
animate('.hero h1', {
  opacity: [0, 1],
  y: [40, 0],
  duration: 800,
  ease: 'outExpo',
});

// Chained sequence
animate('.step-1', { x: 100, duration: 500 })
  .then(() => animate('.step-2', { x: 100, duration: 500 }))
  .then(() => animate('.step-3', { x: 100, duration: 500 }));

// Counter animation
const counter = { value: 0 };
const el = document.querySelector('#counter');
animate(counter, {
  value: 1250,
  duration: 2000,
  ease: 'outExpo',
  onUpdate: () => el.textContent = Math.round(counter.value),
});
```

---

## Common Animation Patterns

### Entrance Animations

```javascript
// Fade in up (most common entrance)
animate('.element', {
  opacity: [0, 1],
  y: [30, 0],
  duration: 600,
  ease: 'outExpo',
});

// Staggered list entrance
animate('.list-item', {
  opacity: [0, 1],
  x: [-20, 0],
  duration: 500,
  delay: stagger(80, { from: 'first' }),
  ease: 'outQuad',
});

// Scale in
animate('.modal', {
  opacity: [0, 1],
  scale: [0.8, 1],
  duration: 400,
  ease: 'outBack',
});

// Slide in from left
animate('.sidebar', {
  x: ['-100%', '0%'],
  duration: 500,
  ease: 'outCubic',
});
```

### Hover Effects

```javascript
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    animate(card, { scale: 1.05, duration: 200, ease: 'outQuad' });
  });
  card.addEventListener('mouseleave', () => {
    animate(card, { scale: 1, duration: 200, ease: 'outQuad' });
  });
});
```

### Loading Animations

```javascript
// Rotating spinner
animate('.spinner', {
  rotate: '1turn',
  duration: 1000,
  ease: 'linear',
  loop: true,
});

// Pulsing dots
animate('.dot', {
  scale: [1, 1.5, 1],
  opacity: [1, 0.5, 1],
  duration: 800,
  ease: 'inOutSine',
  loop: true,
  delay: stagger(150),
});

// Progress bar
animate('.progress-bar', {
  width: ['0%', '100%'],
  duration: 2000,
  ease: 'outCubic',
});
```

### Number Counter

```javascript
const obj = { val: 0 };
animate(obj, {
  val: 9999,
  duration: 2000,
  ease: 'outExpo',
  onUpdate: () => {
    document.querySelector('.counter').textContent =
      Math.round(obj.val).toLocaleString();
  },
});
```

### Page Transitions

```javascript
// Exit current page
async function exitPage() {
  await animate('main', {
    opacity: [1, 0],
    y: [0, -20],
    duration: 300,
    ease: 'inQuad',
  });
}

// Enter new page
function enterPage() {
  animate('main', {
    opacity: [0, 1],
    y: [20, 0],
    duration: 400,
    ease: 'outExpo',
  });
}
```

### Text Split Animation

```javascript
import { animate, stagger, splitText } from 'animejs';

const { chars } = splitText('.headline', { chars: true, words: false });

animate(chars, {
  opacity: [0, 1],
  y: [10, 0],
  duration: 400,
  delay: stagger(30),
  ease: 'outExpo',
});
```

---

## Performance Best Practices

```javascript
// GOOD: Use transform properties — GPU composited, no layout
animate('.el', { x: 100, y: 50, scale: 1.2, rotate: 45 });

// BAD: Triggers layout recalc (reflow)
animate('.el', { left: '100px', top: '50px', width: '200px', marginTop: 20 });

// GOOD: Use opacity for fades (GPU layer)
animate('.el', { opacity: 0 });

// BAD: Setting display:none mid-animation causes reflow
// Do it after animation completes instead:
animate('.el', {
  opacity: 0,
  onComplete: (anim) => anim.targets[0].style.display = 'none',
});

// will-change hint for complex animations (remove after to free GPU memory)
// CSS:
// .animated-element { will-change: transform, opacity; }
animate('.el', {
  x: 100,
  onComplete: (anim) => anim.targets[0].style.willChange = 'auto',
});

// Batch similar animations in one call (not per-element loops)
animate('.card', { opacity: [0, 1], y: [20, 0], delay: stagger(100) });

// composition modes for overlapping animations
animate('.el', {
  x: 100,
  composition: 'add',    // Adds to existing transforms (great for layering)
  // 'replace' (default): Overrides existing
  // 'blend': Weighted blend
});
```

---

## Accessibility

```javascript
// Manual check
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

animate('.hero', {
  opacity: [0, 1],
  y: reduceMotion ? 0 : [30, 0],    // No movement if reduced
  duration: reduceMotion ? 100 : 800, // Fast fade instead
  ease: 'outExpo',
});

// Using createScope (v4 recommended approach)
createScope({
  mediaQueries: {
    reduceMotion: '(prefers-reduced-motion: reduce)',
  },
}).add((self) => {
  const { reduceMotion } = self.matches;

  animate('.animated', {
    opacity: [0, 1],
    y: reduceMotion ? [0, 0] : [30, 0],
    duration: reduceMotion ? 50 : 700,
  });
});

// Rules:
// - Add aria-hidden="true" on purely decorative animated elements
// - Avoid flashing content > 3 times/second (WCAG 2.3.1)
// - Always provide a way to pause/stop looping animations
```

---

## Engine Configuration

```javascript
import { engine } from 'animejs';

engine.pauseOnDocumentHidden = true;  // Pause when tab inactive (default: true)
engine.speed = 1;                      // Global speed multiplier
engine.fps = 60;                       // Global frame rate cap
engine.precision = 4;                  // Decimal precision for values
engine.timeUnit = 'ms';               // 'ms' | 's'

// Manual animation loop (advanced)
engine.useDefaultMainLoop = false;
function myLoop() {
  engine.update();
  requestAnimationFrame(myLoop);
}
requestAnimationFrame(myLoop);
```

---

## Utility Functions

```javascript
import { utils } from 'animejs';

// DOM
const els = utils.$('.items');              // querySelectorAll shorthand → Array
const val = utils.get(el, 'translateX');    // Get computed anime value
utils.set(el, { x: 100, opacity: 0.5 });   // Set values immediately (no animation)
utils.remove(el, animation);               // Remove target from animation
utils.cleanInlineStyles(el);               // Remove anime inline styles

// Math
utils.clamp(value, min, max);             // Clamp between range
utils.snap(value, snapTo);               // Snap to nearest increment
utils.wrap(value, min, max);             // Wrap around range
utils.mapRange(val, inMin, inMax, outMin, outMax); // Remap value
utils.lerp(start, end, progress);        // Linear interpolation
utils.damp(current, target, factor, deltaTime); // Smooth damping
utils.round(decimals)(value);            // Round to N decimals (curried)

// Random
utils.random(min, max);                  // Random number in range
utils.random(min, max, decimals);        // With decimal precision
utils.randomPick(array);                 // Pick random item
utils.shuffle(array);                    // Shuffle in place

// Angles
utils.degToRad(degrees);
utils.radToDeg(radians);
```

---

## Common Gotchas

1. **Selector scope in React**: Without `createScope`, `.class` selects from the entire document, not the component. Always use `createScope({ root })`.

2. **Multiple animations on same property**: The last `animate()` call wins by default. Use `composition: 'add'` to layer animations on the same element/property.

3. **loop: 1 in v4 means 2 total iterations**: It plays once, then repeats once. To play exactly once: omit `loop` or use `loop: false`.

4. **play() vs resume() in v4**: `play()` always plays forward from current position. `resume()` continues in whatever direction the animation was going before pause.

5. **onBegin respects delay in v4**: In v3, `begin` fired immediately when animate() was called. In v4, `onBegin` fires after the `delay` completes.

6. **Cleanup in React**: Always return `() => scope.current.revert()` or `() => anim.revert()` from useEffect. Without this, animations continue running after component unmounts, causing memory leaks and ghost state updates.

7. **SSR crash**: Never run anime.js at module level in SSR contexts. Import inside `useEffect`, use `'use client'`, or use `dynamic({ ssr: false })` in Next.js.

8. **SVG non-scaling-stroke perf**: Avoid `vector-effect: non-scaling-stroke` on animated SVG elements — it forces CPU recalculation on every frame.

9. **transform vs position**: Always prefer `x`/`y` (translateX/Y) over `left`/`top`. Transform animations never trigger layout; position animations do.

10. **Empty useEffect deps `[]`**: The scope useEffect should have `[]` as dependencies. Recreating the scope on every render causes double animations and cleanup issues.

11. **stagger returns a function, not a value**: `delay: stagger(100)` passes a function. Anime.js calls it per target internally. Never call `stagger()()` yourself.

12. **CSS units for non-transform properties**: When animating `width`, `height`, or positional CSS, specify units explicitly: `width: '100%'` not `width: 100`. Transforms default to px and don't need units.
