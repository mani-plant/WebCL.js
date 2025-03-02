import * as clUtils from './webgl/utils.js';
import * as clTypes from './webgl/types.js';
import * as clBuffer from './webgl/buffer.js';
import * as clProgram from './webgl/program.js';

function GPU(canvas = null) {
	const gpu = this;
	const gl = clUtils.glInit(canvas || document.createElement('canvas'));
	const typesInfo = Object.freeze(clTypes.getTypesInfo(gl));
	function newBuffer(data, f, e) {
		const buf = gl.createBuffer();
		gl.bindBuffer((e || gl.ARRAY_BUFFER), buf);
		gl.bufferData((e || gl.ARRAY_BUFFER), new (f || Float32Array)(data), gl.STATIC_DRAW);
		return buf;
	}
	const positionBuffer = newBuffer([-1, -1, 1, -1, 1, 1, -1, 1]);
	const textureBuffer = newBuffer([0, 0, 1, 0, 1, 1, 0, 1]);
	const indexBuffer = newBuffer([1, 2, 0, 3, 0, 2], Uint16Array, gl.ELEMENT_ARRAY_BUFFER);

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

	this.Program = function (inpParams, opParams, code, { libCode = '', pixelCode = '', fullFragmentCode = null }) {
		return new clProgram.Program(gpu, inpParams, opParams, code, { libCode, pixelCode, fullFragmentCode });
	}
}

// Attach viewPortSources to GPU
// GPU.viewPortSources = viewPortSources;

// Make GPU available in the global scope for browser console access
// if (typeof window !== 'undefined') {
// 	window.GPU = GPU;
// }

export { GPU };
