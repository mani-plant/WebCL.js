# WebCL.js
An easy to use, light weight Javascript library for doing general purpose computations on GPU.

## Hello World!
A program to square all numbers in input array in parallel.

###### Initialization
```
var myGPU = new GPU();
```
###### Allocate Memory in GPU
```
var gpuMem_Inp = myGPU.Buffer(64); //an array of length 64 on gpu
var gpuMem_Out = myGPU.Buffer(64); //more details on Buffer in docs

for (var i = 0; i < 64; i += 1) {
  gpuMem_Inp.data[i] = i; //setup data on CPU
}

gpuMem_Inp.alloc(); //send data to GPU
```
###### Create a GPU Program
```
var squareProg = myGPU.Program([gpuMem_Inp], [gpuMem_Out],
    `void main(void) {

    float inp = readI(0, getIndex()); //read input
    
    out0 = inp*inp; //set output
  }`
);
```
###### Execute the Program on GPU
```
squareProg.exec();
```
###### Transfer output back to CPU
```
squareProg.transfer();
console.log(gpuMem_Out);
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
var buffer1 = myGPU.Buffer(size, [channels, data])
// size = number of elements in buffer
// channels = number of channels per element (1,2,3 or 4), default 1
// data = Float32Array of length size*channels, default null(initialize array of size*channels with zeros)

for (var i = 0; i < buffer1.data.length; i += 1) {
	  buffer1.data[i] = i;
}
//optionally fill buffer with data

buffer1.alloc();
//send buffer1.data to GPU

buffer1.delete();
//free GPU memory occupied during alloc
```

## Program
Programs are basically fragment shader code in Open GL ES 3. These run on GPU in parallel for each output element.
```
//myGPU.Program([input Buffers],[in-out Buffers],`shader program string`);
```
Shader program is executed once for each output.
#### Shader Program
The following functions are available in shader program to access input and in-out buffers.
###### 1. Get current element: 
```getIndex()```
getIndex() is used to get current output buffer index.
###### 2. Read Input:
```
readI(int bufferno, float index)
//read returns inputBuffer[index] (float if channels=1, vec2 if channels=2 etc)
```
###### 3. Set Output:
```out0 = x;
out1 = y;
```
+-----------------------------+
|Channel  | output_data_type  |
+---------+-------------------+
|  1      | float             |
|  2      | vec2              |
|  3      | vec3              |
|  4      | vec4              |
+---------+-------------------+

#### Execute Program
```
myProg.exec()
```

#### Transfer Output Buffers Back to CPU
```
myProg.transfer()
```

#### Example Matrix Multiplication and Addition of two 4x4 matrices
In this example we will make a program that takes two input buffers of 4x4 and sets two output buffers of size 4x4, first output will be matrix product of the inputs and second output will be matrix sum of the inputs.
```
//to be continued...
```
