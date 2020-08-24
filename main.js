window.onload = () => {
  const canvas = document.getElementById('canvas');
  
  const gl = canvas.getContext('webgl2');
  gl.getExtension('EXT_color_buffer_float');

  if (!gl) {
    alert('webgl2 not supported');
    return;
  }

  const stats = new Stats();
  const container = document.getElementById('container');
  container.appendChild(stats.domElement);

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let initializeAttractorProgram = createProgram('buffer_vs', 'init_attractor_fs');
  let updateAttractorProgram = createProgram('buffer_vs', 'update_attractor_fs');
  let renderAttractorProgram = createProgram('render_vs', 'render_attractor_fs');

  let updateUniforms = getUniformLocations(updateAttractorProgram, ['uPositionTexture', 'uDelta', 'uDeltaTime', 'uRho', 'uBeta']);
  let renderUniforms = getUniformLocations(renderAttractorProgram, ['uPositionTexture', 'vpMatrix']);

  let m = new matIV();
  let vMatrix = m.identity(m.create());
  let pMatrix = m.identity(m.create());
  let tmpMatrix = m.identity(m.create());

  render();

  function render() {

    let params = {
      trail_size: 4096,
      vertex_size: 256,
      delta: document.getElementById('delta').value,
      delta_time: document.getElementById('delta_time').value,
      rho: document.getElementById('rho').value,
      beta: document.getElementById('beta').value
    };

    // swapping functions
    let attractorFBObjR = createFramebuffer(params.trail_size, params.vertex_size);
    let attractorFBObjW = createFramebuffer(params.trail_size, params.vertex_size);
    function swapAttractorFBObj() {
      let tmp = attractorFBObjR;
      attractorFBObjR = attractorFBObjW;
      attractorFBObjW = tmp;
    };

    function initializeAttractor() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, attractorFBObjW.framebuffer);
      gl.useProgram(initializeAttractorProgram);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      swapAttractorFBObj();
    }

    function updateAttractor() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, attractorFBObjW.framebuffer);
      gl.useProgram(updateAttractorProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, attractorFBObjR.positionTexture);
      gl.uniform1i(updateUniforms['uPositionTexture'], 0);
      gl.uniform1f(updateUniforms['uDelta'], params.delta);
      gl.uniform1f(updateUniforms['uDeltaTime'], params.delta_time);
      gl.uniform1f(updateUniforms['uRho'], params.rho);
      gl.uniform1f(updateUniforms['uBeta'], params.beta);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      swapAttractorFBObj();
    }
    
    function renderAttractor() {
      gl.clear(gl.COLOR_BUFFER_BIT); 
      gl.viewport(0.0, 0.0, canvas.width, canvas.height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(renderAttractorProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, attractorFBObjR.positionTexture);
      gl.uniform1i(renderUniforms['uPositiontexture'], 0);
      gl.uniformMatrix4fv(renderUniforms['vpMatrix'], false, tmpMatrix);
      gl.drawArraysInstanced(gl.LINE_STRIP, 0, params.vertex_size, params.trail_size);
      gl.disable(gl.BLEND);
    }
    
    initializeAttractor();

    loop();

    function loop() {

      stats.update();

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.viewport(0.0, 0.0, canvas.width, canvas.height);

      m.lookAt([0.0, 0.0, 75.0], [0, 0, 0], [0, 1, 0], vMatrix);
      m.perspective(100.0, canvas.width / canvas.height, 0.1, 1000, pMatrix);
      m.multiply(pMatrix, vMatrix, tmpMatrix);

      params = {
        trail_size: 4096,
        vertex_size: 256,
        delta: document.getElementById('delta').value,
        delta_time: document.getElementById('delta_time').value,
        rho: document.getElementById('rho').value,
        beta: document.getElementById('beta').value
      };

      let eDelta = document.getElementById('disp_delta');
      let eDeltaTime = document.getElementById('disp_delta_time');
      let eRho = document.getElementById('disp_rho');
      let eBeta = document.getElementById('disp_beta');
      
      eDelta.innerHTML = params.delta;
      eDeltaTime.innerHTML = params.delta_time;
      eRho.innerHTML= params.rho;
      eBeta.innerHTML = params.beta;

      updateAttractor();

      renderAttractor();

      requestAnimationFrame(loop);
    }
  }

  function createProgram(vs_id, fs_id) {

    function createShader(id) {

      let shader;
  
      let scriptElement = document.getElementById(id);
  
      if (!scriptElement) {return;}
  
      switch (scriptElement.type) {

          case 'x-shader/x-vertex':
              shader = gl.createShader(gl.VERTEX_SHADER);
              break;
          case 'x-shader/x-fragment':
              shader = gl.createShader(gl.FRAGMENT_SHADER);
              break;
          default:
              return;
      }
  
      gl.shaderSource(shader, scriptElement.text);
  
      gl.compileShader(shader);
  
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          return shader;
      } else {
          throw(gl.getShaderInfoLog(shader));
      }
   }

    let vs = createShader(vs_id);
    let fs = createShader(fs_id);

    let program = gl.createProgram();
    
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);

      return program;
    } else {
      alert(gl.getProgramInfoLog(program));
    }
  }

  function getUniformLocations(program, uniforms) {

    let locations = {};

    for (let i = 0; i < uniforms.length; i++) {
      locations[uniforms[i]] = (gl.getUniformLocation(program, uniforms[i]));
    }

    return locations;
  }

  function createTexture(width, height, internalFormat, format, type) {

    let tex = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return tex;
  }

  function createFramebuffer(width, height) {

    let framebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    let positionTexture = createTexture(width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    
    gl.bindTexture(gl.TEXTURE_2D, positionTexture);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, positionTexture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return {
      framebuffer: framebuffer,
      positionTexture: positionTexture
    };
  }
}