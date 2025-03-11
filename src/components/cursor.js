"use client"

import React, { useRef, useEffect } from "react";

export const Cursor = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // canvas のサイズ設定
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const config = {
      TEXTURE_DOWNSAMPLE: 1,
      DENSITY_DISSIPATION: 0.95,
      VELOCITY_DISSIPATION: 0.95,
      PRESSURE_DISSIPATION: 0.99,
      PRESSURE_ITERATIONS: 99,
      CURL: 0.9,
      SPLAT_RADIUS: 0.0009,
    };

    // 固定の油彩 (oil slick) 6色パレット（例）
    const oilSlickColors = [
      [0.1, 0.0, 0.0],
      [1.0, 1.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 1.0, 1.0],
      [0.0, 0.0, 1.0],
      [1.0, 0.0, 1.0],
    ]

    // ポインター情報は id ごとに管理する
    const pointers = [];
    const splatStack = [];

    // WebGL コンテキスト取得
    const { gl, ext } = getWebGLContext(canvas);

    function getWebGLContext(canvas) {
      const params = { alpha: false, depth: false, stencil: false, antialias: false };
      let gl = canvas.getContext("webgl2", params);
      const isWebGL2 = !!gl;
      if (!isWebGL2)
        gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);

      let halfFloat, supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
      } else {
        halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
      }

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
      let formatRGBA, formatRG, formatR;
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }
      return {
        gl,
        ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering },
      };
    }

    function getSupportedFormat(gl, internalFormat, format, type) {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
          case gl.R16F:
            return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
          case gl.RG16F:
            return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
          default:
            return null;
        }
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(gl, internalFormat, format, type) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }

    // Pointer クラスで各ポインターを管理
    class Pointer {
      constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.dx = 0;
        this.dy = 0;
        this.down = false;
        this.moved = false;
      }
    }

    // GLProgram やシェーダーの定義は変わらず
    class GLProgram {
      constructor(vertexShader, fragmentShader) {
        this.uniforms = {};
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
          throw gl.getProgramInfoLog(this.program);
        const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
          const uniformName = gl.getActiveUniform(this.program, i).name;
          this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
        }
      }
      bind() {
        gl.useProgram(this.program);
      }
    }

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw gl.getShaderInfoLog(shader);
      return shader;
    };

    // 各種シェーダーの定義（内容は変更せず）
    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `);

    const displayShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
          gl_FragColor = texture2D(uTexture, vUv);
      }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + splat, 1.0);
      }
    `);

    const advectionManualFilteringShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      vec4 bilerp (in sampler2D sam, in vec2 p) {
          vec4 st;
          st.xy = floor(p - 0.5) + 0.5;
          st.zw = st.xy + 1.0;
          vec4 uv = st * texelSize.xyxy;
          vec4 a = texture2D(sam, uv.xy);
          vec4 b = texture2D(sam, uv.zy);
          vec4 c = texture2D(sam, uv.xw);
          vec4 d = texture2D(sam, uv.zw);
          vec2 f = p - st.xy;
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main () {
          vec2 coord = gl_FragCoord.xy - dt * texture2D(uVelocity, vUv).xy;
          gl_FragColor = dissipation * bilerp(uSource, coord);
          gl_FragColor.a = 1.0;
      }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main () {
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          gl_FragColor = dissipation * texture2D(uSource, coord);
          gl_FragColor.a = 1.0;
      }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      vec2 sampleVelocity (in vec2 uv) {
          vec2 multiplier = vec2(1.0, 1.0);
          if (uv.x < 0.0) { uv.x = 0.0; multiplier.x = -1.0; }
          if (uv.x > 1.0) { uv.x = 1.0; multiplier.x = -1.0; }
          if (uv.y < 0.0) { uv.y = 0.0; multiplier.y = -1.0; }
          if (uv.y > 1.0) { uv.y = 1.0; multiplier.y = -1.0; }
          return multiplier * texture2D(uVelocity, uv).xy;
      }
      void main () {
          float L = sampleVelocity(vL).x;
          float R = sampleVelocity(vR).x;
          float T = sampleVelocity(vT).y;
          float B = sampleVelocity(vB).y;
          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
          float L = texture2D(uVelocity, vL).y;
          float R = texture2D(uVelocity, vR).y;
          float T = texture2D(uVelocity, vT).x;
          float B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
      }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
          float T = texture2D(uCurl, vT).x;
          float B = texture2D(uCurl, vB).x;
          float C = texture2D(uCurl, vUv).x;
          vec2 force = vec2(abs(T) - abs(B), 0.0);
          force *= 1.0 / length(force + 0.00001) * curl * C;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      vec2 boundary (in vec2 uv) {
          return min(max(uv, 0.0), 1.0);
      }
      void main () {
          float L = texture2D(uPressure, boundary(vL)).x;
          float R = texture2D(uPressure, boundary(vR)).x;
          float T = texture2D(uPressure, boundary(vT)).x;
          float B = texture2D(uPressure, boundary(vB)).x;
          float divergence = texture2D(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      vec2 boundary (in vec2 uv) {
          return min(max(uv, 0.0), 1.0);
      }
      void main () {
          float L = texture2D(uPressure, boundary(vL)).x;
          float R = texture2D(uPressure, boundary(vR)).x;
          float T = texture2D(uPressure, boundary(vT)).x;
          float B = texture2D(uPressure, boundary(vB)).x;
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    // フレームバッファ関連変数
    let textureWidth, textureHeight;
    let density, velocity, divergence, curl, pressure;
    initFramebuffers();

    const clearProgram = new GLProgram(baseVertexShader, clearShader);
    const displayProgram = new GLProgram(baseVertexShader, displayShader);
    const splatProgram = new GLProgram(baseVertexShader, splatShader);
    const advectionProgram = new GLProgram(
      baseVertexShader,
      ext.supportLinearFiltering ? advectionShader : advectionManualFilteringShader
    );
    const divergenceProgram = new GLProgram(baseVertexShader, divergenceShader);
    const curlProgram = new GLProgram(baseVertexShader, curlShader);
    const vorticityProgram = new GLProgram(baseVertexShader, vorticityShader);
    const pressureProgram = new GLProgram(baseVertexShader, pressureShader);
    const gradientSubtractProgram = new GLProgram(baseVertexShader, gradientSubtractShader);

    function initFramebuffers() {
      textureWidth = gl.drawingBufferWidth >> config.TEXTURE_DOWNSAMPLE;
      textureHeight = gl.drawingBufferHeight >> config.TEXTURE_DOWNSAMPLE;
      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      density = createDoubleFBO(2, textureWidth, textureHeight, rgba.internalFormat, rgba.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST);
      velocity = createDoubleFBO(0, textureWidth, textureHeight, rg.internalFormat, rg.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST);
      divergence = createFBO(4, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(5, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(6, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function createFBO(texId, w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0 + texId);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return [texture, fbo, texId];
    }

    function createDoubleFBO(texId, w, h, internalFormat, format, type, param) {
      let fbo1 = createFBO(texId, w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(texId + 1, w, h, internalFormat, format, type, param);
      return {
        get read() { return fbo1; },
        get write() { return fbo2; },
        swap() { [fbo1, fbo2] = [fbo2, fbo1]; },
      };
    }

    // blit はバッファを一度だけ生成
    const blit = (() => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      const elemBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return (destination) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    let lastTime = Date.now();
    // 初回は複数スプラット（固定パレットを使用）
    multipleSplats(Math.floor(Math.random() * 20) + 5);
    let animationFrameId;
    function update() {
      resizeCanvas();
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.016);
      lastTime = now;

      gl.viewport(0, 0, textureWidth, textureHeight);
      if (splatStack.length > 0) multipleSplats(splatStack.pop());

      // 速度のアドベクション
      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2]);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write[1]);
      velocity.swap();

      // 密度のアドベクション
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
      gl.uniform1i(advectionProgram.uniforms.uSource, density.read[2]);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(density.write[1]);
      density.swap();

      // ポインターからのスプラット処理（7色 oil slick を一度に描画）
      pointers.forEach(pointer => {
        if (pointer.moved) {
          splatMulti(pointer.x, pointer.y, pointer.dx, pointer.dy);
          pointer.moved = false;
        }
      });

      // カール計算
      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read[2]);
      blit(curl[1]);

      // 渦の適用
      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read[2]);
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl[2]);
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write[1]);
      velocity.swap();

      // 発散の計算
      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2]);
      blit(divergence[1]);

      // 圧力の減衰
      clearProgram.bind();
      let pressureTexId = pressure.read[2];
      gl.activeTexture(gl.TEXTURE0 + pressureTexId);
      gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]);
      gl.uniform1i(clearProgram.uniforms.uTexture, pressureTexId);
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION);
      blit(pressure.write[1]);
      pressure.swap();

      // 圧力計算
      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2]);
      pressureTexId = pressure.read[2];
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressureTexId);
      gl.activeTexture(gl.TEXTURE0 + pressureTexId);
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]);
        blit(pressure.write[1]);
        pressure.swap();
      }

      // 速度に勾配を反映
      gradientSubtractProgram.bind();
      gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight);
      gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read[2]);
      gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read[2]);
      blit(velocity.write[1]);
      velocity.swap();

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      displayProgram.bind();
      gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2]);
      blit(null);

      animationFrameId = requestAnimationFrame(update);
    }

    // --- 新たに定義するスプラット関連関数 ---
    // 速度用スプラット
    function splatVelocity(x, y, dx, dy) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read[2]);
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1 - y / canvas.height);
      gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS);
      blit(velocity.write[1]);
      velocity.swap();
    }

    // 密度用スプラット（color と座標を指定）
    function splatDensity(x, y, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, density.read[2]);
      gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1 - y / canvas.height);
      gl.uniform3f(splatProgram.uniforms.color, color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS);
      blit(density.write[1]);
      density.swap();
    }

    // 1回のイベントで7色のスプラッシュを生成（速度スプラットは1回、密度スプラットは各色で行う）
    function splatMulti(x, y, dx, dy) {
      // 速度スプラット（全体の動きを加える）
      splatVelocity(x, y, dx, dy);
      // 各色ごとに小さなオフセットをつけて密度スプラット
      const offsetRadius = 20; // オフセット量（必要に応じて調整）
      for (let i in oilSlickColors) {
        const angle = (i / oilSlickColors.length) * Math.PI * 2;
        const offsetX = Math.cos(angle) * offsetRadius;
        const offsetY = Math.sin(angle) * offsetRadius;
        splatDensity(x + offsetX, y + offsetY, oilSlickColors[i]);
      }
    }

    // 複数スプラットの実行（固定パレットを使用）
    function multipleSplats(amount) {
      for (let i = 0; i < amount; i++) {
        const x = canvas.width * Math.random();
        const y = canvas.height * Math.random();
        const dx = 1000 * (Math.random() - 0.5);
        const dy = 1000 * (Math.random() - 0.5);
        splatMulti(x, y, dx, dy);
      }
    }

    function resizeCanvas() {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        initFramebuffers();
      }
    }

    // ポインターイベントのハンドラ
    const pointerDownHandler = (e) => {
      e.preventDefault();
      let pointer = pointers.find(p => p.id === e.pointerId);
      if (!pointer) {
        pointer = new Pointer(e.pointerId);
        pointers.push(pointer);
      }
      pointer.down = true;
      pointer.x = e.offsetX;
      pointer.y = e.offsetY;
      // ここでは色は固定パレットを使うので設定不要
    };

    const pointerMoveHandler = (e) => {
      e.preventDefault();
      let pointer = pointers.find(p => p.id === e.pointerId);
      if (!pointer) {
        pointer = new Pointer(e.pointerId);
        pointers.push(pointer);
      }
      if (pointer.down) {
        pointer.moved = true;
        pointer.dx = (e.offsetX - pointer.x) * 10.0;
        pointer.dy = (e.offsetY - pointer.y) * 10.0;
      }
      pointer.x = e.offsetX;
      pointer.y = e.offsetY;
    };

    const pointerUpHandler = (e) => {
      e.preventDefault();
      let pointer = pointers.find(p => p.id === e.pointerId);
      if (pointer) pointer.down = false;
    };

    const pointerCancelHandler = (e) => {
      e.preventDefault();
      let pointer = pointers.find(p => p.id === e.pointerId);
      if (pointer) pointer.down = false;
    };

    // イベントリスナーの登録（ポインターイベントのみ）
    window.addEventListener("pointerdown", pointerDownHandler);
    window.addEventListener("pointermove", pointerMoveHandler);
    window.addEventListener("pointerup", pointerUpHandler);
    window.addEventListener("pointercancel", pointerCancelHandler);

    // アニメーション開始
    update();

    // クリーンアップ
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointerdown", pointerDownHandler);
      window.removeEventListener("pointermove", pointerMoveHandler);
      window.removeEventListener("pointerup", pointerUpHandler);
      window.removeEventListener("pointercancel", pointerCancelHandler);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 size-full"/>;
};
