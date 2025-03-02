function getTypesInfo(gl) {
	const viewPortSources = {
		default: 0,
		buffer: 0,
		canvas: 1,
		params: 2,
	}
    
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
	const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
	const maxColorUnits = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
    const glParams = {
        maxTextureSize,
        maxTextureUnits,
        maxColorUnits,
    }

    const typeInfo = {
        [gl.HALF_FLOAT]: {
            'arrayType': Uint16Array
        },
        [gl.FLOAT]: {
            'arrayType': Float32Array
        },
        [gl.BYTE]: {
            'arrayType': Int8Array
        },
        [gl.UNSIGNED_BYTE]: {
            'arrayType': Uint8Array
        },
        [gl.SHORT]: {
            'arrayType': Int16Array
        },
        [gl.UNSIGNED_SHORT]: {
            'arrayType': Uint16Array
        },
        [gl.INT]: {
            'arrayType': Int32Array
        },
        [gl.UNSIGNED_INT]: {
            'arrayType': Uint32Array
        },
        [gl.UNSIGNED_SHORT_5_6_5]: { // packed
            'arrayType': Uint16Array
        },
        [gl.UNSIGNED_SHORT_5_5_5_1]: { // packed
            'arrayType': Uint16Array
        },
        [gl.UNSIGNED_SHORT_4_4_4_4]: { // packed
            'arrayType': Uint16Array
        },
        [gl.UNSIGNED_INT_5_9_9_9_REV]: { // packed
            'arrayType': Uint32Array
        },
        [gl.UNSIGNED_INT_2_10_10_10_REV]: { // packed
            'arrayType': Uint32Array
        },
        [gl.UNSIGNED_INT_10F_11F_11F_REV]: { // packed
            'arrayType': Uint32Array
        },
        [gl.UNSIGNED_INT_24_8]: { // packed
            'arrayType': Uint32Array
        },
    };

    const formatInfo = {
        [gl.RGBA]: {
            channels: 4,
        },
        [gl.RGB]: {
            channels: 3,
        },
        [gl.RG]: {
            channels: 2,
        },
        [gl.RED]: {
            channels: 1,
        },
        [gl.RGBA_INTEGER]: {
            channels: 4,
        },
        [gl.RGB_INTEGER]: {
            channels: 3,
        },
        [gl.RG_INTEGER]: {
            channels: 2,
        },
        [gl.RED_INTEGER]: {
            channels: 1,
        },
    };

    const shaderDataFormatInfo = {
        [gl.FLOAT]: {
            base: 'float',
            shaderDataType: {
                1: 'float',
                2: 'vec2',
                3: 'vec3',
                4: 'vec4',
            },
            samplerDataType: 'sampler2D'
        },
        [gl.INT]: {
            base: 'int',
            shaderDataType: {
                1: 'int',
                2: 'ivec2',
                3: 'ivec3',
                4: 'ivec4',
            },
            samplerDataType: 'isampler2D'
        },
        [gl.UNSIGNED_INT]: {
            base: 'uint',
            shaderDataType: {
                1: 'uint',
                2: 'uvec2',
                3: 'uvec3',
                4: 'uvec4',
            },
            samplerDataType: 'usampler2D'
        },
    }

    const internalFormatsInfo = {
        [gl.RGBA32F]: {
            format: gl.RGBA,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT,
            // channelsInfo: {
            // 	r: {
            // 		size: 32,
            // 	},
            // 	g: {
            // 		size: 32,
            // 	},
            // 	b: {
            // 		size: 32,
            // 	},
            // 	a: {
            // 		size: 32,
            // 	},
            // },
            // renderInfo: {
            // 	colorRenderable: {
            // 		nativeSupported: false,
            // 		dependencies: [gl.EXT_COLOR_BUFFER_FLOAT],
            // 		supported: true
            // 	}
            // }
        },
        [gl.R11F_G11F_B10F]: {
            format: gl.RGB,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT,
                [gl.HALF_FLOAT]: gl.HALF_FLOAT,
                [gl.UNSIGNED_INT_10F_11F_11F_REV]: gl.UNSIGNED_INT_10F_11F_11F_REV
            },
            shaderType: 'vec3',
            shaderDataFormat: gl.FLOAT,
        },
        [gl.RG32F]: {
            format: gl.RG,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT
            },
            shaderType: 'vec2',
            shaderDataFormat: gl.FLOAT,
        },
        [gl.R32F]: {
            format: gl.RED,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT
            },
            shaderType: 'float',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGBA16F]: {
            format: gl.RGBA,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT,
                [gl.HALF_FLOAT]: gl.HALF_FLOAT
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RG16F]: {
            format: gl.RG,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT,
                [gl.HALF_FLOAT]: gl.HALF_FLOAT
            },
            shaderType: 'vec2',
            shaderDataFormat: gl.FLOAT
        },
        [gl.R16F]: {
            format: gl.RED,
            type: {
                default: gl.FLOAT,
                [gl.FLOAT]: gl.FLOAT,
                [gl.HALF_FLOAT]: gl.HALF_FLOAT
            },
            shaderType: 'float',
            shaderDataFormat: gl.FLOAT
        },
        [gl.R8]: {
            format: gl.RED,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'float',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RG8]: {
            format: gl.RG,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'vec2',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB8]: {
            format: gl.RGB,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'vec3',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB565]: {
            format: gl.RGB,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'vec3',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGBA4]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB5_A1]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1,
                [gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGBA8]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB10_A2]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_INT_2_10_10_10_REV,
                [gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB10_A2UI]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.UNSIGNED_INT_2_10_10_10_REV,
                [gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
            },
            shaderType: 'uvec4',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.SRGB8_ALPHA8]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.R8I]: {
            format: gl.RED_INTEGER,
            type: {
                default: gl.BYTE,
                [gl.BYTE]: gl.BYTE
            },
            shaderType: 'int',
            shaderDataFormat: gl.INT
        },
        [gl.R8UI]: {
            format: gl.RED_INTEGER,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'uint',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.R16I]: {
            format: gl.RED_INTEGER,
            type: {
                default: gl.SHORT,
                [gl.SHORT]: gl.SHORT
            },
            shaderType: 'int',
            shaderDataFormat: gl.INT
        },
        [gl.R16UI]: {
            format: gl.RED_INTEGER,
            type: {
                default: gl.UNSIGNED_SHORT,
                [gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
            },
            shaderType: 'uint',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RG32I]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.INT,
                [gl.INT]: gl.INT
            },
            shaderType: 'ivec2',
            shaderDataFormat: gl.INT
        },
        [gl.R32UI]: {
            format: gl.RED_INTEGER,
            type: {
                default: gl.UNSIGNED_INT,
                [gl.UNSIGNED_INT]: gl.UNSIGNED_INT
            },
            shaderType: 'uint',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RG8I]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.BYTE,
                [gl.BYTE]: gl.BYTE
            },
            shaderType: 'ivec2',
            shaderDataFormat: gl.INT
        },
        [gl.RG8UI]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'uvec2',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RG16I]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.SHORT,
                [gl.SHORT]: gl.SHORT
            },
            shaderType: 'ivec2',
            shaderDataFormat: gl.INT
        },
        [gl.RG16UI]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.UNSIGNED_SHORT,
                [gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
            },
            shaderType: 'uvec2',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RG32UI]: {
            format: gl.RG_INTEGER,
            type: {
                default: gl.UNSIGNED_INT,
                [gl.UNSIGNED_INT]: gl.UNSIGNED_INT
            },
            shaderType: 'uvec2',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RGBA8I]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.BYTE,
                [gl.BYTE]: gl.BYTE
            },
            shaderType: 'ivec4',
            shaderDataFormat: gl.INT
        },
        [gl.RGBA8UI]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
            },
            shaderType: 'uvec4',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RGBA16I]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.SHORT,
                [gl.SHORT]: gl.SHORT
            },
            shaderType: 'ivec4',
            shaderDataFormat: gl.INT
        },
        [gl.RGBA16UI]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.UNSIGNED_SHORT,
                [gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
            },
            shaderType: 'uvec4',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RGBA32I]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.INT,
                [gl.INT]: gl.INT
            },
            shaderType: 'ivec4',
            shaderDataFormat: gl.INT
        },
        [gl.RGBA32UI]: {
            format: gl.RGBA_INTEGER,
            type: {
                default: gl.UNSIGNED_INT,
                [gl.UNSIGNED_INT]: gl.UNSIGNED_INT
            },
            shaderType: 'uvec4',
            shaderDataFormat: gl.UNSIGNED_INT
        },
        [gl.RGBA]: {
            format: gl.RGBA,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4,
                [gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1
            },
            shaderType: 'vec4',
            shaderDataFormat: gl.FLOAT
        },
        [gl.RGB]: {
            format: gl.RGB,
            type: {
                default: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
                [gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
            },
            shaderType: 'vec3',
            shaderDataFormat: gl.FLOAT
        }
    };

    function getStride(format) {
        return formatInfo[format].channels;
    };

    function getFormat(internalFormat) {
        return internalFormatsInfo[internalFormat].format;
    };

    function getType(internalFormat, type = null) {
        return internalFormatsInfo[internalFormat].type[type || 'default'];
    };

    function getShaderDataType(shaderDataFormat, channels) {
        return shaderDataFormatInfo[shaderDataFormat].shaderDataType[channels];
    };

    function getArrayType(type) {
        return typeInfo[type].arrayType;
    };

    function getShaderDataFormat(internalFormat) {
        return internalFormatsInfo[internalFormat].shaderDataFormat;
    };

    function getSamplerDataType(shaderDataFormat) {
        return shaderDataFormatInfo[shaderDataFormat].samplerDataType;
    };

    function getBaseShaderDataType(shaderDataFormat) {
        return shaderDataFormatInfo[shaderDataFormat].base;
    };

    return {
        viewPortSources,
        typeInfo,
        formatInfo,
        shaderDataFormatInfo,
        internalFormatsInfo,
        glParams,
        getStride,
        getFormat,
        getType,
        getShaderDataType,
        getArrayType,
        getShaderDataFormat,
        getSamplerDataType,
        getBaseShaderDataType,
    }
}

export { getTypesInfo };
