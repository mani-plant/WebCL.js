import {GPU} from './WebCL.js';
var canvas = document.getElementById('canvas');
var myGPU = new GPU(canvas);

let mat1 = [
	[[1,1,1],[1,1,1]],
	[[2,2,2],[2,2,2]],
	[[3,3,3],[3,3,3]],
	[[4,4,4],[4,4,4]]
].map(x=>x.map(y=>y.map(z=>z/10)));
let mat2 = [
	[[1,0,0],[0,0,0]],
	[[0,1,0],[0,0,0]],
	[[0,0,1],[0,0,0]],
	[[0,0,0],[1,0,0]],
].map(x=>x.map(y=>y.map(z=>z/10)));
let matBuf1 = new myGPU.Buffer([4,2,3], mat1);
let matBuf2 = new myGPU.Buffer([4,2,3], mat2);
let matSum = new myGPU.Buffer([4,2,3]);
matBuf1.alloc();
matBuf2.alloc();
// matSq.alloc();
let matProg = new myGPU.Program([matBuf1.shape, matBuf2.shape], [matSum.shape], 
`
float op = _webcl_readIn0(_webcl_index[0], _webcl_index[1], _webcl_index[2]) + _webcl_readIn1(_webcl_index[0], _webcl_index[1], _webcl_index[2]);
_webcl_commitOut0(op);
`
);
matProg.exec([matBuf1, matBuf2], [matSum]);

console.log(matBuf1, matBuf2, matSum);
matSum.read();
console.log(matSum.data);
console.log(matSum.getShapedData());
matSum.free();
matBuf1.free();
matBuf2.free();
matProg.free();
myGPU.free();