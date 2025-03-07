import * as clUtils from './utils.js';

function glCreateFragmentShader(gl, fragmentShaderCode){
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
    return fragmentShader;
}
function getViewport(gpu, viewPortSource, op, params, viewport = null) {
    const viewPortSources = gpu.typesInfo.viewPortSources;
    const gl = gpu.gl;
    if (!viewport) {
        if (viewPortSource == viewPortSources.default) {
            viewport = [0, 0, op[0].params.texSize, op[0].params.texSize];
        } else if (viewPortSource == viewPortSources.canvas) {
            viewport = [0, 0, gl.canvas.width, gl.canvas.height];
        } else if (viewPortSource == viewPortSources.params) {
            viewport = [0, 0, params[0].texSize, params[0].texSize];
        } else {
            throw new Error("Invalid viewPortSource");
        }
    }
    return viewport;
}
function prepareFragmentShaderCode(gpu, inpParams, opParams, code, shaderParamsType, { libCode = '', pixelCode = '', fullFragmentCode = null}){
    const inpShapes = inpParams.map(x => x.shape);
    
    if (!(opParams.length > 0)) {
        throw new Error("output length >0 required");
    }
    if (inpParams.length > gpu.typesInfo.glParams.maxTextureUnits) {
        throw new Error("max input buffers supported = ", gpu.typesInfo.glParams.maxTextureUnits);
    }
    if (opParams.length > gpu.typesInfo.glParams.maxColorUnits) {
        throw new Error("max output buffers supported = ", gpu.typesInfo.glParams.maxColorUnits);
    }

    const fragmentShaderCode = fullFragmentCode || 
    `#version 300 es
    precision highp float;
    ${clUtils.generateShaderParamsCode(gpu, inpParams, opParams, shaderParamsType)}
    ${inpParams.map((x, i) => `uniform highp ${x.samplerDataType} _webcl_uTexture${i};`).join('\n')}
    in vec2 _webcl_pos;
    #define _webcl_getTexIndex() ( (floor(gl_FragCoord.y))*_webcl_baseParamsOut[0].z + floor(gl_FragCoord.x) )
    #define _webcl_getFlatIndex(n) (_webcl_getTexIndex()*_webcl_baseParamsOut[n].y + _webcl_i)
    ${opParams.map((x, i) => `layout(location = ${i}) out ${x.shaderDataType} _webcl_out${i};`).join('\n')}
    ${inpParams.map((x, i) => `#define _webcl_readInFlat${i}(i) texelFetch(_webcl_uTexture${i}, ( ivec2 ( mod ( floor ( i/_webcl_baseParamsIn[${i}].y ), _webcl_baseParamsIn[${i}].z ), floor ( floor ( i/_webcl_baseParamsIn[${i}].y )/_webcl_baseParamsIn[${i}].z ) ) ), 0 ) [int(mod(i, _webcl_baseParamsIn[${i}].y))]`).join('\n')}  
    ${opParams.map((x, i) => `#define _webcl_commitFlat${i}(val) _webcl_out${i}${x.shaderDataType !== 'float' ? '[_webcl_I]' : ''} = val * _webcl_mask${i}`).join('\n')}
    ${inpParams.map((x, i) => clUtils.generateIndexMacro(x, 'In' + i)).join('\n')}
    ${opParams.map((x, i) => clUtils.generateIndexMacro(x, 'Out' + i)).join('\n')}
    ${inpShapes.map((x, i) => `#define _webcl_readIn${i}(${x.map((x, i) => 'x' + i).join(',')}) _webcl_readInFlat${i}(_webcl_getFlatIndexIn${i}(${x.map((x, i) => 'x' + i).join(',')}))`).join('\n')}
    ${opParams.map((x, i) => `#define _webcl_commitOut${i}(val) _webcl_commitFlat${i}(val)`).join('\n')}
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
                            ${x.baseShaderDataType} _webcl_mask${i} = ${x.baseShaderDataType !== 'float' ? x.baseShaderDataType : ''}(step(_webcl_flatIndex${i}+0.5, _webcl_baseParamsOut[${i}].x));
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
                                _webcl_mask${i} = ${x.baseShaderDataType !== 'float' ? x.baseShaderDataType : ''}(step(_webcl_flatIndex${i}+0.5, _webcl_baseParamsOut[${i}].x));
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
    return fragmentShaderCode;
}

function glCreateProgram(gl, vertexShader, fragmentShader){
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    return program;
}

function glGetCurrentProgram(gl){
    return gl.getParameter(gl.CURRENT_PROGRAM);
}

function glIsCurrentProgram(gl, program){
    return (program == glGetCurrentProgram(gl));
}

function glSetCurrentProgram(gl, program){
    return glIsCurrentProgram(gl, program) || gl.useProgram(program);
}

function CircuitUboBuffer(gpu, params){
    
}

function Circuit(gpu, inpParams, opParams, code, { libCode = '', pixelCode = '', fullFragmentCode = null, shaderParamsType = null, uboInIndex = 0, uboOutIndex = 1 }) {
    const shaderParamsTypes = gpu.typesInfo.shaderParamsTypes;
	if(!shaderParamsType){
        shaderParamsType = shaderParamsTypes.default;
    }
    const gl = gpu.gl;
    const viewPortSources = gpu.typesInfo.viewPortSources;
    const {textureBuffer, positionBuffer, indexBuffer} = gpu.glBuffers;
    // if (opParams.length == 0) {
    //     opParams = [
    //         new LatticeParams([gl.canvas.width, gl.canvas.height, 4], gl.RGBA)
    //     ];
    // }
    const fragmentShaderCode = prepareFragmentShaderCode(gpu, inpParams, opParams, code, shaderParamsType, { libCode, pixelCode, fullFragmentCode });
    const fragmentShader = glCreateFragmentShader(gl, fragmentShaderCode);
    const program = glCreateProgram(gl, gpu.vertexShader, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
        throw new Error('ERROR: Can not link GLSL program!');
    }
    if(shaderParamsType == shaderParamsTypes.ubo){
        let inIndex = null;
        let outIndex = null;
        this.setUboBindingPoints = function({newUboInIndex = null, newUboOutIndex = null}){
            const setIn = (newUboInIndex !== null && inIndex !== null);
            const setOut = (newUboOutIndex !== null && outIndex !== null);
            if(setIn || setOut){
                glSetCurrentProgram(gl, program);
            }
            if(setIn){
                uboInIndex = newUboInIndex;
                gl.uniformBlockBinding(program, inIndex, uboInIndex);
            }
            if(setOut){
                uboOutIndex = newUboOutIndex;
                gl.uniformBlockBinding(program, outIndex, uboOutIndex);
            }
        }
        if(inpParams.length > 0){
            inIndex = gl.getUniformBlockIndex(program, "LatticeParamsIn");
            if (inIndex === gl.INVALID_INDEX) {
                console.error("Could not find LatticeParamsIn block.");
            }
            const uboIn = gl.createBuffer();
            // const blockSizeIn = gl.getActiveUniformBlockParameter(
            //     program,
            //     0,
            //     gl.UNIFORM_BLOCK_DATA_SIZE
            // );
            const blockInParams = clUtils.getUboData(inpParams);
            gl.bindBuffer(gl.UNIFORM_BUFFER, uboIn);
            gl.bufferData(gl.UNIFORM_BUFFER, blockInParams, gl.STATIC_DRAW);
            // gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
            gl.bindBufferBase(gl.UNIFORM_BUFFER, uboInIndex, uboIn);
        }
        outIndex = gl.getUniformBlockIndex(program, "LatticeParamsOut");
        if (outIndex === gl.INVALID_INDEX) {
            console.error("Could not find LatticeParamsOut block.");
        }
        const uboOut = gl.createBuffer();
        // const blockSizeOut = gl.getActiveUniformBlockParameter(
        //     program,
        //     outIndex,
        //     gl.UNIFORM_BLOCK_DATA_SIZE
        // );
        const blockOutParams = clUtils.getUboData(opParams);
        gl.bindBuffer(gl.UNIFORM_BUFFER, uboOut);
        gl.bufferData(gl.UNIFORM_BUFFER, blockOutParams, gl.STATIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, uboOutIndex, uboOut);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        this.setUboBindingPoints({
            newUboInIndex: uboInIndex,
            newUboOutIndex: uboOutIndex
        });
    }else if(shaderParamsType == shaderParamsTypes.uniform){
        glSetCurrentProgram(gl, program);
        if(inpParams.length > 0){
            const inpParamsData = clUtils.getUniformData(inpParams);
            const baseParamsInLoc = gl.getUniformLocation(program, "_webcl_baseParamsIn");
            gl.uniform4fv(baseParamsInLoc, inpParamsData.baseParamsData);
            for(let i = 0; i<inpParams.length; i++){
                const shapeParamsInLoc = gl.getUniformLocation(program, "_webcl_shapeParamsIn"+i);
                gl.uniform4fv(shapeParamsInLoc, inpParamsData.shapeParamsData[i]);
            }
        }
        const opParamsData = clUtils.getUniformData(opParams);
        const baseParamsOutLoc = gl.getUniformLocation(program, "_webcl_baseParamsOut");
        gl.uniform4fv(baseParamsOutLoc, opParamsData.baseParamsData);
        for(let i = 0; i<opParams.length; i++){
            const shapeParamsOutLoc = gl.getUniformLocation(program, "_webcl_shapeParamsOut"+i);
            gl.uniform4fv(shapeParamsOutLoc, opParamsData.shapeParamsData[i]);
        }
    }
    // once per program
    const v_texture = [];
    for (let i = 0; i < inpParams.length; i++) {
        v_texture.push(gl.getUniformLocation(program, '_webcl_uTexture' + i));
    }
    const aPosition = gl.getAttribLocation(program, '_webcl_position');
    const aTexture = gl.getAttribLocation(program, '_webcl_texture');
    
    // only once per vao setup
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
    gl.enableVertexAttribArray(aTexture);
    gl.vertexAttribPointer(aTexture, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.useProgram(program);
    for (let i = 0; i < inpParams.length; i++) {
        gl.uniform1i(v_texture[i], i);
    }
    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const colAt = [];
    for (let i = 0; i < opParams.length; i++) {
        colAt.push(gl.COLOR_ATTACHMENT0 + i);
    }
    gl.drawBuffers(colAt);
    const drawPrograms = {};
    let lastOp = null;
    this.new = function (newInpSize, newOpSize) {
        return new gpu.Circuit(newInpSize, newOpSize, code, { libCode, pixelCode, fullFragmentCode });
    }
    this.exec = function (inp, op, {
        previewIndex = 0, forcePreviewViaProgram = false, forceNewProgram = false, 
        previewViewport = null, previewViewportSource = viewPortSources.default,
        canvasViewport = null, canvasViewportSource = viewPortSources.canvas,
        viewPortSource = viewPortSources.default, forceCanvas = false, viewport = null,
        transferOutput = false, transferIndices = null
    }) {
        if (op.length == 0) {
            forceCanvas = true;
            viewPortSource = viewPortSources.canvas;
        }

        // move to a different function to config viewports
        viewport = getViewport(gpu, viewPortSource, op, opParams, viewport);
        gl.viewport(...viewport);
        op.forEach(x => x.texture || x.alloc());

        // once per draw  if output textures are changed - can create different fbo for different set of output textures
        if (!forceCanvas) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            for (let i = 0; i < op.length; i++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, op[i].texture, 0);
            }
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        const frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (frameBufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('ERROR: ' + clUtils.getFrameBufferStatusMsg(frameBufferStatus));
        }

        // per draw call (if last Ciecuit executed != this Circuit)
        gl.bindVertexArray(vao);
        gl.useProgram(program);

        // per draw call if input textures are changed
        for (let i = 0; i < inp.length; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, inp[i].texture);
        }

        // per exec
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        lastOp = op;
        if (transferOutput) {
            this.transferOutput(transferIndices);
        }
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
        previewViewport = getViewport(gpu, previewViewportSource, lastOp, opParams, previewViewport);
        canvasViewport = getViewport(gpu, canvasViewportSource, lastOp, opParams, canvasViewport);
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

        canvasViewport = getViewport(gpu, canvasViewportSource, lastOp, opParams, canvasViewport);
        let drawProg = drawPrograms[previewIndex];
        if (!drawProg || forceNewProgram) {
            drawProg = new Circuit([forceNewProgram ? lastOp[previewIndex].params : opParams[previewIndex]], [],
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

export { Circuit };
