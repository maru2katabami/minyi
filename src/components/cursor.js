"use client"

import React, { useRef, useEffect } from "react"

export const Cursor = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Canvasサイズの初期設定
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    let animationFrameId
    let lastTime = Date.now()

    // 各種設定パラメータ
    const config = {
      TEXTURE_DOWNSAMPLE: 0,
      DENSITY_DISSIPATION: 0.9,
      VELOCITY_DISSIPATION: 0.99,
      PRESSURE_DISSIPATION: 0.9,
      PRESSURE_ITERATIONS: 99,
      CURL: 9,
      SPLAT_RADIUS: 0.0009,
    }

    // Pointerオブジェクトの作成（初期値設定）
    const createPointer = () => ({
      id: -1,
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      down: false,
      moved: false,
      color: [30, 0, 300],
    })
    const pointers = [createPointer()]

    const splatStack = []

    // テクスチャ形式のサポート確認
    const supportRenderTextureFormat = (gl, intFmt, fmt, type) => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, 4, 4, 0, fmt, type, null)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }

    // サポートされるフォーマットの取得
    const getSupportedFormat = (gl, intFmt, fmt, type) => {
      if (supportRenderTextureFormat(gl, intFmt, fmt, type)) {
        return { internalFormat: intFmt, format: fmt }
      }
      if (intFmt === gl.R16F) {
        return getSupportedFormat(gl, gl.RG16F, gl.RG, type)
      }
      if (intFmt === gl.RG16F) {
        return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type)
      }
      return null
    }

    // WebGLコンテキストの取得
    const getWebGLContext = (canvas) => {
      const params = { alpha: false, depth: false, stencil: false, antialias: false }
      const gl =
        canvas.getContext("webgl2", params) ||
        canvas.getContext("webgl", params) ||
        canvas.getContext("experimental-webgl", params)
      const isWebGL2 = !!canvas.getContext("webgl2", params)
      let halfFloat, supportLinear
      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float")
        supportLinear = gl.getExtension("OES_texture_float_linear")
      } else {
        halfFloat = gl.getExtension("OES_texture_half_float")
        supportLinear = gl.getExtension("OES_texture_half_float_linear")
      }
      gl.clearColor(1, 1, 1, 0)
      const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES
      let formatRGBA, formatRG, formatR
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType)
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType)
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType)
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
      }
      return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinear}}
    }

    const { gl, ext } = getWebGLContext(canvas)

    // GLProgramクラス：シェーダープログラムの生成・管理
    class GLProgram {
      constructor(vs, fs) {
        this.uniforms = {}
        this.program = gl.createProgram()
        gl.attachShader(this.program, vs)
        gl.attachShader(this.program, fs)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
          throw gl.getProgramInfoLog(this.program)
        const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS)
        for (let i = 0; i < count; i++) {
          const name = gl.getActiveUniform(this.program, i).name
          this.uniforms[name] = gl.getUniformLocation(this.program, name)
        }
      }
      bind() {
        gl.useProgram(this.program)
      }
    }

    // シェーダーのコンパイルヘルパー
    const compileShader = (type, src) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw gl.getShaderInfoLog(shader)
      return shader
    }

    // シェーダーソース群
    const shaders = {
      baseVertex: `
        precision highp float;
        precision mediump sampler2D;
        attribute vec2 aPosition;
        varying vec2 vUv, vL, vR, vT, vB;
        uniform vec2 texelSize;
        void main(){
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `,
      clear: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main(){
          gl_FragColor = value * texture2D(uTexture, vUv);
        }
      `,
      display: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main(){
          gl_FragColor = vec4(1.0) - texture2D(uTexture, vUv);
        }
      `,
      splat: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main(){
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + splat, 1.0);
        }
      `,
      advectionManual: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity, uSource;
        uniform vec2 texelSize;
        uniform float dt, dissipation;
        vec4 bilerp(sampler2D sam, vec2 p){
          vec4 st;
          st.xy = floor(p - 0.5) + 0.5;
          st.zw = st.xy + 1.0;
          vec4 uv = st * texelSize.xyxy;
          vec4 a = texture2D(sam, uv.xy),
               b = texture2D(sam, uv.zy),
               c = texture2D(sam, uv.xw),
               d = texture2D(sam, uv.zw);
          return mix(mix(a, b, p.x), mix(c, d, p.x), p.y);
        }
        void main(){
          vec2 coord = gl_FragCoord.xy - dt * texture2D(uVelocity, vUv).xy;
          gl_FragColor = dissipation * bilerp(uSource, coord);
          gl_FragColor.a = 1.0;
        }
      `,
      advection: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity, uSource;
        uniform vec2 texelSize;
        uniform float dt, dissipation;
        void main(){
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          gl_FragColor = dissipation * texture2D(uSource, coord);
          gl_FragColor.a = 1.0;
        }
      `,
      divergence: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv, vL, vR, vT, vB;
        uniform sampler2D uVelocity;
        vec2 sampleVelocity(vec2 uv){
          vec2 m = vec2(1.0);
          if(uv.x < 0.0){ uv.x = 0.0; m.x = -1.0; }
          if(uv.x > 1.0){ uv.x = 1.0; m.x = -1.0; }
          if(uv.y < 0.0){ uv.y = 0.0; m.y = -1.0; }
          if(uv.y > 1.0){ uv.y = 1.0; m.y = -1.0; }
          return m * texture2D(uVelocity, uv).xy;
        }
        void main(){
          float L = sampleVelocity(vL).x,
                R = sampleVelocity(vR).x,
                T = sampleVelocity(vT).y,
                B = sampleVelocity(vB).y;
          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `,
      curl: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv, vL, vR, vT, vB;
        uniform sampler2D uVelocity;
        void main(){
          float L = texture2D(uVelocity, vL).y,
                R = texture2D(uVelocity, vR).y,
                T = texture2D(uVelocity, vT).x,
                B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
        }
      `,
      vorticity: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv, vT, vB;
        uniform sampler2D uVelocity, uCurl;
        uniform float curl, dt;
        void main(){
          float T = texture2D(uCurl, vT).x,
                B = texture2D(uCurl, vB).x,
                C = texture2D(uCurl, vUv).x;
          vec2 force = vec2(abs(T) - abs(B), 0.0);
          force *= 1.0 / (length(force) + 0.00001) * curl * C;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
      `,
      pressure: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv, vL, vR, vT, vB;
        uniform sampler2D uPressure, uDivergence;
        vec2 boundary(vec2 uv){
          return min(max(uv, 0.0), 1.0);
        }
        void main(){
          float L = texture2D(uPressure, boundary(vL)).x,
                R = texture2D(uPressure, boundary(vR)).x,
                T = texture2D(uPressure, boundary(vT)).x,
                B = texture2D(uPressure, boundary(vB)).x;
          float div = texture2D(uDivergence, vUv).x;
          float pres = (L + R + T + B - div) * 0.25;
          gl_FragColor = vec4(pres, 0.0, 0.0, 1.0);
        }
      `,
      gradientSubtract: `
        precision highp float;
        precision mediump sampler2D;
        varying vec2 vUv, vL, vR, vT, vB;
        uniform sampler2D uPressure, uVelocity;
        vec2 boundary(vec2 uv){
          return min(max(uv, 0.0), 1.0);
        }
        void main(){
          float L = texture2D(uPressure, boundary(vL)).x,
                R = texture2D(uPressure, boundary(vR)).x,
                T = texture2D(uPressure, boundary(vT)).x,
                B = texture2D(uPressure, boundary(vB)).x;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vel.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(vel, 0.0, 1.0);
        }
      `,
    }

    // シェーダーのコンパイル
    const baseVertexShader = compileShader(gl.VERTEX_SHADER, shaders.baseVertex)
    const clearShader = compileShader(gl.FRAGMENT_SHADER, shaders.clear)
    const displayShader = compileShader(gl.FRAGMENT_SHADER, shaders.display)
    const splatShader = compileShader(gl.FRAGMENT_SHADER, shaders.splat)
    const advectionShader = ext.supportLinear
      ? compileShader(gl.FRAGMENT_SHADER, shaders.advection)
      : compileShader(gl.FRAGMENT_SHADER, shaders.advectionManual)
    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, shaders.divergence)
    const curlShader = compileShader(gl.FRAGMENT_SHADER, shaders.curl)
    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, shaders.vorticity)
    const pressureShader = compileShader(gl.FRAGMENT_SHADER, shaders.pressure)
    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, shaders.gradientSubtract)

    // フレームバッファ用変数
    let textureWidth, textureHeight
    let density, velocity, divergence, curl, pressure

    // 単一FBOの作成
    const createFBO = (texId, w, h, intFmt, fmt, type, param) => {
      gl.activeTexture(gl.TEXTURE0 + texId)
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, type, null)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      gl.viewport(0, 0, w, h)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return [tex, fbo, texId]
    }

    // ダブルFBOの作成（読み書きの入れ替え用）
    const createDoubleFBO = (texId, w, h, intFmt, fmt, type, param) => {
      let fbo1 = createFBO(texId, w, h, intFmt, fmt, type, param)
      let fbo2 = createFBO(texId + 1, w, h, intFmt, fmt, type, param)
      return {
        get read() {
          return fbo1;
        },
        get write() {
          return fbo2;
        },
        swap() {
          [fbo1, fbo2] = [fbo2, fbo1]
        },
      }
    }

    // フレームバッファの初期化
    const initFramebuffers = () => {
      textureWidth = gl.drawingBufferWidth >> config.TEXTURE_DOWNSAMPLE
      textureHeight = gl.drawingBufferHeight >> config.TEXTURE_DOWNSAMPLE
      const texType = ext.halfFloatTexType
      const rgba = ext.formatRGBA
      const rg = ext.formatRG
      const r = ext.formatR

      density = createDoubleFBO(
        2,
        textureWidth,
        textureHeight,
        rgba.internalFormat,
        rgba.format,
        texType,
        ext.supportLinear ? gl.LINEAR : gl.NEAREST
      )
      velocity = createDoubleFBO(
        0,
        textureWidth,
        textureHeight,
        rg.internalFormat,
        rg.format,
        texType,
        ext.supportLinear ? gl.LINEAR : gl.NEAREST
      )
      divergence = createFBO(
        4,
        textureWidth,
        textureHeight,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      )
      curl = createFBO(
        5,
        textureWidth,
        textureHeight,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      )
      pressure = createDoubleFBO(
        6,
        textureWidth,
        textureHeight,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      )
    }

    // 描画用のブリット関数
    const blit = (() => {
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      )
      const ibo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(0)
      return (dest) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dest)
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
      }
    })()

    // 初期化実行
    initFramebuffers()

    // プログラム群の生成
    const clearProgram = new GLProgram(baseVertexShader, clearShader)
    const displayProgram = new GLProgram(baseVertexShader, displayShader)
    const splatProgram = new GLProgram(baseVertexShader, splatShader)
    const advectionProgram = new GLProgram(baseVertexShader, advectionShader)
    const divergenceProgram = new GLProgram(baseVertexShader, divergenceShader)
    const curlProgram = new GLProgram(baseVertexShader, curlShader)
    const vorticityProgram = new GLProgram(baseVertexShader, vorticityShader)
    const pressureProgram = new GLProgram(baseVertexShader, pressureShader)
    const gradientSubtractProgram = new GLProgram(baseVertexShader, gradientSubtractShader)

    // メインの更新ループ
    const update = () => {
      resizeCanvas()
      const dt = Math.min((Date.now() - lastTime) / 1000, 0.016)
      lastTime = Date.now()

      gl.viewport(0, 0, textureWidth, textureHeight)

      // splatStackに要素があれば複数のsplatを実行
      if (splatStack.length > 0) {
        multipleSplats(splatStack.pop())
      }

      // 速度のアドベクション処理
      advectionProgram.bind()
      gl.uniform2f(advectionProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2])
      gl.uniform1f(advectionProgram.uniforms.dt, dt)
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION)
      blit(velocity.write[1])
      velocity.swap()

      // 密度のアドベクション処理
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(advectionProgram.uniforms.uSource, density.read[2])
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION)
      blit(density.write[1])
      density.swap()

      // ポインター操作によるsplat反映
      pointers.forEach((p) => {
        if (p.moved) {
          splat(p.x, p.y, p.dx, p.dy, p.color)
          p.moved = false
        }
      })

      // カール（渦）の計算
      curlProgram.bind()
      gl.uniform2f(curlProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read[2])
      blit(curl[1])

      // 渦の適用処理
      vorticityProgram.bind()
      gl.uniform2f(vorticityProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl[2])
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL)
      gl.uniform1f(vorticityProgram.uniforms.dt, dt)
      blit(velocity.write[1])
      velocity.swap()

      // 速度のダイバージェンス計算
      divergenceProgram.bind()
      gl.uniform2f(divergenceProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2])
      blit(divergence[1])

      // 圧力のクリア処理
      clearProgram.bind()
      let pressureTexId = pressure.read[2]
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      gl.bindTexture(gl.TEXTURE_2D, pressure.read[0])
      gl.uniform1i(clearProgram.uniforms.uTexture, pressureTexId)
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION)
      blit(pressure.write[1])
      pressure.swap()

      // 圧力計算の反復ループ
      pressureProgram.bind()
      gl.uniform2f(pressureProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2])
      pressureTexId = pressure.read[2]
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressureTexId)
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.bindTexture(gl.TEXTURE_2D, pressure.read[0])
        blit(pressure.write[1])
        pressure.swap()
      }

      // 圧力勾配の速度への反映
      gradientSubtractProgram.bind()
      gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read[2])
      gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read[2])
      blit(velocity.write[1])
      velocity.swap()

      // 最終表示処理
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      displayProgram.bind()
      gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2])
      blit(null)

      animationFrameId = requestAnimationFrame(update)
    }

    // splatエフェクトの適用
    const splat = (x, y, dx, dy) => {
      splatProgram.bind()
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read[2])
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height)
      gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1 - y / canvas.height)
      gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1)
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS)
      blit(velocity.write[1])
      velocity.swap()

      const rainbow = [
        { color: [1, 0, 0], factor: 0.09 },
        { color: [1, 1, 0], factor: 0.09 },
        { color: [0, 1, 0], factor: 0.09 },
        { color: [0, 1, 1], factor: 0.09 },
        { color: [0, 0, 1], factor: 0.09 },
        { color: [1, 0, 1], factor: 0.09 },
      ]
      const offset = 0.03
      for (let i in rainbow) {
        const angle = (i / rainbow.length) * Math.PI * 2
        const offsetX = Math.cos(angle) * offset
        const offsetY = Math.sin(angle) * offset
        gl.uniform1i(splatProgram.uniforms.uTarget, density.read[2])
        gl.uniform2f(
          splatProgram.uniforms.point,
          x / canvas.width + offsetX,
          1 - y / canvas.height + offsetY
        )
        gl.uniform3f(
          splatProgram.uniforms.color,
          rainbow[i].color[0] * rainbow[i].factor,
          rainbow[i].color[1] * rainbow[i].factor,
          rainbow[i].color[2] * rainbow[i].factor
        )
        gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS)
        blit(density.write[1])
        density.swap()
      }
    }

    const multipleSplats = (amount) => {
      for (let i = 0; i < amount; i++) {
        const color = [Math.random() * 10, Math.random() * 10, Math.random() * 10]
        const x = canvas.width * Math.random()
        const y = canvas.height * Math.random()
        const dx = 1000 * (Math.random() - 0.5)
        const dy = 1000 * (Math.random() - 0.5)
        splat(x, y, dx, dy, color)
      }
    }

    const resizeCanvas = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        initFramebuffers()
      }
    }

    const handleDown = (e) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const p = pointers[0]
      p.down = true
      p.x = e.clientX - rect.left
      p.y = e.clientY - rect.top
    }

    const handleMove = (e) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const p = pointers[0]
      p.moved = p.down
      p.dx = (x - p.x) * 10
      p.dy = (y - p.y) * 10
      p.x = x
      p.y = y
    }

    const handleUp = () => {
      pointers[0].down = false
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerdown", handleDown)
    window.addEventListener("pointercancel", handleUp)
    window.addEventListener("pointerup", handleUp)

    multipleSplats(Math.floor(Math.random() * 20) + 5)
    update()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerdown", handleDown)
      window.removeEventListener("pointercancel", handleUp)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute top-0 size-full"/>
}