import {GPU} from './WebCL.js';
var canvas = document.getElementById('canvas');
var myGPU = new GPU(canvas);
const grid_size = 256;
// let initial_state = new Array(grid_size).fill(0).map(
//     () => new Array(grid_size).fill(0).map(
//         () => [Math.random() > 0.5 ? 1 : 0, Math.random() > 0.25 ? 1 : 0, Math.random() > 0.75 ? 1 : 0, 1]
//     )
// );
let buf1 = new myGPU.Lattice([grid_size, grid_size, 4]);
let buf2 = new myGPU.Lattice([grid_size, grid_size, 4]);
let buf3 = new myGPU.Lattice([grid_size, grid_size, 4]);
buf1.alloc();
buf2.alloc();
let seed = Math.random()*10000;
let init_prog = new myGPU.Circuit([], [buf1.shape],
    `
    float ix = _webcl_index[0];
    float iy = _webcl_index[1];
    float iz = _webcl_index[2];
    float seed = fract(gen_seed(gen_seed(ix*iy*(iz+1.))));
    float op = step(0.5, seed)*step(iz, 1.5)*step(.5, iz);
    _webcl_commitOut0(op);
    `,`
    #define gen_seed(val) (sin(val) * ${seed})
    `
);
init_prog.exec([], [buf1]);
let matProg = new myGPU.Circuit([buf1.shape, buf2.shape], [buf3.shape], 
    `
    float ix = _webcl_index[0];
    float iy = _webcl_index[1];
    float iz = _webcl_index[2];
    float is_ca = step(iz, 2.5);
    float is_not_ca = step(2.5, is_ca);
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
    float me_prev_alive = step(0.5, _webcl_readIn1(ix, iy, iz))*0.16666;
    neighbour_state = step(neighbour_state, 0.5)*me_prev_alive + step(0.5, neighbour_state);
    float me_dead = step(me_alive, 0.5);
    float birth_state = step(2.5, alive_count) * step(alive_count, 3.5);
    float op = (me_alive * neighbour_state) + (me_dead * birth_state);
    _webcl_commitOut0((op*is_ca) + (is_not_ca));
    `
);
let frameCount = 0;
let bufs = [buf1, buf2, buf3];
/*
[buf1, buf2, buf3]
[buf3, buf1, buf2]
[buf2, buf3, buf1]
[buf1, buf2, buf3]
[buf3, buf1, buf2]
[buf2, buf3, buf1]
*/
let offset = 0;
let prevtimestamp = 0;
let frameGap = 10;
function frame(timestamp){
    console.log(frameCount, timestamp, prevtimestamp);
    let in0 = bufs[offset];
    let in1 = bufs[(offset+1)%3];
    let o0 = bufs[(offset+2)%3];
    matProg.exec([in0, in1], [o0]);
    frameCount++;
    if(frameCount > 10000){
        console.log('done');
        return;
    }
    offset = (offset+2)%3;
    let delta = timestamp - prevtimestamp;
    prevtimestamp = timestamp;
    if(delta >= frameGap){
        requestAnimationFrame(frame);
    }else{
        prevtimestamp += frameGap-delta;
        setTimeout(() => requestAnimationFrame(frame), frameGap-delta);
    }
}
requestAnimationFrame(frame);


// console.log(matBuf1, matBuf2, matSq);
// matSq.read();
// console.log(matSq.data);