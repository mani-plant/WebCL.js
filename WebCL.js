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


// function UboBindPointsManager(gpu) {
// 	const gl = gpu.gl;
//     // Keeps track of which binding points are already assigned
//     const boundPoints = new Map();
//     const boundBuffers = new Map();
//     // Maximum number of UBO binding points available on this GPU.
//     const maxUboBindings = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
//     const availableBindPoints = new Set(new Array(maxUboBindings).fill(0).map((x,i) => i));
    
//     // Returns the maximum number of binding points available.
//     this.getMaxBindPoints = function() {
//         return maxUboBindings;
//     }

//     this.getBoundPointsCount = function(){
//         return boundPoints.size();
//     }
    
//     this.getFreeBindingPointsCount = function(){
//         return availableBindPoints.size();
//     }

//     function freeBindPoint(bindPoint){
//         let buf;
//         if(buf = boundPoints.get(bindPoint)){
// 			const bufPoints = boundBuffers.get(buf);
// 			bufPoints.delete(bindPoint);
// 			bufPoints.size === 0 && boundBuffers.delete(buf);
//             boundPoints.delete(bindPoint);
//             availableBindPoints.add(bindPoint);
//             return bindPoint;
//         }
//         return undefined;
//     }

//     function lockBindPoint(bindPoint, buf){
//         if(availableBindPoints.has(bindPoint)){
//             availableBindPoints.delete(bindPoint);
//             boundPoints.set(bindPoint, buf);
// 			const bufPoints = boundBuffers.get(buf);
// 			(bufPoints === undefined && boundBuffers.set(buf, new Set([bindPoint]))) || (bufPoints.add(bindPoint))
//             return bindPoint;
//         }
//         return undefined;
//     }

//     function popBindPoint(ubo, bindPoint = undefined, force = true){
//         if(bindPoint === undefined){
//             bindPoint = availableBindPoints.values().next().value;
//         }else if(!availableBindPoints.has(bindPoint)){
// 			if(force){
// 				freeBindPoint(bindPoint);
// 			}else{
// 				return;
// 			}
// 		}
// 		if(bindPoint !== undefined){
// 			return lockBindPoint(bindPoint, ubo);
// 		}
// 		return bindPoint;
//     }
    
//     this.setBindPoint = function(ubo, bindPoint = undefined, force = true) {
//         bindPoint = popBindPoint(ubo, bindPoint, force);
//         bindPoint && gl.bindBufferBase(gl.UNIFORM_BUFFER, bindPoint, ubo);
//         return bindPoint;
//     };

//     this.unsetBindPoint = function(bindPoint){
//         bindPoint = freeBindPoint(bindPoint);
//         bindPoint !== undefined && gl.bindBufferBase(gl.UNIFORM_BUFFER, bindPoint, null);
//         return bindPoint;
//     }
// }

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

	// this.uboBindPointsManager = new UboBindPointsManager(gpu);

	this.vertexShader = vertexShader;

	this.LatticeParams = function (shape, { arr = null, internalFormat = gl.RG8UI, type = null }) {
		return new clBuffer.LatticeParams(this, shape, { arr, internalFormat, type });
	}

	this.Lattice = function (shape, { arr = null, internalFormat = gl.RG8UI, type = null }) {
		return new clBuffer.Lattice(gpu, shape, { arr, internalFormat, type });
	}

	this.LatticeParamsGroup = function(params){
		return new clBuffer.LatticeParamsGroup(gpu, params);
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
