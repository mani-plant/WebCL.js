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
```
+-----------------------------+
|Channel  | output_data_type  |
+---------+-------------------+
|  1      | float             |
|  2      | vec2              |
|  3      | vec3              |
|  4      | vec4              |
+---------+-------------------+
```
#### Execute Program
```
myProg.exec()
```

#### Transfer Output Buffers Back to CPU
```
myProg.transfer()
```
## Open GL ES 3 Functions
The following functions are available in shader code for reading inputs, output and setting output.
```
float getIndex() //This thread will write to output_buffer[index]
float readI(int i, float index)	//Read i-th input_buffer[index]
// Use these functions for more than 1 channel(max 4-r,g,b,a aka x,y,z,w) input buffers
float readI(int i, float index)
float readIR(int i, float index)
float readIG(int i, float index)
float readIB(int i, float index)
float readIA(int i, float index)
vec2 readIRG(int i, float index)
vec3 readIRGB(int i, float index)
vec4 readIRGBA(int i, float index)

//to set output use
out<i> = some float value
//where i = 0,1,2 ... number of output buffers
```
Notes:
1. You can read any index of the input buffers but only current index of the output buffers.
2. Any buffer can be used with any program any number of times without the need to transfer buffer data back to cpu

## Working with Multiple Buffers: Example Matrix Multiplication and Addition of two 4x4 matrices
In this example we will make a program that takes two input buffers of 4x4 and sets two output buffers of size 4x4, first output will be matrix product of the inputs and second output will be matrix sum of the inputs.
```
var myGPU = new GPU();
var sampleSize =16;
var chnl = 1;
var outputBuffer1 = myGPU.Buffer(sampleSize,chnl);
var outputBuffer2 = myGPU.Buffer(sampleSize,chnl);
var inputBuffer1 = myGPU.Buffer(sampleSize,chnl);
var inputBuffer2 = myGPU.Buffer(sampleSize,chnl);

for (var i = 0; i < sampleSize*chnl; i += 1) {
	inputBuffer1.data[i] = i;
	inputBuffer2.data[i] = i;
}
inputBuffer1.alloc();
inputBuffer2.alloc();

var matMulSumProgram = myGPU.Program([inputBuffer1, inputBuffer2], [outputBuffer1, outputBuffer2],

`vec2 get2dIndex(float index, float size){
	float y = float(int(index)/int(size));
	float x = index - size*y;
	return vec2(x,y);
}

float get1dIndex(vec2 ind, float size){
	return (ind.y*size + ind.x);
}

void main(void) {
	float sop = 0.0;
	vec2 out_index = get2dIndex(getIndex(), 4.);
	for(int i=0;i<int(out_index.x);i++){
		sop += readI(0,get1dIndex(vec2(float(i),out_index.y), 4.)) * readI(1,get1dIndex(vec2(out_index.x, float(i)), 4.));
	}
	for(int i=int(out_index.x);i<4;i++){
		sop += readI(0,get1dIndex(vec2(float(i),out_index.y), 4.)) * readI(1,get1dIndex(vec2(out_index.x, float(i)), 4.));
	}
	float inp = readI(0, getIndex());
	float inp2 = readI(1, getIndex());
	out1 = sop;
	out0 = inp+inp2;
}`
);

matMulSumProgram.exec();
matMulSumProgram.transfer();
console.log(outputBuffer1);
console.log(outputBuffer2);
```
