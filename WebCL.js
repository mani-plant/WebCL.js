import * as clUtils from './lib/utils.js';
import * as clTypes from './lib/types.js';
import * as clBuffer from './lib/lattice.js';
import * as clProgram from './lib/circuit.js';


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
	

	this.free = function () {
	}

	this.gl = gl;

	this.typesInfo = typesInfo;

	// this.uboBindPointsManager = new UboBindPointsManager(gpu);


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
