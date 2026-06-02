"use client";

import { useEffect, useRef } from "react";

import * as THREE from "three";

/* ============================================================
   ShaderAnimation — full-bleed WebGL fragment-shader backdrop.

   Renders a single PlaneGeometry covering the viewport, animated
   by `time` uniform. The fragment shader draws three colour
   channels of concentric distance-field rings that drift over
   time, producing a moving radial pattern.

   Defaults to `w-full h-screen` to match the imported snippet
   exactly. Pass `className` to use it as a positioned backdrop
   (e.g. `absolute inset-0`) without forcing 100vh.
   ============================================================ */

interface SceneRefs {
    camera: THREE.Camera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    uniforms: { [uniform: string]: THREE.IUniform };
    animationId: number;
}

interface ShaderAnimationProps {
    className?: string;
}

export function ShaderAnimation({
    className = "w-full h-screen",
}: ShaderAnimationProps = {}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneRefs | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;

        // Vertex shader — passes geometry through unchanged.
        const vertexShader = `
      void main() {
        gl_Position = vec4( position, 1.0 );
      }
    `;

        // Fragment shader — three nested colour-channel loops drawing
        // distance-field rings that drift on the `time` uniform.
        const fragmentShader = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time*0.05;
        float lineWidth = 0.002;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i=0; i < 5; i++){
            color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*5.0 - length(uv) + mod(uv.x+uv.y, 0.2));
          }
        }

        gl_FragColor = vec4(color[0],color[1],color[2],1.0);
      }
    `;

        // Three.js scene: a single plane covering NDC space; the camera
        // is a base Camera (no projection) since the vertex shader emits
        // clip-space directly.
        const camera = new THREE.Camera();
        camera.position.z = 1;

        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(2, 2);

        const uniforms: { [uniform: string]: THREE.IUniform } = {
            time: { value: 1.0 },
            resolution: { value: new THREE.Vector2() },
        };

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // WebGL guard: headless browsers, blocklisted GPUs, and "WebGL
        // disabled" privacy settings make context creation throw. This is a
        // decorative backdrop, so fail soft — the parent section keeps its
        // solid dark background and the sign-in form stays usable, instead of
        // the whole page crashing to the error boundary.
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
        } catch (err) {
            console.warn(
                "ShaderAnimation: WebGL unavailable — skipping animated backdrop.",
                err,
            );
            geometry.dispose();
            material.dispose();
            return;
        }
        // Cap pixel ratio. Many mobile devices report a devicePixelRatio of 3,
        // which means 9× the fragment-shader work per frame — visible heat and
        // battery drain. Capping at 1.5 is a near-imperceptible visual change
        // and roughly 4× cheaper to shade.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        // Respect prefers-reduced-motion: render a single frame so the canvas
        // still shows the shader pattern, then skip the rAF loop entirely.
        const reduceMotion =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const onWindowResize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            renderer.setSize(width, height);
            uniforms.resolution.value.x = renderer.domElement.width;
            uniforms.resolution.value.y = renderer.domElement.height;
        };

        onWindowResize();
        window.addEventListener("resize", onWindowResize, false);

        const animate = () => {
            // Skip the rAF loop entirely under prefers-reduced-motion: we render
            // one frame above and call it done. The shader pattern is still
            // visible; just no continuous time-driven evolution.
            if (reduceMotion) {
                renderer.render(scene, camera);
                return;
            }
            const animationId = requestAnimationFrame(animate);
            uniforms.time.value += 0.05;
            renderer.render(scene, camera);
            if (sceneRef.current) {
                sceneRef.current.animationId = animationId;
            }
        };

        sceneRef.current = {
            camera,
            scene,
            renderer,
            uniforms,
            animationId: 0,
        };

        animate();

        return () => {
            window.removeEventListener("resize", onWindowResize);
            if (sceneRef.current) {
                cancelAnimationFrame(sceneRef.current.animationId);
                if (container && sceneRef.current.renderer.domElement) {
                    container.removeChild(sceneRef.current.renderer.domElement);
                }
                sceneRef.current.renderer.dispose();
                geometry.dispose();
                material.dispose();
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                background: "#000",
                overflow: "hidden",
            }}
        />
    );
}
