"use client"

import { useRef, useEffect } from "react"

export const Cursor = () => {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio * 2 || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const config = { TEXTURE_DOWNSAMPLE: 1, DENSITY_DISSIPATION: 0.95, VELOCITY_DISSIPATION: 0.99, PRESSURE_DISSIPATION: 0.8, PRESSURE_ITERATIONS: 25, CURL: 30, SPLAT_RADIUS: 0.001 }
    const supportRenderTextureFormat = (gl, internalFormat, format, type) => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }
    const getSupportedFormat = (gl, internalFormat, format, type) =>
      supportRenderTextureFormat(gl, internalFormat, format, type)
        ? { internalFormat, format }
        : internalFormat === gl.R16F
          ? getSupportedFormat(gl, gl.RG16F, gl.RG, type)
          : internalFormat === gl.RG16F
            ? getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type)
            : null
    const getWebGLContext = (canvas) => {
      const params = { alpha: false, depth: false, stencil: false, antialias: false }
      let gl = canvas.getContext("webgl2", params)
      const isWebGL2 = !!gl
      if (!isWebGL2)
        gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params)
      let halfFloat, supportLinearFiltering
      if (isWebGL2) { gl.getExtension("EXT_color_buffer_float"); supportLinearFiltering = gl.getExtension("OES_texture_float_linear") }
      else { halfFloat = gl.getExtension("OES_texture_half_float"); supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear") }
      const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES
      const formatRGBA = isWebGL2 ? getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
      const formatRG = isWebGL2 ? getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
      const formatR = isWebGL2 ? getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType)
      return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } }
    }
    const { gl, ext } = getWebGLContext(canvas)
    const compileShader = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(sh); return sh }
    class GLProgram {
      constructor(vs, fs) {
        this.uniforms = {}
        this.program = gl.createProgram()
        gl.attachShader(this.program, vs); gl.attachShader(this.program, fs)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw gl.getProgramInfoLog(this.program)
        for (let i = 0, n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS); i < n; i++) {
          const name = gl.getActiveUniform(this.program, i).name
          this.uniforms[name] = gl.getUniformLocation(this.program, name)
        }
      }
      bind() { gl.useProgram(this.program) }
    }
    class Pointer { constructor() { this.id = -1; this.x = 0; this.y = 0; this.dx = 0; this.dy = 0; this.down = false; this.moved = false; this.color = [30, 0, 300] } }
    const pointers = [new Pointer()], splatStack = []
    const baseVS = compileShader(gl.VERTEX_SHADER, `
      precision highp float; precision mediump sampler2D;
      attribute vec2 aPosition; varying vec2 vUv, vL, vR, vT, vB; uniform vec2 texelSize;
      void main(){ vUv = aPosition * 0.5 + 0.5; vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y); gl_Position = vec4(aPosition, 0.0, 1.0); }
    `)
    const clearFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv;
      uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }
    `)
    const displayFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv; uniform sampler2D uTexture;
      void main(){ gl_FragColor = texture2D(uTexture, vUv); }
    `)
    const splatFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv;
      uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point;
      uniform float radius; uniform bool invert;
      void main(){ vec2 p = vUv - point; p.x *= aspectRatio; vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz; gl_FragColor = invert ? vec4(base - splat, 1.0) : vec4(base + splat, 1.0); }
    `)
    const advectionFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv;
      uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
      void main(){ vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 s = texture2D(uSource, coord); gl_FragColor = dissipation * s; gl_FragColor.a = 1.0; }
    `)
    const advectionDensityFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv;
      uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
      void main(){ vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 s = texture2D(uSource, coord); gl_FragColor = vec4(1.0 - dissipation * (1.0 - s.rgb), 1.0); }
    `)
    const bilerpFS = (body) => `
      precision highp float; precision mediump sampler2D; varying vec2 vUv;
      uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
      vec4 bilerp(in sampler2D sam, in vec2 p){ vec4 st; st.xy = floor(p - 0.5) + 0.5; st.zw = st.xy + 1.0;
      vec4 uv = st * texelSize.xyxy; vec4 a = texture2D(sam, uv.xy), b = texture2D(sam, uv.zy),
      c = texture2D(sam, uv.xw), d = texture2D(sam, uv.zw); vec2 f = p - st.xy; return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
      void main(){ vec2 coord = gl_FragCoord.xy - dt * texture2D(uVelocity, vUv).xy; ${body} }
    `
    const advectionManualFS = compileShader(gl.FRAGMENT_SHADER, bilerpFS(`gl_FragColor = dissipation * bilerp(uSource, coord); gl_FragColor.a = 1.0;`))
    const advectionDensityManualFS = compileShader(gl.FRAGMENT_SHADER, bilerpFS(`vec4 s = bilerp(uSource, coord); gl_FragColor = vec4(1.0 - dissipation * (1.0 - s.rgb), 1.0);`))
    const divergenceFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uVelocity; vec2 sampleVelocity(in vec2 uv){ vec2 m = vec2(1.0);
      if(uv.x < 0.0){ uv.x = 0.0; m.x = -1.0; } if(uv.x > 1.0){ uv.x = 1.0; m.x = -1.0; }
      if(uv.y < 0.0){ uv.y = 0.0; m.y = -1.0; } if(uv.y > 1.0){ uv.y = 1.0; m.y = -1.0; } return m * texture2D(uVelocity, uv).xy; }
      void main(){ float L = sampleVelocity(vL).x, R = sampleVelocity(vR).x, T = sampleVelocity(vT).y, B = sampleVelocity(vB).y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }
    `)
    const curlFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uVelocity; void main(){ float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y,
      T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x; gl_FragColor = vec4(R - L - T + B, 0.0, 0.0, 1.0); }
    `)
    const vorticityFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv, vT, vB;
      uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
      void main(){ float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 force = vec2(abs(T) - abs(B), 0.0); force *= 1.0 / length(force + 0.00001) * curl * C;
      vec2 vel = texture2D(uVelocity, vUv).xy; gl_FragColor = vec4(vel + force * dt, 0.0, 1.0); }
    `)
    const pressureFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uPressure, uDivergence; vec2 boundary(in vec2 uv){ return min(max(uv, 0.0), 1.0); }
      void main(){ float L = texture2D(uPressure, boundary(vL)).x, R = texture2D(uPressure, boundary(vR)).x,
      T = texture2D(uPressure, boundary(vT)).x, B = texture2D(uPressure, boundary(vB)).x,
      d = texture2D(uDivergence, vUv).x; gl_FragColor = vec4((L + R + T + B - d) * 0.25, 0.0, 0.0, 1.0); }
    `)
    const gradientSubtractFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision mediump sampler2D; varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uPressure, uVelocity; vec2 boundary(in vec2 uv){ return min(max(uv, 0.0), 1.0); }
      void main(){ float L = texture2D(uPressure, boundary(vL)).x, R = texture2D(uPressure, boundary(vR)).x,
      T = texture2D(uPressure, boundary(vT)).x, B = texture2D(uPressure, boundary(vB)).x;
      vec2 vel = texture2D(uVelocity, vUv).xy; vel.xy -= vec2(R - L, T - B); gl_FragColor = vec4(vel, 0.0, 1.0); }
    `)
    let textureWidth, textureHeight, density, velocity, divergence, curl, pressure
    const initFramebuffers = () => {
      textureWidth = gl.drawingBufferWidth >> config.TEXTURE_DOWNSAMPLE
      textureHeight = gl.drawingBufferHeight >> config.TEXTURE_DOWNSAMPLE
      const texType = ext.halfFloatTexType, rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR
      gl.clearColor(1, 1, 1, 1); density = createDoubleFBO(2, textureWidth, textureHeight, rgba.internalFormat, rgba.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST)
      gl.clearColor(0, 0, 0, 1); velocity = createDoubleFBO(0, textureWidth, textureHeight, rg.internalFormat, rg.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST)
      divergence = createFBO(4, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST)
      curl = createFBO(5, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST)
      pressure = createDoubleFBO(6, textureWidth, textureHeight, r.internalFormat, r.format, texType, gl.NEAREST)
    }
    const createFBO = (texId, w, h, internalFormat, format, type, param) => {
      gl.activeTexture(gl.TEXTURE0 + texId)
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT)
      return [tex, fbo, texId]
    }
    const createDoubleFBO = (texId, w, h, internalFormat, format, type, param) => {
      let fbo1 = createFBO(texId, w, h, internalFormat, format, type, param)
      let fbo2 = createFBO(texId + 1, w, h, internalFormat, format, type, param)
      return { get read() { return fbo1 }, get write() { return fbo2 }, swap() { [fbo1, fbo2] = [fbo2, fbo1] } }
    }
    const blit = (() => {
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW)
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0)
      return dest => { gl.bindFramebuffer(gl.FRAMEBUFFER, dest); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0) }
    })()
    initFramebuffers()
    const clearProgram = new GLProgram(baseVS, clearFS), displayProgram = new GLProgram(baseVS, displayFS), splatProgram = new GLProgram(baseVS, splatFS),
      advectionProgram = new GLProgram(baseVS, ext.supportLinearFiltering ? advectionFS : advectionManualFS),
      advectionDensityProgram = new GLProgram(baseVS, ext.supportLinearFiltering ? advectionDensityFS : advectionDensityManualFS),
      divergenceProgram = new GLProgram(baseVS, divergenceFS), curlProgram = new GLProgram(baseVS, curlFS),
      vorticityProgram = new GLProgram(baseVS, vorticityFS), pressureProgram = new GLProgram(baseVS, pressureFS),
      gradienSubtractProgram = new GLProgram(baseVS, gradientSubtractFS)
    let lastTime = Date.now()
    const multipleSplats = amount => { for (let i = 0; i < amount; i++) { const color = [Math.random() * 10, Math.random() * 10, Math.random() * 10], x = canvas.width * Math.random(), y = canvas.height * Math.random(), dx = 1000 * (Math.random() - 0.5), dy = 1000 * (Math.random() - 0.5); splat(x, y, dx, dy, color) } }
    const splat = (x, y, dx, dy, color) => {
      splatProgram.bind()
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read[2])
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height)
      gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1 - y / canvas.height)
      gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0)
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS)
      gl.uniform1i(splatProgram.uniforms.invert, 0)
      blit(velocity.write[1]); velocity.swap()
      gl.uniform1i(splatProgram.uniforms.uTarget, density.read[2])
      gl.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2])
      gl.uniform1i(splatProgram.uniforms.invert, 1)
      blit(density.write[1]); density.swap()
    }
    const resizeCanvas = () => { if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; initFramebuffers() } }
    const update = () => {
      resizeCanvas()
      const dt = Math.min((Date.now() - lastTime) / 1000, 0.016)
      lastTime = Date.now()
      gl.viewport(0, 0, textureWidth, textureHeight)
      if (splatStack.length > 0) multipleSplats(splatStack.pop())
      advectionProgram.bind()
      gl.uniform2f(advectionProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2])
      gl.uniform1f(advectionProgram.uniforms.dt, dt)
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION)
      blit(velocity.write[1]); velocity.swap()
      advectionDensityProgram.bind()
      gl.uniform2f(advectionDensityProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(advectionDensityProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(advectionDensityProgram.uniforms.uSource, density.read[2])
      gl.uniform1f(advectionDensityProgram.uniforms.dt, dt)
      gl.uniform1f(advectionDensityProgram.uniforms.dissipation, config.DENSITY_DISSIPATION)
      blit(density.write[1]); density.swap()
      pointers.forEach(pointer => { if (pointer.moved) { splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color); pointer.moved = false } })
      curlProgram.bind(); gl.uniform2f(curlProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read[2]); blit(curl[1])
      vorticityProgram.bind(); gl.uniform2f(vorticityProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read[2])
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl[2])
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL)
      gl.uniform1f(vorticityProgram.uniforms.dt, dt)
      blit(velocity.write[1]); velocity.swap()
      divergenceProgram.bind(); gl.uniform2f(divergenceProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2]); blit(divergence[1])
      clearProgram.bind()
      let pressureTexId = pressure.read[2]
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      gl.bindTexture(gl.TEXTURE_2D, pressure.read[0])
      gl.uniform1i(clearProgram.uniforms.uTexture, pressureTexId)
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION)
      blit(pressure.write[1]); pressure.swap()
      pressureProgram.bind(); gl.uniform2f(pressureProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2])
      pressureTexId = pressure.read[2]
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressureTexId)
      gl.activeTexture(gl.TEXTURE0 + pressureTexId)
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) { gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]); blit(pressure.write[1]); pressure.swap() }
      gradienSubtractProgram.bind(); gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1 / textureWidth, 1 / textureHeight)
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read[2])
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read[2])
      blit(velocity.write[1]); velocity.swap()
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      displayProgram.bind(); gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2]); blit(null)
      requestAnimationFrame(update)
    }
    multipleSplats(Math.floor(Math.random() * 20) + 5); update()
    window.addEventListener("mousemove", e => {
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top
      pointers[0].moved = pointers[0].down; pointers[0].dx = (x - pointers[0].x) * 10; pointers[0].dy = (y - pointers[0].y) * 10
      pointers[0].x = x; pointers[0].y = y
    })
    window.addEventListener("mousedown", () => { pointers[0].down = true; pointers[0].color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2] })
    window.addEventListener("mouseup", () => { pointers[0].down = false })
    window.addEventListener("touchmove", e => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      for (let i = 0; i < e.targetTouches.length; i++) {
        let pointer = pointers[i] || new Pointer(); if (!pointers[i]) pointers[i] = pointer
        pointer.moved = pointer.down
        const tx = e.targetTouches[i].pageX - rect.left, ty = e.targetTouches[i].pageY - rect.top
        pointer.dx = (tx - pointer.x) * 10; pointer.dy = (ty - pointer.y) * 10; pointer.x = tx; pointer.y = ty
      }
    }, { passive: false })
    window.addEventListener("touchstart", e => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      for (let i = 0; i < e.targetTouches.length; i++) {
        if (i >= pointers.length) pointers.push(new Pointer())
        pointers[i].id = e.targetTouches[i].identifier; pointers[i].down = true
        pointers[i].x = e.targetTouches[i].pageX - rect.left; pointers[i].y = e.targetTouches[i].pageY - rect.top
        pointers[i].color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2]
      }
    }, { passive: false })
    window.addEventListener("touchend", e => {
      for (let i = 0; i < e.changedTouches.length; i++)
        for (let j = 0; j < pointers.length; j++)
          if (e.changedTouches[i].identifier === pointers[j].id) pointers[j].down = false
    })
  }, [])
  return <canvas ref={canvasRef} className="absolute top-0 size-full pointer-events-none"/>
}
