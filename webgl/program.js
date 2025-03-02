import * as clUtils from './utils.js';

function Program(gpu, inpParams, opParams, code, { libCode = '', pixelCode = '', fullFragmentCode = null }) {
    const gl = gpu.gl;
    const viewPortSources = gpu.typesInfo.viewPortSources;
    const {textureBuffer, positionBuffer, indexBuffer} = gpu.glBuffers;
    // if (opParams.length == 0) {
    //     opParams = [
    //         new LatticeParams([gl.canvas.width, gl.canvas.height, 4], gl.RGBA)
    //     ];
    // }
    const inpShapes = inpParams.map(x => x.shape);
    const opShapes = opParams.map(x => x.shape);
    const inpSize = inpParams.map(x => x.size);
    const opSize = opParams.map(x => x.size);
    const inpTexSize = inpParams.map(x => x.texSize);
    const opStride = opParams.map(x => x.stride);
    const inpStride = inpParams.map(x => x.stride);
    // let inpSize = inpShapes.map(x => getShapedArraySize(x));
    // let opSize = opShapes.map(x => getShapedArraySize(x));
    if (!(opSize.length > 0)) {
        throw new Error("output length >0 required");
    }
    if (inpSize.length > gpu.typesInfo.glParams.maxTextureUnits) {
        throw new Error("max input buffers supported = ", gpu.typesInfo.glParams.maxTextureUnits);
    }
    if (opSize.length > gpu.typesInfo.glParams.maxColorUnits) {
        throw new Error("max output buffers supported = ", gpu.typesInfo.glParams.maxColorUnits);
    }

    const sizeO = opParams[0].texSize;
    const fragmentShaderCode = fullFragmentCode || `#version 300 es
    precision highp float;
    ${inpSize.length ? `float _webcl_inpSize[${inpSize.length}] = float[](${inpSize.join('.,')}.);` : ''}
    float _webcl_opSize[${opSize.length}] = float[](${opSize.join('.,')}.);
    float _webcl_opStride[${opStride.length}] = float[](${opStride.join('.,')}.);
    ${inpStride.length ? `float _webcl_inpStride[${inpStride.length}] = float[](${inpStride.join('.,')}.);` : ''}
    ${inpTexSize.length ? `float _webcl_sizeI[${inpTexSize.length}] = float[](${inpTexSize.map(x => x + '.').join(',')});` : ''}
    ${inpParams.map((x, i) => `uniform highp ${x.samplerDataType} _webcl_uTexture${i};`).join('\n')}
    float _webcl_sizeO = ${sizeO}.;
    in vec2 _webcl_pos;
    #define _webcl_getTexIndex() ( (_webcl_pos.y*_webcl_sizeO - 0.5)*_webcl_sizeO + (_webcl_pos.x*_webcl_sizeO - 0.5) )
    #define _webcl_getFlatIndex(n) (_webcl_getTexIndex()*_webcl_opStride[n] + _webcl_i)
    ${opParams.map((x, i) => `layout(location = ${i}) out ${x.shaderDataType} _webcl_out${i};`).join('\n')}
    ${inpSize.map((x, i) => `#define _webcl_readInFlat${i}(i) texture(_webcl_uTexture${i}, (0.5 + vec2(mod(floor(i/_webcl_inpStride[${i}]), _webcl_sizeI[${i}]), floor(floor(i/_webcl_inpStride[${i}])/_webcl_sizeI[${i}])))/_webcl_sizeI[${i}])[int(mod(i, _webcl_inpStride[${i}]))]`).join('\n')}
    ${opParams.map((x, i) => `#define _webcl_commitFlat${i}(val) _webcl_out${i}${x.shaderDataType !== 'float' ? '[_webcl_I]' : ''} = val * _webcl_mask${i}`).join('\n')}
    ${inpParams.map((x, i) => clUtils.generateIndexMacro(x, 'In' + i)).join('\n')}
    ${opParams.map((x, i) => clUtils.generateIndexMacro(x, 'Out' + i)).join('\n')}
    ${inpShapes.map((x, i) => `#define _webcl_readIn${i}(${x.map((x, i) => 'x' + i).join(',')}) _webcl_readInFlat${i}(_webcl_getFlatIndexIn${i}(${x.map((x, i) => 'x' + i).join(',')}))`).join('\n')}
    ${opShapes.map((x, i) => `#define _webcl_commitOut${i}(val) _webcl_commitFlat${i}(val)`).join('\n')}
    ${opParams.map((x, i) => clUtils.generateShapedIndexMacro(x, 'Out' + i)).join('\n')}
    ${opParams.map((x, i) => clUtils.generateNextShapedIndexMacro(x, 'Out' + i)).join('\n')}
    ${libCode}
    void main(void){
        ${pixelCode}
        ${[0, 1, 2, 3].map(channel_index => {
        let out = ``;
        if (channel_index > 0) {
            out += `
                        #undef _webcl_i
                        #undef _webcl_I
                    `;
        }
        out += `
                    #define _webcl_i ${channel_index}.
                    #define _webcl_I ${channel_index}
                `;
        out += opParams.map((x, i) => {
            if (channel_index == 0) {
                return `
                            #define _webcl_available_out${i}
                            float _webcl_index${i}[${x.shape.length}];
                            float _webcl_flatIndex${i} = floor(_webcl_getFlatIndex(${i})); 
                            _webcl_getShapedIndexOut${i}(_webcl_flatIndex${i}, _webcl_index${i});
                            ${x.baseShaderDataType} _webcl_mask${i} = ${x.baseShaderDataType !== 'float' ? x.baseShaderDataType : ''}(step(_webcl_flatIndex${i}+0.5, _webcl_opSize[${i}]));
                        `
            } else {
                // if(x.stride == channel_index){
                // 	return `
                // 		#undef _webcl_available_out${i}
                // 	`;
                // }else 
                if (x.stride <= channel_index) {
                    return `
                                #undef _webcl_available_out${i}
                            `;
                } else {
                    return `
                                _webcl_flatIndex${i} += 1.;
                                _webcl_nextShapedIndexOut${i}(_webcl_index${i});
                                _webcl_mask${i} = ${x.baseShaderDataType !== 'float' ? x.baseShaderDataType : ''}(step(_webcl_flatIndex${i}+0.5, _webcl_opSize[${i}]));
                            `;
                }
            }
        }).join('\n');
        out += `
                    {
                        ${code}
                    }
                `;
        return out;
    }).join('\n')
        }
    }
    `;
    // console.log(vertexShaderCode);
    // console.log(fragmentShaderCode);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(
        fragmentShader,
        fragmentShaderCode
    );
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const LOC = (fragmentShaderCode).split('\n');
        let dbgMsg = "ERROR: Could not build shader (fatal).\n\n------------------ KERNEL CODE DUMP ------------------\n"
        for (let nl = 0; nl < LOC.length; nl++)
            dbgMsg += (1 + nl) + "> " + LOC[nl] + "\n";
        dbgMsg += "\n--------------------- ERROR  LOG ---------------------\n" + gl.getShaderInfoLog(fragmentShader)
        throw new Error(dbgMsg);
    }
    const program = gl.createProgram();
    gl.attachShader(program, gpu.vertexShader);
    gl.attachShader(program, fragmentShader);

    let fbo = null;
    const drawPrograms = {};
    let lastOp = null;
    function getViewport(viewPortSource, op, viewport = null) {
        if (!viewport) {
            if (viewPortSource == viewPortSources.default) {
                viewport = [0, 0, op[0].params.texSize, op[0].params.texSize];
            } else if (viewPortSource == viewPortSources.canvas) {
                viewport = [0, 0, gl.canvas.width, gl.canvas.height];
            } else if (viewPortSource == viewPortSources.params) {
                viewport = [0, 0, sizeO, sizeO];
            } else {
                throw new Error("Invalid viewPortSource");
            }
        }
        return viewport;
    }
    this.new = function (newInpSize, newOpSize) {
        return new gpu.Program(newInpSize, newOpSize, code, { libCode, pixelCode, fullFragmentCode });
    }
    this.exec = function (inp, op, {
        previewIndex = 0, forcePreviewViaProgram = false, forceNewProgram = false, 
        previewViewport = null, previewViewportSource = viewPortSources.default,
        canvasViewport = null, canvasViewportSource = viewPortSources.canvas,
        viewPortSource = viewPortSources.default, forceCanvas = false, viewport = null,
        transferOutput = false, transferIndices = null
    }) {
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error('ERROR: Can not link GLSL program!');
        const v_texture = [];
        for (let i = 0; i < inp.length; i++) {
            v_texture.push(gl.getUniformLocation(program, '_webcl_uTexture' + i));
        }
        const aPosition = gl.getAttribLocation(program, '_webcl_position');
        const aTexture = gl.getAttribLocation(program, '_webcl_texture');
        const colAt = [];
        if (op.length == 0) {
            forceCanvas = true;
            viewPortSource = viewPortSources.canvas;
        }
        viewport = getViewport(viewPortSource, op, viewport);
        gl.viewport(...viewport);
        op.forEach(x => x.alloc());
        if (!forceCanvas) {
            fbo = fbo || gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            for (let i = 0; i < op.length; i++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, op[i].texture, 0);
                colAt.push(gl.COLOR_ATTACHMENT0 + i);
                gl.drawBuffers(colAt);
            }
        } else {
            fbo = null;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        const frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (frameBufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('ERROR: ' + clUtils.getFrameBufferStatusMsg(frameBufferStatus));
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        gl.enableVertexAttribArray(aTexture);
        gl.vertexAttribPointer(aTexture, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.useProgram(program);
        for (let i = 0; i < inp.length; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, inp[i].texture);
            gl.uniform1i(v_texture[i], i);
        }

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        if (transferOutput) {
            this.transferOutput(transferIndices);
        }
        lastOp = op;
        if (previewIndex !== null && previewIndex < op.length) {
            this.preview(previewIndex, { forcePreviewViaProgram, forceNewProgram, previewViewport, previewViewportSource, canvasViewport, canvasViewportSource });
        }
    }
    this.transferOutput = function (transferIndices = null) {
        let op = lastOp;
        if (transferIndices === null) {
            for (let i = 0; i < op.length; i++) {
                gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
                gl.readPixels(0, 0, op[i].params.texSize, op[i].params.texSize, op[i].params.format, op[i].params.type, op[i].data);
            }
        } else {
            for (let i = 0; i < transferIndices.length; i++) {
                gl.readBuffer(gl.COLOR_ATTACHMENT0 + transferIndices[i]);
                gl.readPixels(0, 0, op[transferIndices[i]].params.texSize, op[transferIndices[i]].params.texSize, op[transferIndices[i]].params.format, op[transferIndices[i]].params.type, op[transferIndices[i]].data);
            }
        }
    }
    this.preview = function (previewIndex, {
        forcePreviewViaProgram = false, forceNewProgram = false,
        previewViewport = null, previewViewportSource = viewPortSources.default,
        canvasViewport = null, canvasViewportSource = viewPortSources.canvas
    }) {
        if (lastOp == null) {
            throw new Error("No output to preview!");
        }
        previewViewport = getViewport(previewViewportSource, lastOp, previewViewport);
        canvasViewport = getViewport(canvasViewportSource, lastOp, canvasViewport);
        const shaderDataFormat = opParams[previewIndex].shaderDataFormat;
        if (shaderDataFormat == gl.FLOAT && !forcePreviewViaProgram) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
            gl.readBuffer(gl.COLOR_ATTACHMENT0 + previewIndex);
            // gl.canvas.width = op[previewIndex].texSize;
            // gl.canvas.height = op[previewIndex].texSize;
            // console.log("canvas", gl.canvas.width, gl.canvas.height);
            gl.blitFramebuffer(
                ...previewViewport,  // source
                ...canvasViewport,   // dest
                gl.COLOR_BUFFER_BIT,
                gl.NEAREST
            );
        } else {
            this.previewViaProgram(previewIndex, { forceNewProgram, previewViewport, previewViewportSource, canvasViewport, canvasViewportSource });
        }
    }
    this.previewViaProgram = function (previewIndex, {
        forceNewProgram = false,
        previewViewport = null, previewViewportSource = viewPortSources.default,
        canvasViewport = null, canvasViewportSource = viewPortSources.canvas
    }) {
        if (lastOp == null) {
            throw new Error("No output to preview!");
        }
        console.warn("Previewing via program is not recommended - uint/int textures are not recommended for preview.");
        if(previewViewport || previewViewportSource){
            console.warn("previewViewport and previewViewportSource are not supported for previewViaProgram.");
        }

        canvasViewport = getViewport(canvasViewportSource, lastOp, canvasViewport);
        let drawProg = drawPrograms[previewIndex];
        if (!drawProg || forceNewProgram) {
            drawProg = new Program([forceNewProgram ? lastOp[previewIndex].params : opParams[previewIndex]], [],
                ``,
                ``,
                `
                    _webcl_out0 = vec4(texture(_webcl_uTexture0, _webcl_pos).rgba);
                `
            );
            if (drawProg) {
                drawProg.free();
            }
            drawPrograms[previewIndex] = drawProg;
        }
        drawProg.exec([lastOp[previewIndex]], [], {
            viewPortSource: canvasViewportSource,
            viewport: canvasViewport,
            forceCanvas: true
        });
    }

    this.free = function () {
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteFramebuffer(fbo);
        for (let i in drawPrograms) {
            drawPrograms[i].free();
        }
    }
}

export { Program };
