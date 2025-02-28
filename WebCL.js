function initGL(canvas){
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
	if(!gl){
		throw new Error("Unable to initialize WebGL2.");
	}
	if (!gl.getExtension('EXT_color_buffer_float')){
		throw new Error('Error: EXT_color_buffer_float not supported.');
	}
	// const renderable = gl.getInternalformatParameter(
	// 	gl.RENDERBUFFER,
	// 	gl.R32F,
	// 	gl.SAMPLES
	// );
	// console.log("renderable", renderable);
	return gl;
}

function getTexSize(size, stride){
	return Math.ceil(Math.sqrt(size/stride));
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
function getShapedArraySize(shape){
	let size = 1;
	for(let i=0;i<shape.length;i++){
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
        macro += `i${i}${i < shape.length-1 ? ',' : ''} `;
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
	macro +=	`float _rem = (flat_index); \\\n`;
    
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

export function GPU(canvas = null){
	let gl = initGL(canvas || document.createElement('canvas'));
	function getStride(internalFormat){
		let internalFormatToStride = {
			[gl.RGBA32F]: 4,
			[gl.RGB32F]: 3,
			[gl.RG32F]: 2,
			[gl.R32F]: 1,
		};
		return internalFormatToStride[internalFormat];
	}
	
	function getFormat(internalFormat){
		let internalFormatToFormat = {
			[gl.RGBA32F]: gl.RGBA,
			[gl.RGB32F]: gl.RGB,
			[gl.RG32F]: gl.RG,
			[gl.R32F]: gl.RED,
		};
		return internalFormatToFormat[internalFormat];
	}
	
	function getType(internalFormat, type=null){
		let internalFormatToType = {
			[gl.RGBA32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.RGB32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.RG32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
			[gl.R32F]: {
				default: gl.FLOAT,
				[gl.FLOAT]: gl.FLOAT,
			},
		};
		if(type == null){
			return internalFormatToType[internalFormat].default;
		}
		return internalFormatToType[internalFormat][type];
	}
	
	function getShaderDataType(internalFormat){
		let internalFormatToShaderType = {
			[gl.RGBA32F]: 'vec4',
			[gl.RGB32F]: 'vec3',
			[gl.RG32F]: 'vec2',
			[gl.R32F]: 'float',
		};
		return internalFormatToShaderType[internalFormat];
	}
	function BufferParams(shape, internalFormat, type=null){
		this.size = getShapedArraySize(shape);
		this.shape = shape;
		this.internalFormat = internalFormat;
		this.stride = getStride(internalFormat);
		this.texSize = getTexSize(this.size, this.stride);
		this.format = getFormat(internalFormat);
		this.type = getType(internalFormat, type);
		this.shaderDataType = getShaderDataType(internalFormat);
	}
	function getFrameBufferStatusMsg(frameBufferStatus){
		if(frameBufferStatus == gl.FRAMEBUFFER_COMPLETE) return 'The framebuffer is ready to display.';
		if(frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) return 'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.';
		if(frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) return 'There is no attachment.';
		if(frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) return 'Height and width of the attachment are not the same.';
		if(frameBufferStatus == gl.FRAMEBUFFER_UNSUPPORTED) return 'The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.';
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
	let positionBuffer = newBuffer([ -1, -1, 1, -1, 1, 1, -1, 1 ]);
	let textureBuffer  = newBuffer([  0,  0, 1,  0, 1, 1,  0, 1 ]);
	let indexBuffer    = newBuffer([  1,  2, 0,  3, 0, 2 ], Uint16Array, gl.ELEMENT_ARRAY_BUFFER);
	
	let vertexShaderCode = "#version 300 es"+
	"\n"+
	"precision highp float;\n"+
	"in vec2 _webcl_position;\n" +
	"out vec2 _webcl_pos;\n" +
	"in vec2 _webcl_texture;\n" +
	"\n" +
	"void main(void) {\n" +
	"  _webcl_pos = _webcl_texture;\n" +
	"  gl_Position = vec4(_webcl_position.xy, 0.0, 1.0);\n" +
	"}";
	let vertexShader = gl.createShader(gl.VERTEX_SHADER);
	this.free = function() {
		gl.deleteShader(vertexShader);
		gl.deleteBuffer(positionBuffer);
		gl.deleteBuffer(textureBuffer);
		gl.deleteBuffer(indexBuffer);
	}
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
		throw new Error(
			"\nError: Vertex shader build failed\n" + "\n" +
			"--- CODE DUMP ---\n" + vertexShaderCode + "\n\n" +
			"--- ERROR LOG ---\n" + gl.getShaderInfoLog(vertexShader)
		);
	}
	function Buffer(shape, arr = null, internalFormat = gl.RGBA32F, type=null){
		let params = new BufferParams(shape, internalFormat, type);
		let size = params.size;
		let texSize = params.texSize;
		let stride = params.stride;
		let format = params.format;
		type = params.type;
		let texture = null;
		let data = new Float32Array(texSize*texSize*stride);
		if(!(size > 0)){
			throw new Error("Buffer size must be > 0");
		}
		// this.mem = Math.pow(4, Math.ceil(Math.log(this.length) / Math.log(4)));
		if (texSize > maxTextureSize){
			throw new Error("ERROR: Texture size not supported!");
		}
		
		this.set = function(arr){
			let flatArr = flattenArray(arr, shape);
			// Verify size matches shape
			if (flatArr.length !== size) {
				throw new Error(`Array size ${flatArr.length} doesn't match buffer shape ${shape} (size ${size})`);
			}
			for(let i=0;i<Math.min(data.length, size);i++){
				data[i] = flatArr[i];
			}
		}
		if(arr){
			this.set(arr);
		}
		this.alloc = function(){
			if(texture == null){
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
		this.free = function(){
			if(texture != null){
				gl.deleteTexture(texture);
			}
			this.texture = null;
			texture = null;
		}
		this.read = function() {
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
		this.getShapedData = function(){
			return unflattenArray(data, shape);
		}
		this.data = data;
		this.params = params;
		this.texture = texture;
	}
	function Program(inpParams, opParams, code, libCode='', pixelCode=''){
		let inpShapes = inpParams.map(x => x.shape);
		let opShapes = opParams.map(x => x.shape);
		let inpSize = inpParams.map(x => x.size);
		let opSize = opParams.map(x => x.size);
		let inpTexSize = inpParams.map(x => x.texSize);
		let opStride = opParams.map(x => x.stride);
		let inpStride = inpParams.map(x => x.stride);
		// let inpSize = inpShapes.map(x => getShapedArraySize(x));
		// let opSize = opShapes.map(x => getShapedArraySize(x));
		if(!(opSize.length > 0)){
			throw new Error("output length >0 required");
		}
		if(inpSize.length > maxTextureUnits){
			throw new Error("max input buffers supported = ", maxTextureUnits);
		}
		if(opSize.length > maxColorUnits){
			throw new Error("max output buffers supported = ", maxColorUnits);
		}

		let sizeO = opParams[0].texSize;
		let fragmentShaderCode = `#version 300 es
		precision highp float;
		${inpSize.length ? `float _webcl_inpSize[${inpSize.length}] = float[](${inpSize.join('.,')}.);` : ''}
		float _webcl_opSize[${opSize.length}] = float[](${opSize.join('.,')}.);
		float _webcl_opStride[${opStride.length}] = float[](${opStride.join('.,')}.);
		${inpStride.length ? `float _webcl_inpStride[${inpStride.length}] = float[](${inpStride.join('.,')}.);` : ''}
		${inpTexSize.length ? `float _webcl_sizeI[${inpTexSize.length}] = float[](${inpTexSize.map(x => x+'.').join(',')});\nuniform sampler2D _webcl_uTexture[${inpTexSize.length}];` : ''}
		float _webcl_sizeO = ${sizeO}.;
		in vec2 _webcl_pos;
		#define _webcl_getTexIndex() ( (_webcl_pos.y*_webcl_sizeO - 0.5)*_webcl_sizeO + (_webcl_pos.x*_webcl_sizeO - 0.5) )
        #define _webcl_getFlatIndex(n) (_webcl_getTexIndex()*_webcl_opStride[n] + _webcl_i)
		${opParams.map((x,i) => `layout(location = ${i}) out ${x.shaderDataType} _webcl_out${i};`).join('\n')}
		
		#define _webcl_readInFlat(n,i) texture(_webcl_uTexture[n], (0.5 + vec2(mod(floor(i/_webcl_inpStride[n]), _webcl_sizeI[n]), floor(floor(i/_webcl_inpStride[n])/_webcl_sizeI[n])))/_webcl_sizeI[n])[int(mod(i, _webcl_inpStride[n]))]
		${inpSize.map((x,i) => `#define _webcl_readInFlat${i}(i) _webcl_readInFlat(${i},i)`).join('\n')}
		${opParams.map((x,i) => `#define _webcl_commitFlat${i}(val) _webcl_out${i}${x.shaderDataType !== 'float' ? '[_webcl_I]' : ''} = val * _webcl_mask${i}`).join('\n')}
		${inpParams.map((x,i) => generateIndexMacro(x, 'In'+i)).join('\n')}
		${opParams.map((x,i) => generateIndexMacro(x, 'Out'+i)).join('\n')}
		${inpShapes.map((x,i) => `#define _webcl_readIn${i}(${x.map((x,i) => 'x'+i).join(',')}) _webcl_readInFlat${i}(_webcl_getFlatIndexIn${i}(${x.map((x,i) => 'x'+i).join(',')}))`).join('\n')}
		${opShapes.map((x,i) => `#define _webcl_commitOut${i}(val) _webcl_commitFlat${i}(val)`).join('\n')}
		${opParams.map((x,i) => generateShapedIndexMacro(x, 'Out'+i)).join('\n')}
		${opParams.map((x,i) => generateNextShapedIndexMacro(x, 'Out'+i)).join('\n')}
		${libCode}
		void main(void){
			${pixelCode}
			${
				[0,1,2,3].map(channel_index => {
					let out = ``;
					if(channel_index > 0){
						out += `
							#undef _webcl_i
							#undef _webcl_I
						`;
					}
					out += `
						#define _webcl_i ${channel_index}.
						#define _webcl_I ${channel_index}
					`;
					out += opParams.map((x,i) => {
						if(channel_index == 0){
							return `
								#define _webcl_available_out${i}
								float _webcl_index${i}[${x.shape.length}];
								float _webcl_flatIndex${i} = floor(_webcl_getFlatIndex(${i})); 
								_webcl_getShapedIndexOut${i}(_webcl_flatIndex${i}, _webcl_index${i});
								float _webcl_mask${i} = step(_webcl_flatIndex${i}+0.5, _webcl_opSize[${i}]);
							`
						}else{
							// if(x.stride == channel_index){
							// 	return `
							// 		#undef _webcl_available_out${i}
							// 	`;
							// }else 
							if(x.stride <= channel_index){
								return `
									#undef _webcl_available_out${i}
								`;
							}else{
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


		this.new = function(newInpSize, newOpSize){
			return new Program(newInpSize, newOpSize, code);
		}
		let fbo = null;
		this.exec = function(inp, op, transferOutput = false, transferIndices = null, previewIndex = 0){
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS))
				throw new Error('ERROR: Can not link GLSL program!');
			let v_texture = [];
			for(let i=0;i<inp.length;i++){
				v_texture.push(gl.getUniformLocation(program, '_webcl_uTexture['+i+']'));
			}
			let aPosition = gl.getAttribLocation(program, '_webcl_position');
			let aTexture = gl.getAttribLocation(program, '_webcl_texture');
			gl.viewport(0, 0, sizeO, sizeO);
			fbo = fbo || gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			let colAt = [];
			for(let i=0;i<op.length;i++){
				op[i].alloc();
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0+i, gl.TEXTURE_2D, op[i].texture, 0);
				colAt.push(gl.COLOR_ATTACHMENT0+i);
			}
			let frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			if (frameBufferStatus !== gl.FRAMEBUFFER_COMPLETE){
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
			for(let i=0;i<inp.length;i++){
				gl.activeTexture(gl.TEXTURE0+i);
				gl.bindTexture(gl.TEXTURE_2D, inp[i].texture);
				gl.uniform1i(v_texture[i], i);
			}
			
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
			if(transferOutput){
				if(transferIndices === null){
					for(let i=0;i<op.length;i++){
						gl.readBuffer(gl.COLOR_ATTACHMENT0+i);
						gl.readPixels(0, 0, op[i].params.texSize, op[i].params.texSize, op[i].params.format, op[i].params.type, op[i].data);
					}
				}else{
					for(let i=0;i<transferIndices.length;i++){
						gl.readBuffer(gl.COLOR_ATTACHMENT0+transferIndices[i]);
						gl.readPixels(0, 0, op[transferIndices[i]].params.texSize, op[transferIndices[i]].params.texSize, op[transferIndices[i]].params.format, op[transferIndices[i]].params.type, op[transferIndices[i]].data);
					}
				}
			}
			if(previewIndex !== null && previewIndex < op.length){
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

		this.free = function() {
            gl.deleteProgram(program);
            gl.deleteShader(fragmentShader);
			gl.deleteFramebuffer(fbo);
        }
	}

	this.Buffer = function(shape, arr=null){
		return new Buffer(shape, arr);
	}

	this.Program = function(inp, op, code, libCode='', pixelCode='',){
		return new Program(inp, op, code, libCode, pixelCode);
	}

}