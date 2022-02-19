#version 300 es
precision highp float;
float sizeO = 3.;
uniform sampler2D u_texture[2];
float size[2] = float[](3.,3.);

float getTex0(vec2 coord) {
    return texture(u_texture[0], coord);
}

float getTex1(vec2 coord) {
    return texture(u_texture[1], coord);
}

in vec2 pos;

layout(location = 0) out vec4 out0;

		
vec2 getPos(int i, vec2 ind){
    return (ind + 0.5)/size[i];
}

vec2 getInd(int i, float index){
    float y = float(int(index)/int(size[i]));
    float x = index - size[i]*y;
    return vec2(x,y);
}

float readI0(float index){
    return getTex0(getPos(0, getInd(0, index)));
}
float readI1(float index){
    return getTex1(getPos(1, getInd(1, index)));
}

vec2 indXY = pos*sizeO - 0.5;
float curIndex = (indXY.y*sizeO + indXY.x)*4.;



#define getIndex() __webcl_curIndex + __webcl_i


// #define readI(n, i) readI ## b ## (a)


// expose functions getIndex(), -> returns index of output thread (position in buffer where output will be written to) 
// and readInput(buffer_index, index)

void commit(float op[1]){
    out0 = op[0];

}

void main(void) {
    vec2 
    for(int __i=0; __i<4; __i++){

    }
    float inp = readI0(getIndex());
    float inp2 = readI1(getIndex());

    out0 = inp+inp2;
}