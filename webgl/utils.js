function glInit(canvas, options = {}) {
	options = {
		alpha: false,
		depth: false,
		stencil: false,
		desynchronized: true,
		antialias: false,
		failIfMajorPerformanceCaveat: false,
		powerPreference: "default", // "high-performance , low-power"
		premultipliedAlpha: true,
		preserveDrawingBuffer: false,
		xrCompatible: false,
		...options
	}
	const gl = canvas.getContext("webgl2", options);
	if (!gl) {
		throw new Error("Unable to initialize WebGL2.");
	}
	if (!gl.getExtension('EXT_color_buffer_float')) {
		throw new Error('Error: EXT_color_buffer_float not supported.');
	}
	// const renderable = gl.getInternalformatParameter(
	// 	gl.RENDERBUFFER,
	// 	gl.RG8,
	// 	gl.SAMPLES
	// );
	// console.log("renderable", renderable);
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
	const shape = params.shape;
	// Generate stride calculations
	const strides = [];
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
	const shape = params.shape;
	// Calculate strides for each dimension
	const strides = [];
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
	const shape = params.shape;
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

function getFrameBufferStatusMsg(gl, frameBufferStatus) {
    if (frameBufferStatus == gl.FRAMEBUFFER_COMPLETE) 
        return 'The framebuffer is ready to display.';
    if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) 
        return 'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.';
    if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) 
        return 'There is no attachment.';
    if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) 
        return 'Height and width of the attachment are not the same.';
    if (frameBufferStatus == gl.FRAMEBUFFER_UNSUPPORTED) 
        return 'The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.';
    if (frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE) 
        return 'The values of gl.RENDERBUFFER_SAMPLES are different among attached renderbuffers, or are non-zero if the attached images are a mix of renderbuffers and textures.';
    
    // Handle OVR_multiview2 extension if available
    const multiviewExt = gl.getExtension('OVR_multiview2');
    if (multiviewExt && frameBufferStatus == multiviewExt.FRAMEBUFFER_INCOMPLETE_VIEW_TARGETS_OVR) 
        return 'The baseViewIndex is not the same for all framebuffer attachment points where the value of FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE is not NONE.';
    
    return `Unknown framebuffer status: ${frameBufferStatus}`;
}

export { 
	glInit,
	getTexSize,
	flattenArray,
	getShapedArraySize,
	generateIndexMacro,
	generateShapedIndexMacro,
	generateNextShapedIndexMacro,
	unflattenArray,
	getFrameBufferStatusMsg
};
