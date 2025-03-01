import {GPU} from './WebCL.js';
var canvas = document.getElementById('canvas');
var myGPU = new GPU(canvas);
const grid_size = 64;
// let initial_state = new Array(grid_size).fill(0).map(
//     () => new Array(grid_size).fill(0).map(
//         () => [Math.random() > 0.5 ? 1 : 0, Math.random() > 0.25 ? 1 : 0, Math.random() > 0.75 ? 1 : 0, 1]
//     )
// );
let buf1 = new myGPU.Buffer([grid_size, grid_size, 2]);
let buf2 = new myGPU.Buffer([grid_size, grid_size, 2]);
buf1.alloc();
buf2.alloc();
let seed = Math.random()*10000;
let init_prog = new myGPU.Program([], [buf1.params],
    `
    #ifdef _webcl_available_out0
    float ix = _webcl_index0[0];
    float iy = _webcl_index0[1];
    float iz = _webcl_index0[2];
    float seed = fract(gen_seed(gen_seed(ix*iy*(iz+1.))));
    float op = step(0.9, seed);
    _webcl_commitOut0(op);
    #endif
    `,`
    #define gen_seed(val) (sin(val) * ${seed})
    `
);
init_prog.exec([], [buf1]);
let matProg = new myGPU.Program([buf1.params], [buf2.params], 
    `
    // _webcl_commitOut0(1.);
    #ifdef _webcl_available_out0
    float ix = _webcl_index0[0];
    float iy = _webcl_index0[1];
    float iz = _webcl_index0[2];
    float is_ca = step(iz, 2.5);
    float is_not_ca = step(2.5, iz);
    float alive_count = _webcl_readIn0(mod(ix+1., ${grid_size}.),iy, iz) + 
                        _webcl_readIn0(mod(ix-1., ${grid_size}.),iy, iz) + 
                        _webcl_readIn0(ix,mod(iy+1., ${grid_size}.), iz) + 
                        _webcl_readIn0(ix,mod(iy-1., ${grid_size}.), iz) + 
                        _webcl_readIn0(mod(ix+1., ${grid_size}.),mod(iy+1., ${grid_size}.), iz) + 
                        _webcl_readIn0(mod(ix+1., ${grid_size}.),mod(iy-1., ${grid_size}.), iz) + 
                        _webcl_readIn0(mod(ix-1., ${grid_size}.),mod(iy+1., ${grid_size}.), iz) + 
                        _webcl_readIn0(mod(ix-1., ${grid_size}.),mod(iy-1., ${grid_size}.), iz);
    float neighbour_state = step(1.5, alive_count) * step(alive_count, 3.5);
    float me_alive = step(0.5, _webcl_readIn0(ix, iy, iz));
    float me_dead = step(me_alive, 0.5);
    float birth_state = step(2.5, alive_count) * step(alive_count, 3.5);
    float op = (me_alive * neighbour_state) + (me_dead * birth_state);
    _webcl_commitOut0((op*is_ca) + (is_not_ca));
    #endif
    `
);
let frameCount = 0;
let in_buf  = buf1;
let out_buf = buf2;
let prevtimestamp = 0;
let frameGap = 10;
function frame(timestamp){
    matProg.exec([in_buf], [out_buf]);
    frameCount++;
    if(frameCount > 100000){
        console.log('done');
        out_buf.read();
        in_buf.read();
        console.log(out_buf.getShapedData());
        console.log(in_buf.getShapedData());
        console.log(in_buf, out_buf);
        return;
    }
    let temp = in_buf;
    in_buf  = out_buf;
    out_buf = temp;
    let delta = timestamp - prevtimestamp;
    prevtimestamp = timestamp;
    if(delta >= frameGap){
        requestAnimationFrame(frame);
    }else{
        prevtimestamp += frameGap-delta;
        setTimeout(() => requestAnimationFrame(frame), frameGap-delta);
    }
    prevtimestamp = timestamp;
    // requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


// console.log(matBuf1, matBuf2, matSq);
// matSq.read();
// console.log(matSq.data);