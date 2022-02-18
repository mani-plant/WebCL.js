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
	return gl;
}

export function GPU(){
	let gl = initGL(document.createElement('canvas'));

	function getFrameBufferStatusMsg(frameBufferStatus){
		if(frameBufferStatus == gl.FRAMEBUFFER_COMPLETE) return 'The framebuffer is ready to display.';
		if(frameBufferStatus == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) return 'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.';
		// gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: There is no attachment.
		// gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS: Height and width of the attachment are not the same.
		// gl.FRAMEBUFFER_UNSUPPORTED: The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.
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
	"in vec2 position;\n" +
	"out vec2 pos;\n" +
	"in vec2 texture;\n" +
	"\n" +
	"void main(void) {\n" +
	"  pos = texture;\n" +
	"  gl_Position = vec4(position.xy, 0.0, 1.0);\n" +
	"}";
	let vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
		throw new Error(
			"\nError: Vertex shader build failed\n" + "\n" +
			"--- CODE DUMP ---\n" + vertexShaderCode + "\n\n" +
			"--- ERROR LOG ---\n" + gl.getShaderInfoLog(vertexShader)
		);
	function createTexture(data, size) {
		let texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, size, size, 0, gl.RED, gl.FLOAT, data);
		gl.bindTexture(gl.TEXTURE_2D, null);
		return texture;
	}
	function Buffer(size, arr=null){
		let texSize = Math.ceil(Math.sqrt(size/4));
		let bufferLength = texSize*texSize*4;
		
		// this.mem = Math.pow(4, Math.ceil(Math.log(this.length) / Math.log(4)));
		
		if (texSize > maxTextureSize){
			throw new Error("ERROR: Texture size not supported!");
		}
		
		let data = new Float32Array(bufferLength);
		if(arr){
			this.set(arr);
		}
		let texture = null;
		this.set = function(arr){
			data = arr;
		}
		this.alloc = function(){
			if(texture == null){
				texture = createTexture(data, texSize);
			}
			return texture;
		}
		this.delete = function(){
			if(texture != null){
				gl.deleteTexture(texture);
			}
			texture = null;
		}
		this.get = function(){
			return data;
		}
	}
	function Program(inp, op, code){
		this.inp = inp;
		this.op = op;
		if(inp.length +op.length > maxTextureUnits + maxColorUnits){
			return false;
		}
		this.sizeI = [];	
		var texcode = 'uniform sampler2D u_texture['+this.inp.length+'];\n';
		for(let i=0;i<this.inp.length; i++){
			this.sizeI.push(this.inp[i].mem);
		}
		texcode += 'float size['+this.inp.length+'] = float[]('+this.sizeI.join('.,')+'.);\n';
		let inpcode = '';
		for(let i=0;i<this.inp.length; i++){
			texcode += `float getTex${i}(vec2 coord) {
				return texture(u_texture[${i}], coord).r;
			}\n`;
			inpcode += `float readI${i}(float index){
				return getTex${i}(getPos(${i}, getInd(${i}, index)));
			}\n`
		}
		this.sizeO = this.op[0].mem;
		var opcode = '';
		var comcode = '';
		for(let i=0;i<this.op.length;i++){
			opcode += 'layout(location = '+i+') out float out'+i+';\n';
			comcode += 'out'+i+' = op['+i+'];\n';
		}
		var stdlib = `#version 300 es
		precision highp float;
		float sizeO = ${this.sizeO}.;
		${texcode}
		in vec2 pos;
		${opcode}
		
		vec2 getPos(int i, vec2 ind){
   			return (ind + 0.5)/size[i];
   		}

		vec2 getInd(int i, float index){
   			float y = float(int(index)/int(size[i]));
   			float x = index - size[i]*y;
   			return vec2(x,y);
   		}

   		${inpcode}
		
		vec2 indXY(){
   			return pos*sizeO - 0.5 ;
   		}

   		float getIndex(){
   			vec2 ind = indXY();
   			return (ind.y*sizeO + ind.x);
   		}

   		void commit(float op[${this.op.length}]){
   			${comcode}
   		}
		`;
		var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

		gl.shaderSource(
			fragmentShader,
			stdlib + code
		);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			var LOC = (stdlib + code).split('\n');
			var dbgMsg = "ERROR: Could not build shader (fatal).\n\n------------------ KERNEL CODE DUMP ------------------\n"
			for (var nl = 0; nl < LOC.length; nl++)
				dbgMsg += (1 + nl) + "> " + LOC[nl] + "\n";
			dbgMsg += "\n--------------------- ERROR  LOG ---------------------\n" + gl.getShaderInfoLog(fragmentShader)
			throw new Error(dbgMsg);
		}
		this.program = gl.createProgram();
		gl.attachShader(this.program, vertexShader);
		gl.attachShader(this.program, fragmentShader);
		this.exec = function(){
			gl.linkProgram(this.program);
			if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
				throw new Error('ERROR: Can not link GLSL program!');
			var v_texture = [];
			for(let i=0;i<this.inp.length;i++){
				v_texture.push(gl.getUniformLocation(this.program, 'u_texture['+i+']'));
			}
			var aPosition = gl.getAttribLocation(this.program, 'position');
			var aTexture = gl.getAttribLocation(this.program, 'texture');
			gl.viewport(0, 0, this.sizeO, this.sizeO);
			var fbo = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			var colAt = [];
			for(let i=0;i<this.op.length;i++){
				this.op[i].alloc();
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0+i, gl.TEXTURE_2D, this.op[i].texture, 0);
				colAt.push(gl.COLOR_ATTACHMENT0+i);
			}
			var frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
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


			gl.useProgram(this.program);
			for(let i=0;i<this.inp.length;i++){
				gl.activeTexture(gl.TEXTURE0+i);
				gl.bindTexture(gl.TEXTURE_2D, this.inp[i].texture);
				gl.uniform1i(v_texture[i], i);
			}
			
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
		}
		this.transfer = function(i = null){
			if(i === null){
				for(let i=0;i<this.op.length;i++){
					gl.readBuffer(gl.COLOR_ATTACHMENT0+i);
					// assuming a framebuffer is bound with the texture to read attached
					// const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
					// const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
					// console.log(gl, format, type);
					gl.readPixels(0, 0, this.sizeO, this.sizeO, gl.RED, gl.FLOAT, this.op[i].data);
				}
			}else{
				gl.readBuffer(gl.COLOR_ATTACHMENT0+i);
				gl.readPixels(0, 0, this.sizeO, this.sizeO, gl.RED, gl.FLOAT, this.op[i].data);
			}
		}
	}

	this.Buffer = function(size, data){
		return new Buffer(size, data);
	}

	this.Program = function(inp, op, code){
		return new Program(inp, op, code);
	}

}