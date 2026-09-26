import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Cinematic grade: contrast, warm/teal split toning, vignette, film grain, and a desaturate knob for "CODE BLUE". */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uGray: { value: 0 },
    uDanger: { value: 0 },
    uVignette: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGray, uDanger, uVignette;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // gentle S-curve contrast
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
      // split toning: teal shadows, warm highlights
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += mix(vec3(-0.01, 0.015, 0.03), vec3(0.035, 0.015, -0.02), smoothstep(0.2, 0.8, l));
      // saturation boost, or full desaturation when the patient codes
      col = mix(vec3(l), col, 1.12 - uGray * 1.12);
      // vignette (turns red as the patient deteriorates)
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d) * uVignette * 1.25);
      col *= mix(0.55, 1.0, v);
      col = mix(col, vec3(0.75, 0.05, 0.05), (1.0 - v) * uDanger * 0.6);
      // film grain
      col += (rand(vUv + fract(uTime)) - 0.5) * 0.025;
      gl_FragColor = vec4(col, c.a);
    }`,
};

export class PostFX {
  private composer: EffectComposer;
  private grade: ShaderPass;
  private bloom: UnrealBloomPass;
  enabled = true;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.4, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
  }

  set(opts: { gray?: number; danger?: number }) {
    if (opts.gray !== undefined) this.grade.uniforms.uGray.value = opts.gray;
    if (opts.danger !== undefined) this.grade.uniforms.uDanger.value = opts.danger;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, t: number) {
    if (!this.enabled) {
      this.renderer.render(scene, camera);
      return;
    }
    this.grade.uniforms.uTime.value = t;
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}
