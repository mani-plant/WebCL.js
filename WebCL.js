function initGL(canvas) {
	let gl = canvas.getContext("webgl2", {
		alpha: false,
		depth: false,
		stencil: false,
		desynchronized: true,
		antialias: false,
		failIfMajorPerformanceCaveat: false,
		powerPreference: "default", // "high-performance , low-power"
		premultipliedAlpha: true,
		preserveDrawingBuffer: false,
		xrCompatible: false
	});
	if (!gl) {
		throw new Error("Unable to initialize WebGL2.");
	}
	if (!gl.getExtension('EXT_color_buffer_float')) {
		throw new Error('Error: EXT_color_buffer_float not supported.');
	}
	const renderable = gl.getInternalformatParameter(
		gl.RENDERBUFFER,
		gl.RG8,
		gl.SAMPLES
	);
	console.log("renderable", renderable);
	return gl;
}

function getTexSize(size, stride) {
	return Math.ceil(Math.sqrt(size / stride));
}
function flattenArray(arr, shape) {
	if (!Array.isArray(arr)) return [arr];

	let result = [];
	if (shape.length === 1) {
		return arr;
	}

	for (let i = 0; i < arr.length; i++) {
		result = result.concat(flattenArray(arr[i], shape.slice(1)));
	}
	return result;
}
function getShapedArraySize(shape) {
	let size = 1;
	for (let i = 0; i < shape.length; i++) {
		size *= shape[i];
	}
	return size;
}

function generateIndexMacro(params, suffix = '') {
	let shape = params.shape;
	// Generate stride calculations
	let strides = [];
	let stride = 1;
	for (let i = shape.length - 1; i >= 0; i--) {
		strides.unshift(stride);
		stride *= shape[i];
	}

	// Create macro
	let macro = `#define _webcl_getFlatIndex${suffix}(`;

	// Add index parameters
	for (let i = 0; i < shape.length; i++) {
		macro += `i${i}${i < shape.length - 1 ? ',' : ''} `;
	}
	macro += ') (';

	// Add index calculation
	macro += shape.map((_, i) =>
		`(i${i}) * ${strides[i]}.`
	).join(' + ');

	macro += ')';
	return macro;
}
function generateShapedIndexMacro(params, suffix = '') {
	let shape = params.shape;
	// Calculate strides for each dimension
	let strides = [];
	let stride = 1;
	// Walk backwards through the shape array to compute strides (e.g., for [a,b,c], strides[0] = b*c, strides[1] = c, strides[2] = 1)
	for (let i = shape.length - 1; i >= 0; i--) {
		strides.unshift(stride);
		stride *= shape[i];
	}

	// Begin macro definition.
	// The resulting macro will have (1 + shape.length) parameters: the flat index and one output per dimension.
	let macro = `#define _webcl_getShapedIndex${suffix}(flat_index, shaped_index) do { \\\n`;
	macro += `float _rem = (flat_index); \\\n`;

	// For each dimension, compute the index and update _rem.
	for (let i = 0; i < shape.length; i++) {
		if (i < shape.length - 1) {
			macro += `    shaped_index[${i}] = floor(_rem / (${strides[i]}.)); \\\n`;
			macro += `    _rem = mod(_rem, (${strides[i]}.)); \\\n`;
		} else {
			// For the last dimension, _rem is the result.
			macro += `    shaped_index[${i}] = _rem; \\\n`;
		}
	}
	macro += `} while(false)\n`;
	return macro;
}
function generateNextShapedIndexMacro(params, suffix = '') {
	let shape = params.shape;
	const dims = shape.length;
	let macro = `#define _webcl_nextShapedIndex${suffix}(shaped_index) do { \\\n`;

	// Start with a carry of 1.0, since we want to add one to the index.
	macro += "    float _carry = 1.0; \\\n";

	// For each dimension, from the last (least-significant) to the first:
	for (let d = dims - 1; d >= 0; d--) {
		macro += "    { \\\n";
		// Compute a temporary value (the old index plus the current carry)
		macro += `        float _tmp = shaped_index[${d}] + _carry; \\\n`;
		// New value is the remainder of _tmp divided by the size in that dimension
		macro += `        shaped_index[${d}] = mod(_tmp, (${shape[d]}.)); \\\n`;
		// Carry is the quotient of _tmp divided by shape[d]
		macro += `        _carry = floor(_tmp / (${shape[d]}.)); \\\n`;
		macro += "    } \\\n";
	}

	macro += "} while(false)";
	return macro;
}

function unflattenArray(flatArr, shape) {
	// Base case: 1D array
	if (shape.length === 1) {
		return Array.from(flatArr.slice(0, shape[0]));
	}

	// Recursive case: create sub-arrays
	const result = [];
	const subArraySize = shape.slice(1).reduce((a, b) => a * b, 1);

	for (let i = 0; i < shape[0]; i++) {
		const start = i * subArraySize;
		const subArray = flatArr.slice(start, start + subArraySize);
		result.push(unflattenArray(subArray, shape.slice(1)));
	}

	return result;
}

export function GPU(canvas = null) {
	let gl = initGL(canvas || document.createElement('canvas'));
	const typeToArrayType = {
		[gl.BYTE]: Int8Array,
		[gl.UNSIGNED_BYTE]: Uint8Array,
		[gl.SHORT]: Int16Array,
		[gl.UNSIGNED_SHORT]: Uint16Array,
		[gl.UNSIGNED_SHORT_5_6_5]: Uint16Array,
		[gl.UNSIGNED_SHORT_5_5_5_1]: Uint16Array,
		[gl.UNSIGNED_SHORT_4_4_4_4]: Uint16Array,
		[gl.INT]: Int32Array,
		[gl.UNSIGNED_INT]: Uint32Array,
		[gl.UNSIGNED_INT_5_9_9_9_REV]: Uint32Array,
		[gl.UNSIGNED_INT_2_10_10_10_REV]: Uint32Array,
		[gl.UNSIGNED_INT_10F_11F_11F_REV]: Uint32Array,
		[gl.UNSIGNED_INT_24_8]: Uint32Array,
		[gl.HALF_FLOAT]: Uint16Array,
		[gl.FLOAT]: Float32Array
	};
	const formatToStride = {
		[gl.RGBA]: 4,
		[gl.RGB]: 3,
		[gl.RG]: 2,
		[gl.RED]: 1,
		[gl.RGBA_INTEGER]: 4,
		[gl.RGB_INTEGER]: 3,
		[gl.RG_INTEGER]: 2,
		[gl.RED_INTEGER]: 1,
	}
	const internalFormatsInfo = {
		[gl.RGBA32F]: {
			format: gl.RGBA,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT
			},
			shaderType: 'vec4'
		},
		[gl.R11F_G11F_B10F]: {
			format: gl.RGB,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT,
				[gl.UNSIGNED_INT_10F_11F_11F_REV]: gl.UNSIGNED_INT_10F_11F_11F_REV
			},
			shaderType: 'vec3'
		},
		[gl.RG32F]: {
			format: gl.RG,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT
			},
			shaderType: 'vec2'
		},
		[gl.R32F]: {
			format: gl.RED,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT
			},
			shaderType: 'float'
		},
		[gl.RGBA16F]: {
			format: gl.RGBA,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT
			},
			shaderType: 'vec4'
		},
		[gl.RG16F]: {
			format: gl.RG,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT
			},
			shaderType: 'vec2'
		},
		[gl.R16F]: {
			format: gl.RED,
			type: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT
			},
			shaderType: 'float'
		},
		[gl.R8]: {
			format: gl.RED,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'float'
		},
		[gl.RG8]: {
			format: gl.RG,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'vec2'
		},
		[gl.RGB8]: {
			format: gl.RGB,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'vec3'
		},
		[gl.RGB565]: {
			format: gl.RGB,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'vec3'
		},
		[gl.RGBA4]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4
			},
			shaderType: 'vec4'
		},
		[gl.RGB5_A1]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1,
				[gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
			},
			shaderType: 'vec4'
		},
		[gl.RGBA8]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'vec4'
		},
		[gl.RGB10_A2]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_INT_2_10_10_10_REV,
				[gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
			},
			shaderType: 'vec4'
		},
		[gl.RGB10_A2UI]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.UNSIGNED_INT_2_10_10_10_REV,
				[gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV
			},
			shaderType: 'uvec4'
		},
		[gl.SRGB8_ALPHA8]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'vec4'
		},
		[gl.R8I]: {
			format: gl.RED_INTEGER,
			type: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE
			},
			shaderType: 'int'
		},
		[gl.R8UI]: {
			format: gl.RED_INTEGER,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'uint'
		},
		[gl.R16I]: {
			format: gl.RED_INTEGER,
			type: {
				default: gl.SHORT,
				[gl.SHORT]: gl.SHORT
			},
			shaderType: 'int'
		},
		[gl.R16UI]: {
			format: gl.RED_INTEGER,
			type: {
				default: gl.UNSIGNED_SHORT,
				[gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
			},
			shaderType: 'uint'
		},
		[gl.RG32I]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.INT,
				[gl.INT]: gl.INT
			},
			shaderType: 'ivec2'
		},
		[gl.R32UI]: {
			format: gl.RED_INTEGER,
			type: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT
			},
			shaderType: 'uint'
		},
		[gl.RG8I]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE
			},
			shaderType: 'ivec2'
		},
		[gl.RG8UI]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'uvec2'
		},
		[gl.RG16I]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.SHORT,
				[gl.SHORT]: gl.SHORT
			},
			shaderType: 'ivec2'
		},
		[gl.RG16UI]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.UNSIGNED_SHORT,
				[gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
			},
			shaderType: 'uvec2'
		},
		[gl.RG32UI]: {
			format: gl.RG_INTEGER,
			type: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT
			},
			shaderType: 'uvec2'
		},
		[gl.RGBA8I]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE
			},
			shaderType: 'ivec4'
		},
		[gl.RGBA8UI]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE
			},
			shaderType: 'uvec4'
		},
		[gl.RGBA16I]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.SHORT,
				[gl.SHORT]: gl.SHORT
			},
			shaderType: 'ivec4'
		},
		[gl.RGBA16UI]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.UNSIGNED_SHORT,
				[gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT
			},
			shaderType: 'uvec4'
		},
		[gl.RGBA32I]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.INT,
				[gl.INT]: gl.INT
			},
			shaderType: 'ivec4'
		},
		[gl.RGBA32UI]: {
			format: gl.RGBA_INTEGER,
			type: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT
			},
			shaderType: 'uvec4'
		},
		[gl.RGBA]: {
			format: gl.RGBA,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4,
				[gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1
			},
			shaderType: 'vec4'
		},
		[gl.RGB]: {
			format: gl.RGB,
			type: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
			},
			shaderType: 'vec3'
		}
	};
	function getStride(internalFormat) {
		let internalFormatToStride = {
			[gl.RGBA32F]: 4,
			[gl.R11F_G11F_B10F]: 3,
			[gl.RG32F]: 2,
			[gl.R32F]: 1,
			[gl.RGBA16F]: 4,
			[gl.RG16F]: 2,
			[gl.R16F]: 1,
			[gl.R8]: 1,
			[gl.RG8]: 2,
			[gl.RGB8]: 3,
			[gl.RGB565]: 3,
			[gl.RGBA4]: 4,
			[gl.RGB5_A1]: 4,
			[gl.RGBA8]: 4,
			[gl.RGB10_A2]: 4,
			[gl.RGB10_A2UI]: 4,
			[gl.SRGB8_ALPHA8]: 4,
			[gl.R8I]: 1,
			[gl.R8UI]: 1,
			[gl.R16I]: 1,
			[gl.R16UI]: 1,
			[gl.RG32I]: 2,
			[gl.R32UI]: 1,
			[gl.RG8I]: 2,
			[gl.RG8UI]: 2,
			[gl.RG16I]: 2,
			[gl.RG16UI]: 2,
			[gl.RG32I]: 2,
			[gl.RG32UI]: 2,
			[gl.RGBA8I]: 4,
			[gl.RGBA8UI]: 4,
			[gl.RGBA16I]: 4,
			[gl.RGBA16UI]: 4,
			[gl.RGBA32I]: 4,
			[gl.RGBA32UI]: 4,
			[gl.RGBA]: 4,
			[gl.RGB]: 3,
		};
		return internalFormatToStride[internalFormat];
	}

	function getFormat(internalFormat) {
		let internalFormatToFormat = {
			[gl.RGBA32F]: gl.RGBA,
			[gl.R11F_G11F_B10F]: gl.RGB,
			[gl.RG32F]: gl.RG,
			[gl.R32F]: gl.RED,
			[gl.RGBA16F]: gl.RGBA,
			[gl.RG16F]: gl.RG,
			[gl.R16F]: gl.RED,
			[gl.R8]: gl.RED,
			[gl.RG8]: gl.RG,
			[gl.RGB8]: gl.RGB,
			[gl.RGB565]: gl.RGB,
			[gl.RGBA4]: gl.RGBA,
			[gl.RGB5_A1]: gl.RGBA,
			[gl.RGBA8]: gl.RGBA,
			[gl.RGB10_A2]: gl.RGBA,
			[gl.RGB10_A2UI]: gl.RGBA,
			[gl.SRGB8_ALPHA8]: gl.RGBA,
			[gl.R8I]: gl.RED_INTEGER,
			[gl.R8UI]: gl.RED_INTEGER,
			[gl.R16I]: gl.RED_INTEGER,
			[gl.R16UI]: gl.RED_INTEGER,
			[gl.RG32I]: gl.RG_INTEGER,
			[gl.R32UI]: gl.RED_INTEGER,
			[gl.RG8I]: gl.RG_INTEGER,
			[gl.RG8UI]: gl.RG_INTEGER,
			[gl.RG16I]: gl.RG_INTEGER,
			[gl.RG16UI]: gl.RG_INTEGER,
			[gl.RG32I]: gl.RG_INTEGER,
			[gl.RG32UI]: gl.RG_INTEGER,
			[gl.RGBA8I]: gl.RGBA_INTEGER,
			[gl.RGBA8UI]: gl.RGBA_INTEGER,
			[gl.RGBA16I]: gl.RGBA_INTEGER,
			[gl.RGBA16UI]: gl.RGBA_INTEGER,
			[gl.RGBA32I]: gl.RGBA_INTEGER,
			[gl.RGBA32UI]: gl.RGBA_INTEGER,
			[gl.RGBA]: gl.RGBA,
			[gl.RGB]: gl.RGB,
		};
		return internalFormatToFormat[internalFormat];
	}

	function getType(internalFormat, type = null) {
		let internalFormatToType = {
			[gl.RGBA32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.R11F_G11F_B10F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT,
				[gl.UNSIGNED_INT_10F_11F_11F_REV]: gl.UNSIGNED_INT_10F_11F_11F_REV,
			},
			[gl.RG32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.R32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.RGBA16F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT,
			},
			[gl.RG16F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT,
			},
			[gl.R16F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
				[gl.HALF_FLOAT]: gl.HALF_FLOAT,
			},
			[gl.R8]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RG8]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RGB8]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RGB565]: {
				default: gl.UNSIGNED_SHORT_5_6_5,
				[gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RGBA4]: {
				default: gl.UNSIGNED_SHORT_4_4_4_4,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4,
			},
			[gl.RGB5_A1]: {
				default: gl.UNSIGNED_SHORT_5_5_5_1,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1,
			},
			[gl.RGBA8]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RGB10_A2]: {
				default: gl.UNSIGNED_INT_2_10_10_10_REV,
				[gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV,
			},
			[gl.RGB10_A2UI]: {
				default: gl.UNSIGNED_INT_2_10_10_10_REV,
				[gl.UNSIGNED_INT_2_10_10_10_REV]: gl.UNSIGNED_INT_2_10_10_10_REV,
			},
			[gl.SRGB8_ALPHA8]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.R8I]: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE,
			},
			[gl.R8UI]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.R16I]: {
				default: gl.SHORT,
				[gl.SHORT]: gl.SHORT,
			},
			[gl.R16UI]: {
				default: gl.UNSIGNED_SHORT,
				[gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT,
			},
			[gl.RG32I]: {
				default: gl.INT,
				[gl.INT]: gl.INT,
			},
			[gl.R32UI]: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT,
			},
			[gl.RG8I]: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE,
			},
			[gl.RG32I]: {
				default: gl.INT,
				[gl.INT]: gl.INT,
			},
			[gl.RG32UI]: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT,
			},
			[gl.RGBA8I]: {
				default: gl.BYTE,
				[gl.BYTE]: gl.BYTE,
			},
			[gl.RGBA8UI]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
			},
			[gl.RGBA16I]: {
				default: gl.SHORT,
				[gl.SHORT]: gl.SHORT,
			},
			[gl.RGBA16UI]: {
				default: gl.UNSIGNED_SHORT,
				[gl.UNSIGNED_SHORT]: gl.UNSIGNED_SHORT,
			},
			[gl.RGBA32I]: {
				default: gl.INT,
				[gl.INT]: gl.INT,
			},
			[gl.RGBA32UI]: {
				default: gl.UNSIGNED_INT,
				[gl.UNSIGNED_INT]: gl.UNSIGNED_INT,
			},
			[gl.RGBA]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_4_4_4_4]: gl.UNSIGNED_SHORT_4_4_4_4,
				[gl.UNSIGNED_SHORT_5_5_5_1]: gl.UNSIGNED_SHORT_5_5_5_1,
			},
			[gl.RGB]: {
				default: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_BYTE]: gl.UNSIGNED_BYTE,
				[gl.UNSIGNED_SHORT_5_6_5]: gl.UNSIGNED_SHORT_5_6_5,
			},
		};
		if (type == null) {
			return internalFormatToType[internalFormat].default;
		}
		return internalFormatToType[internalFormat][type];
	}

	function getShaderDataType(internalFormat) {
		let internalFormatToShaderType = {
			[gl.RGBA32F]: 'vec4',
			[gl.R11F_G11F_B10F]: 'vec3',
			[gl.RG32F]: 'vec2',
			[gl.R32F]: 'float',
			[gl.RGBA16F]: 'vec4',
			[gl.RG16F]: 'vec2',
			[gl.R16F]: 'float',
			[gl.R8]: 'float',
			[gl.RG8]: 'vec2',
			[gl.RGB8]: 'vec3',
			[gl.RGB565]: 'vec3',
			[gl.RGBA4]: 'vec4',
			[gl.RGB5_A1]: 'vec4',
			[gl.RGBA8]: 'vec4',
			[gl.RGB10_A2]: 'vec4',
			[gl.RGB10_A2UI]: 'vec4',
			[gl.SRGB8_ALPHA8]: 'vec4',
			[gl.R8I]: 'int',
			[gl.R8UI]: 'uint',
			[gl.R16I]: 'int',
			[gl.R16UI]: 'uint',
			[gl.RG32I]: 'ivec2',
			[gl.R32UI]: 'uint',
			[gl.RG8I]: 'ivec2',
			[gl.RG8UI]: 'uvec2',
			[gl.RG16I]: 'ivec2',
			[gl.RG16UI]: 'uvec2',
			[gl.RG32I]: 'ivec2',
			[gl.RG32UI]: 'uvec2',
			[gl.RGBA8I]: 'ivec4',
			[gl.RGBA8UI]: 'uvec4',
			[gl.RGBA16I]: 'ivec4',
			[gl.RGBA16UI]: 'uvec4',
			[gl.RGBA32I]: 'ivec4',
			[gl.RGBA32UI]: 'uvec4',
			[gl.RGBA]: 'vec4',
			[gl.RGB]: 'vec3',
		};
		return internalFormatToShaderType[internalFormat];
	}

	function getArrayType(internalFormat, arrayType = null) {
		let internalFormatToArrayType = {
			[gl.RGBA32F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.R11F_G11F_B10F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RG32F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.R32F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGBA16F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RG16F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.R16F]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.R8]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RG8]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGB8]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGB565]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGBA4]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGB5_A1]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGBA8]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGB10_A2]: {
				default: Float32Array,
				[Float32Array]: Float32Array,
			},
			[gl.RGB10_A2UI]: {
				default: Uint8ClampedArray,
				[Uint32Array]: Uint32Array,
				[Uint8ClampedArray]: Uint8ClampedArray,
			},
			[gl.SRGB8_ALPHA8]: {
				default: Uint32Array,
				[Float32Array]: Uint32Array,
			},
			[gl.R8I]: {
				default: Int8Array,
				[Int8Array]: Int8Array,
			},
			[gl.R8UI]: {
				default: Uint8Array,
				[Uint8Array]: Uint8Array,
			},
			[gl.R16I]: {
				default: Int16Array,
				[Int16Array]: Int16Array,
			},
			[gl.R16UI]: {
				default: Uint16Array,
				[Uint16Array]: Uint16Array,
			},
			[gl.RG32I]: {
				default: Int32Array,
				[Int32Array]: Int32Array,
			},
			[gl.R32UI]: {
				default: Uint32Array,
				[Uint32Array]: Uint32Array,
			},
			[gl.RG8I]: {
				default: Int8Array,
				[Int8Array]: Int8Array,
			},
			[gl.RG8UI]: {
				default: Uint8Array,
				[Uint8Array]: Uint8Array,
			},
			[gl.RG16I]: {
				default: Int16Array,
				[Int16Array]: Int16Array,
			},
			[gl.RG16UI]: {
				default: Uint16Array,
				[Uint16Array]: Uint16Array,
			},
			[gl.RGBA8I]: {
				default: Int8Array,
				[Int8Array]: Int8Array,
			},
			[gl.RGBA8UI]: {
				default: Uint8Array,
				[Uint8Array]: Uint8Array,
			},
			[gl.RGBA16I]: {
				default: Int16Array,
				[Int16Array]: Int16Array,
			},
			[gl.RGBA16UI]: {
				default: Uint16Array,
				[Uint16Array]: Uint16Array,
			},
			[gl.RGBA32I]: {
				default: Int32Array,
				[Int32Array]: Int32Array,
			},
			[gl.RGBA32UI]: {
				default: Uint32Array,
				[Uint32Array]: Uint32Array,
			},
			[gl.RGBA]: {
				default: Uint8Array,
				[Uint8Array]: Uint8Array,
			},
			[gl.RGB]: {
				default: Uint8Array,
				[Uint8Array]: Uint8Array,
			},
		};
		if (arrayType == null) {
			return internalFormatToArrayType[internalFormat].default;
		}
		return internalFormatToArrayType[internalFormat][arrayType];
	}

	function BufferParams(shape, internalFormat, type = null, arrayType = null) {
		this.size = getShapedArraySize(shape);
		this.shape = shape;
		this.internalFormat = internalFormat;
		this.stride = getStride(internalFormat);
		this.texSize = getTexSize(this.size, this.stride);
		this.format = getFormat(internalFormat);
		this.type = getType(internalFormat, type);
		this.shaderDataType = getShaderDataType(internalFormat);
		this.arrayType = getArrayType(internalFormat, arrayType);
	}
	function getFrameBufferStatusMsg(frameBufferStatus) {
		if (frameBufferStatus == gl.FRAMEBUFFER_COMPLETE) return 'The framebuffer is ready to display.';
		if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) return 'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.';
		if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) return 'There is no attachment.';
		if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) return 'Height and width of the attachment are not the same.';
		if (frameBufferStatus == gl.FRAMEBUFFER_UNSUPPORTED) return 'The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.';
		// When using a WebGL 2 context, the following values can be returned additionally:
		// gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: The values of gl.RENDERBUFFER_SAMPLES are different among attached renderbuffers, or are non-zero if the attached images are a mix of renderbuffers and textures.
		// When using the OVR_multiview2 extension, the following value can be returned additionally:
		// ext.FRAMEBUFFER_INCOMPLETE_VIEW_TARGETS_OVR: If baseViewIndex is not the same for all framebuffer attachment points where the value of FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE is not NONE, the framebuffer is considered incomplete
		return 'unknown status';
	}

	let maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
	let maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
	let maxColorUnits = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
	function newBuffer(data, f, e) {
		let buf = gl.createBuffer();
		gl.bindBuffer((e || gl.ARRAY_BUFFER), buf);
		gl.bufferData((e || gl.ARRAY_BUFFER), new (f || Float32Array)(data), gl.STATIC_DRAW);
		return buf;
	}
	let positionBuffer = newBuffer([-1, -1, 1, -1, 1, 1, -1, 1]);
	let textureBuffer = newBuffer([0, 0, 1, 0, 1, 1, 0, 1]);
	let indexBuffer = newBuffer([1, 2, 0, 3, 0, 2], Uint16Array, gl.ELEMENT_ARRAY_BUFFER);

	let vertexShaderCode = "#version 300 es" +
		"\n" +
		"precision highp float;\n" +
		"in vec2 _webcl_position;\n" +
		"out vec2 _webcl_pos;\n" +
		"in vec2 _webcl_texture;\n" +
		"\n" +
		"void main(void) {\n" +
		"  _webcl_pos = _webcl_texture;\n" +
		"  gl_Position = vec4(_webcl_position.xy, 0.0, 1.0);\n" +
		"}";
	let vertexShader = gl.createShader(gl.VERTEX_SHADER);
	this.free = function () {
		gl.deleteShader(vertexShader);
		gl.deleteBuffer(positionBuffer);
		gl.deleteBuffer(textureBuffer);
		gl.deleteBuffer(indexBuffer);
	}
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		throw new Error(
			"\nError: Vertex shader build failed\n" + "\n" +
			"--- CODE DUMP ---\n" + vertexShaderCode + "\n\n" +
			"--- ERROR LOG ---\n" + gl.getShaderInfoLog(vertexShader)
		);
	}
	function Buffer(shape, arr = null, internalFormat = gl.RG8, type = null, arrayType = null) {
		let params = new BufferParams(shape, internalFormat, type, arrayType);
		let size = params.size;
		let texSize = params.texSize;
		let stride = params.stride;
		let format = params.format;
		type = params.type;
		let texture = null;
		let data = new params.arrayType(texSize * texSize * stride);
		if (!(size > 0)) {
			throw new Error("Buffer size must be > 0");
		}
		// this.mem = Math.pow(4, Math.ceil(Math.log(this.length) / Math.log(4)));
		if (texSize > maxTextureSize) {
			throw new Error("ERROR: Texture size not supported!");
		}

		this.set = function (arr) {
			let flatArr = flattenArray(arr, shape);
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
				throw new Error('Framebuffer not complete: ' + getFrameBufferStatusMsg(frameBufferStatus));
			}

			// Read the pixels
			gl.readPixels(0, 0, texSize, texSize, format, type, data);

			// Cleanup
			gl.deleteFramebuffer(fbo);

			return data;
		}
		this.getShapedData = function () {
			return unflattenArray(data, shape);
		}
		this.data = data;
		this.params = params;
		this.texture = texture;
	}
	function Program(inpParams, opParams, code, libCode = '', pixelCode = '') {
		let inpShapes = inpParams.map(x => x.shape);
		let opShapes = opParams.map(x => x.shape);
		let inpSize = inpParams.map(x => x.size);
		let opSize = opParams.map(x => x.size);
		let inpTexSize = inpParams.map(x => x.texSize);
		let opStride = opParams.map(x => x.stride);
		let inpStride = inpParams.map(x => x.stride);
		// let inpSize = inpShapes.map(x => getShapedArraySize(x));
		// let opSize = opShapes.map(x => getShapedArraySize(x));
		if (!(opSize.length > 0)) {
			throw new Error("output length >0 required");
		}
		if (inpSize.length > maxTextureUnits) {
			throw new Error("max input buffers supported = ", maxTextureUnits);
		}
		if (opSize.length > maxColorUnits) {
			throw new Error("max output buffers supported = ", maxColorUnits);
		}

		let sizeO = opParams[0].texSize;
		let fragmentShaderCode = `#version 300 es
		precision highp float;
		${inpSize.length ? `float _webcl_inpSize[${inpSize.length}] = float[](${inpSize.join('.,')}.);` : ''}
		float _webcl_opSize[${opSize.length}] = float[](${opSize.join('.,')}.);
		float _webcl_opStride[${opStride.length}] = float[](${opStride.join('.,')}.);
		${inpStride.length ? `float _webcl_inpStride[${inpStride.length}] = float[](${inpStride.join('.,')}.);` : ''}
		${inpTexSize.length ? `float _webcl_sizeI[${inpTexSize.length}] = float[](${inpTexSize.map(x => x + '.').join(',')});\nuniform sampler2D _webcl_uTexture[${inpTexSize.length}];` : ''}
		float _webcl_sizeO = ${sizeO}.;
		in vec2 _webcl_pos;
		#define _webcl_getTexIndex() ( (_webcl_pos.y*_webcl_sizeO - 0.5)*_webcl_sizeO + (_webcl_pos.x*_webcl_sizeO - 0.5) )
        #define _webcl_getFlatIndex(n) (_webcl_getTexIndex()*_webcl_opStride[n] + _webcl_i)
		${opParams.map((x, i) => `layout(location = ${i}) out ${x.shaderDataType} _webcl_out${i};`).join('\n')}
		
		#define _webcl_readInFlat(n,i) texture(_webcl_uTexture[n], (0.5 + vec2(mod(floor(i/_webcl_inpStride[n]), _webcl_sizeI[n]), floor(floor(i/_webcl_inpStride[n])/_webcl_sizeI[n])))/_webcl_sizeI[n])[int(mod(i, _webcl_inpStride[n]))]
		${inpSize.map((x, i) => `#define _webcl_readInFlat${i}(i) _webcl_readInFlat(${i},i)`).join('\n')}
		${opParams.map((x, i) => `#define _webcl_commitFlat${i}(val) _webcl_out${i}${x.shaderDataType !== 'float' ? '[_webcl_I]' : ''} = val * _webcl_mask${i}`).join('\n')}
		${inpParams.map((x, i) => generateIndexMacro(x, 'In' + i)).join('\n')}
		${opParams.map((x, i) => generateIndexMacro(x, 'Out' + i)).join('\n')}
		${inpShapes.map((x, i) => `#define _webcl_readIn${i}(${x.map((x, i) => 'x' + i).join(',')}) _webcl_readInFlat${i}(_webcl_getFlatIndexIn${i}(${x.map((x, i) => 'x' + i).join(',')}))`).join('\n')}
		${opShapes.map((x, i) => `#define _webcl_commitOut${i}(val) _webcl_commitFlat${i}(val)`).join('\n')}
		${opParams.map((x, i) => generateShapedIndexMacro(x, 'Out' + i)).join('\n')}
		${opParams.map((x, i) => generateNextShapedIndexMacro(x, 'Out' + i)).join('\n')}
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
								float _webcl_mask${i} = step(_webcl_flatIndex${i}+0.5, _webcl_opSize[${i}]);
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
									_webcl_mask${i} = step(_webcl_flatIndex${i}+0.5, _webcl_opSize[${i}]);
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
		console.log(vertexShaderCode);
		console.log(fragmentShaderCode);
		let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

		gl.shaderSource(
			fragmentShader,
			fragmentShaderCode
		);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			let LOC = (fragmentShaderCode).split('\n');
			let dbgMsg = "ERROR: Could not build shader (fatal).\n\n------------------ KERNEL CODE DUMP ------------------\n"
			for (let nl = 0; nl < LOC.length; nl++)
				dbgMsg += (1 + nl) + "> " + LOC[nl] + "\n";
			dbgMsg += "\n--------------------- ERROR  LOG ---------------------\n" + gl.getShaderInfoLog(fragmentShader)
			throw new Error(dbgMsg);
		}
		let program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);


		this.new = function (newInpSize, newOpSize) {
			return new Program(newInpSize, newOpSize, code);
		}
		let fbo = null;
		this.exec = function (inp, op, transferOutput = false, transferIndices = null, previewIndex = 0) {
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS))
				throw new Error('ERROR: Can not link GLSL program!');
			let v_texture = [];
			for (let i = 0; i < inp.length; i++) {
				v_texture.push(gl.getUniformLocation(program, '_webcl_uTexture[' + i + ']'));
			}
			let aPosition = gl.getAttribLocation(program, '_webcl_position');
			let aTexture = gl.getAttribLocation(program, '_webcl_texture');
			gl.viewport(0, 0, sizeO, sizeO);
			fbo = fbo || gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			let colAt = [];
			for (let i = 0; i < op.length; i++) {
				op[i].alloc();
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, op[i].texture, 0);
				colAt.push(gl.COLOR_ATTACHMENT0 + i);
			}
			let frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			if (frameBufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
				throw new Error('ERROR: ' + getFrameBufferStatusMsg(frameBufferStatus));
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
			gl.enableVertexAttribArray(aTexture);
			gl.vertexAttribPointer(aTexture, 2, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.enableVertexAttribArray(aPosition);
			gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

			gl.drawBuffers(colAt);


			gl.useProgram(program);
			for (let i = 0; i < inp.length; i++) {
				gl.activeTexture(gl.TEXTURE0 + i);
				gl.bindTexture(gl.TEXTURE_2D, inp[i].texture);
				gl.uniform1i(v_texture[i], i);
			}

			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
			if (transferOutput) {
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
			if (previewIndex !== null && previewIndex < op.length) {
				// console.log("previewIndex", previewIndex);
				gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
				gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
				gl.readBuffer(gl.COLOR_ATTACHMENT0 + previewIndex);

				// gl.canvas.width = op[previewIndex].texSize;
				// gl.canvas.height = op[previewIndex].texSize;
				// console.log("canvas", gl.canvas.width, gl.canvas.height);
				gl.blitFramebuffer(
					0, 0, op[previewIndex].params.texSize, op[previewIndex].params.texSize,  // source
					0, 0, gl.canvas.width, gl.canvas.height,                    // dest
					gl.COLOR_BUFFER_BIT,
					gl.NEAREST
				);
			}

		}

		this.free = function () {
			gl.deleteProgram(program);
			gl.deleteShader(fragmentShader);
			gl.deleteFramebuffer(fbo);
		}
	}

	this.Buffer = function (shape, arr = null) {
		return new Buffer(shape, arr);
	}

	this.Program = function (inp, op, code, libCode = '', pixelCode = '',) {
		return new Program(inp, op, code, libCode, pixelCode);
	}

}