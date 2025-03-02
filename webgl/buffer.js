import * as clUtils from './utils.js';

function LatticeParams(gpu, shape, internalFormat, type = null) {
    this.size = clUtils.getShapedArraySize(shape);
    this.shape = shape;
    this.internalFormat = internalFormat;
    this.format = gpu.typesInfo.getFormat(internalFormat);
    this.stride = gpu.typesInfo.getStride(this.format);
    this.texSize = clUtils.getTexSize(this.size, this.stride);
    this.type = gpu.typesInfo.getType(internalFormat, type);
    this.shaderDataFormat = gpu.typesInfo.getShaderDataFormat(internalFormat);
    this.shaderDataType = gpu.typesInfo.getShaderDataType(this.shaderDataFormat, this.stride);
    this.arrayType = gpu.typesInfo.getArrayType(this.type);
    this.samplerDataType = gpu.typesInfo.getSamplerDataType(this.shaderDataFormat);
    this.baseShaderDataType = gpu.typesInfo.getBaseShaderDataType(this.shaderDataFormat);
}

function Lattice(gpu, shape, { arr = null, internalFormat = gl.RGBA8, type = null }) {
    const gl = gpu.gl;
    const params = new LatticeParams(gpu, shape, internalFormat, type);
    const size = params.size;
    const texSize = params.texSize;
    const stride = params.stride;
    const format = params.format;
    type = params.type;
    let texture = null;
    const data = new params.arrayType(texSize * texSize * stride);
    if (!(size > 0)) {
        throw new Error("Lattice size must be > 0");
    }
    // this.mem = Math.pow(4, Math.ceil(Math.log(this.length) / Math.log(4)));
    if (texSize > gpu.typesInfo.glParams.maxTextureSize) {
        throw new Error("ERROR: Texture size not supported!");
    }

    this.set = function (arr) {
        let flatArr = clUtils.flattenArray(arr, shape);
        // Verify size matches shape
        if (flatArr.length !== size) {
            throw new Error(`Array size ${flatArr.length} doesn't match buffer shape ${shape} (size ${size})`);
        }
        for (let i = 0; i < Math.min(data.length, size); i++) {
            data[i] = flatArr[i];
        }
    }
    if (arr) {
        this.set(arr);
    }
    this.alloc = function () {
        if (texture == null) {
            texture = gl.createTexture();
            this.texture = texture;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, texSize, texSize, 0, format, type, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
    this.free = function () {
        if (texture != null) {
            gl.deleteTexture(texture);
        }
        this.texture = null;
        texture = null;
    }
    this.read = function () {
        if (!texture) {
            throw new Error("Texture not allocated on GPU");
        }

        // Create a framebuffer
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        // Attach the texture
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        // Check if framebuffer is complete
        const frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (frameBufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer not complete: ' + clUtils.getFrameBufferStatusMsg(frameBufferStatus));
        }

        // Read the pixels
        gl.readPixels(0, 0, texSize, texSize, format, type, data);

        // Cleanup
        gl.deleteFramebuffer(fbo);

        return data;
    }
    this.getShapedData = function () {
        return clUtils.unflattenArray(data, shape);
    }
    this.data = data;
    this.params = params;
    this.texture = texture;
}

export { Lattice, LatticeParams };
