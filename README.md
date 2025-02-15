# WebCL.js
An easy to use, light weight Javascript library for doing general purpose computations on GPU.

## Hello World!
A program to pariwise sum elements of two matrices in parallel.

###### Initialization
```
var myGPU = new GPU();
```
###### Allocate Memory in GPU
```
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
let matBuf1 = new myGPU.Buffer([4,2,3], mat1); // GPU memory of shape [4,2,3] with mat1 as data (data is still on CPU) 
let matBuf2 = new myGPU.Buffer([4,2,3], mat2);
let matSum = new myGPU.Buffer([4,2,3]); // for output

matBuf1.alloc(); //allocate memory on GPU - transfers data from CPU to GPU
matBuf2.alloc(); 

```
###### Create a GPU Program
```
let matProg = new myGPU.Program([matBuf1.shape, matBuf2.shape], [matSum.shape], 
`
float op = _webcl_readIn0(_webcl_index[0], _webcl_index[1], _webcl_index[2]) + _webcl_readIn1(_webcl_index[0], _webcl_index[1], _webcl_index[2]);
_webcl_commitOut0(op);
`
);
```
###### Execute the Program on GPU
```
matProg.exec([matBuf1, matBuf2], [matSum]);
```
###### Transfer output back to CPU
```
matSum.read();
console.log(matSum.getShapedData());
```
###### Clean up
```
matSum.free();
matBuf1.free();
matBuf2.free();
matProg.free();
myGPU.free();
```
## GPU
Create a GPU instance to access GPU.
```
var myGPU = new GPU();
```
Every GPU instance is independent of other GPU instances.
A GPU instance can be used to create Buffers which corrosponds to Memory on GPU and Programs which run in parallel on GPU

## Buffer
Buffers are memory on GPU, initialize a buffer by putting values in Buffer.data Float32Array, and use Buffer.alloc and Buffer.delete to allocate memory on GPU for Buffer.data and delete it respectively.
```
var buffer1 = myGPU.Buffer(shape, shaped_js_array) // shaped_js_array is optional, can be passed as buffer1.set(shaped_js_array) later too

buffer1.alloc();
//send buffer1.data to GPU

buffer1.free();
//free GPU memory occupied during alloc
```

## Program
Programs are fragment shader code in Open GL ES 3. These run on GPU in parallel for each output element.
```
//myGPU.Program([input buffers shapes],[ouput buffers shapes],`shader program string`);
```
Shader program is executed once for each output.
#### Shader Program
The following functions are available in shader program to access input and in-out buffers.
###### 1. Get current index: 
```_webcl_index[dim]```
```i0 = _webcl_index[0]; // etc```
_webcl_index[n] is used to get n-th dimension of current output buffer index at which the shader program is executed.
###### 2. Read Input:
```
_webcl_readIn0(float index)
// read returns inputBuffers[0][index]
// general form: _webcl_readIn<N>(float index) reads inputBuffers[N][index]
```
###### 3. Set Output:
```_webcl_commitOut0(val); // set outputBuffers[0] = val;
_webcl_commitOut1(val); // set outputBuffers[1] = val;
// general form: _webcl_commitOut<N>(val); // set outputBuffers[N] = val;
```
#### Execute Program
```
myProg.exec([inputBuffers], [outputBuffers]);

function([inputBuffers], [outputBuffers], transferOutput = false, transferIndices = null, previewIndex = 0)
// transferOutput: if true, outputBuffers will be transferred back to CPU after execution
// transferIndices: if not null, only the elements of outputBuffers at the indices in transferIndices will be transferred back to CPU
// previewIndex: if not null, the outputBuffer at previewIndex will be rendered on the canvas
```

#### Transfer Output Buffers Back to CPU
```
outBuffer.read()
```
## Open GL ES 3 Functions
The following variables, functions and macros are available in shader code for reading inputs, output and setting output.
```
float _webcl_index[D] // current index of output buffer at dimension D
_webcl_readIn<N>(x1,x2,...,xk) // read input from input buffer N of dimension k
_webcl_commitOut<N>(val) // set output buffer N's current index to val

```
Notes:
1. You can read any index of the input buffers but only current index of the output buffers.
2. Any buffer can be used with any program any number of times without the need to transfer buffer data back to cpu

###### TODOs
```
- support for typed buffers and custom percision
	- float highp (current)
	- int highp
	- unsigned
	- lower percision support
- Transpile JS TO Shaders

```
