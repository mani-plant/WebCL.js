# WebCL.js
An easy to use, light weight Javascript library for doing general purpose computations on GPU.

A simple 16 line program to square all numbers in input array in parallel via GPU.


Example
-------
var myGPU = new GPU();
var gpuMem_Inp = myGPU.Buffer(64); //an array of length 64 on gpu
var gpuMem_Out = myGPU.Buffer(64); //more details on Buffer below
for (var i = 0; i < 64; i += 1) {
  gpuMem_Inp.data[i] = i; //setup data on CPU
}
gpuMem_Inp.alloc(); //send data to GPU
var squareProg = myGPU.Program([gpuMem_Inp], [gpuMem_Out],
 `void main(void) {
    float inp = readI(0, getIndex()); //read input  
    out0 = inp*inp; //set output
  }`
);
squareProg.exec();
squareProg.transfer();
console.log(gpuMem_Out);

Initialization
--------------
var myGPU = new GPU();

Allocate Memory in GPU
----------------------
var gpuMem_Inp = myGPU.Buffer(64); //an array of length 64 on gpu
var gpuMem_Out = myGPU.Buffer(64); //more details on Buffer in docs

for (var i = 0; i < 64; i += 1) {
  gpuMem_Inp.data[i] = i; //setup data on CPU
}

gpuMem_Inp.alloc(); //send data to GPU

Create a GPU Program
--------------------
var squareProg = myGPU.Program([gpuMem_Inp], [gpuMem_Out],
    `void main(void) {

    float inp = readI(0, getIndex()); //read input
    
    out0 = inp*inp; //set output
  }`
);

Execute the Program on GPU
--------------------------
squareProg.exec();

Transfer output back to CPU
---------------------------
squareProg.transfer();
console.log(gpuMem_Out);

