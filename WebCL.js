import * as clUtils from './lib/utils.js';
import * as clTypes from './lib/types.js';
import * as clBuffer from './lib/lattice.js';
import * as clProgram from './lib/circuit.js';

function glCreateBuffer(gl, data, { bufferType = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW, arrayType = Float32Array }){
	const buf = gl.createBuffer();
	gl.bindBuffer(bufferType, buf);
	gl.bufferData(bufferType, new arrayType(data), usage);
		return buf;
	}

function glCreateVertexShader(gl, vertexShaderCode){
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderCode);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		throw new Error(
			"\nError: Vertex shader build failed\n" + "\n" +
			"--- CODE DUMP ---\n" + vertexShaderCode + "\n\n" +
			"--- ERROR LOG ---\n" + gl.getShaderInfoLog(vertexShader)
		);
	}
	return vertexShader;
}
function GPU(canvas = null) {
	const gpu = this;
	const gl = clUtils.glInit(canvas || document.createElement('canvas'));
	const typesInfo = Object.freeze(clTypes.getTypesInfo(gl));
	
	const positionBuffer = glCreateBuffer(gl, [-1, -1, 1, -1, 1, 1, -1, 1], {arrayType: Float32Array}); // position buffer - position of the vertices
	const textureBuffer = glCreateBuffer(gl, [0, 0, 1, 0, 1, 1, 0, 1], {arrayType: Float32Array}); // texture buffer - texture coordinates
	const indexBuffer = glCreateBuffer(gl, [1, 2, 0, 3, 0, 2], {arrayType: Uint16Array, bufferType: gl.ELEMENT_ARRAY_BUFFER}); // for draw call

	const vertexShaderCode = `#version 300 es
		precision highp float;
		in vec2 _webcl_position;
		out vec2 _webcl_pos;
		in vec2 _webcl_texture;
		void main(void) {
			_webcl_pos = _webcl_texture;
			gl_Position = vec4(_webcl_position.xy, 0.0, 1.0);
		}
	`;
	const vertexShader = glCreateVertexShader(gl, vertexShaderCode);

	this.free = function () {
		gl.deleteShader(vertexShader);
		gl.deleteBuffer(positionBuffer);
		gl.deleteBuffer(textureBuffer);
		gl.deleteBuffer(indexBuffer);
	}

	this.glBuffers = {
		positionBuffer,
		textureBuffer,
		indexBuffer,
	}

	this.gl = gl;

	this.typesInfo = typesInfo;

	this.vertexShader = vertexShader;

	this.LatticeParams = function (shape, { arr = null, internalFormat = gl.RG8UI, type = null }) {
		return new clBuffer.LatticeParams(this, shape, { arr, internalFormat, type });
	}

	this.Lattice = function (shape, { arr = null, internalFormat = gl.RG8UI, type = null }) {
		return new clBuffer.Lattice(gpu, shape, { arr, internalFormat, type });
	}

	this.Circuit = function (inpParams, opParams, code, { libCode = '', pixelCode = '', fullFragmentCode = null }) {
		return new clProgram.Circuit(gpu, inpParams, opParams, code, { libCode, pixelCode, fullFragmentCode });
	}
}

// Attach viewPortSources to GPU
// GPU.viewPortSources = viewPortSources;

// Make GPU available in the global scope for browser console access
// if (typeof window !== 'undefined') {
// 	window.GPU = GPU;
// }

export { GPU };
