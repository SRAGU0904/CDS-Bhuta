"use client";

import { useEffect, useRef, useState } from "react";
import type { ControlMode } from "./types";

export function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    audio.loop = true;
  }, []);

  const toggleMusic = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!isPlaying) {
        audio.muted = false;
        audio.currentTime = audio.currentTime || 0;
        await audio.play();
        setIsPlaying(true);
        setIsMuted(false);
        return;
      }
      audio.muted = !audio.muted;
      setIsMuted(audio.muted);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bg-2.mp3" preload="auto" />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={toggleMusic}
        className="fixed right-6 top-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Toggle music"
      >
        {isPlaying && !isMuted ? "🔊" : "🔇"}
      </button>
    </>
  );
}

export function ControlModeToggle({
  mode,
  onToggle,
}: {
  mode: ControlMode;
  onToggle: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onToggle}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-black/70"
      aria-label="Toggle rotation control mode"
    >
      {mode === "phone" ? "Phone Control" : "Mouse Control"}
    </button>
  );
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function PanoramaCanvas({
  yaw,
  baseYaw,
  className,
}: {
  yaw: number;
  baseYaw: number;
  className: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderRef = useRef<((yaw: number) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;

    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      `
        attribute vec2 aPosition;
        varying vec2 vUv;

        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `
    );
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      `
        precision mediump float;

        uniform sampler2D uTexture;
        uniform float uYaw;
        uniform float uHorizontalFov;
        uniform float uAspect;
        varying vec2 vUv;

        const float PI = 3.141592653589793;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float halfWidth = tan(uHorizontalFov * 0.5);
          vec3 dir = normalize(vec3(
            p.x * halfWidth,
            p.y * halfWidth / uAspect,
            -1.0
          ));

          float longitude = atan(dir.x, -dir.z) + uYaw;
          float latitude = asin(clamp(dir.y, -1.0, 1.0));
          vec2 panoUv = vec2(
            fract(0.5 + longitude / (2.0 * PI)),
            0.5 + latitude / PI
          );

          vec4 color = texture2D(uTexture, panoUv);
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          color.rgb = mix(vec3(gray), color.rgb, 0.8);
          color.rgb *= 0.5;
          gl_FragColor = color;
        }
      `
    );
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const textureLocation = gl.getUniformLocation(program, "uTexture");
    const yawLocation = gl.getUniformLocation(program, "uYaw");
    const fovLocation = gl.getUniformLocation(program, "uHorizontalFov");
    const aspectLocation = gl.getUniformLocation(program, "uAspect");

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(fovLocation, Math.PI / 3);

    const image = new Image();
    image.src = "/image/background image2.png";

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(aspectLocation, rect.width / rect.height);
    };

    const draw = (nextYaw: number) => {
      resize();
      gl.uniform1f(yawLocation, baseYaw - nextYaw);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      renderRef.current = draw;
      draw(yaw);
    };

    const observer = new ResizeObserver(() => renderRef.current?.(yaw));
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      renderRef.current = null;
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
    };
  }, [baseYaw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    renderRef.current?.(yaw);
  }, [yaw]);

  return <canvas ref={canvasRef} className={className} />;
}

export function PanoramaFrames({ yaw }: { yaw: number }) {
  const frameClass =
    "absolute top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 overflow-hidden rounded-3xl";

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <PanoramaCanvas
        yaw={yaw}
        baseYaw={0}
        className={`${frameClass} left-[15vw]`}
      />
      <PanoramaCanvas
        yaw={yaw}
        baseYaw={Math.PI}
        className={`${frameClass} right-[15vw]`}
      />
    </div>
  );
}

export function ViewFrames() {
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <div className="absolute left-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
      <div className="absolute right-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
    </div>
  );
}
