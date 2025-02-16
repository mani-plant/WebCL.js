import {GPU} from './WebCL.js';
var canvas = document.getElementById('canvas');
var myGPU = new GPU(canvas);
const grid_size = 64;
// let initial_state = new Array(grid_size).fill(0).map(
//     () => new Array(grid_size).fill(0).map(
//         () => [Math.random() > 0.5 ? 1 : 0, Math.random() > 0.25 ? 1 : 0, Math.random() > 0.75 ? 1 : 0, 1]
//     )
// );
let buf1 = new myGPU.Buffer([grid_size, grid_size, 4]);
let buf2 = new myGPU.Buffer([grid_size, grid_size, 4]);
buf1.alloc();
buf2.alloc();
let init_prog = new myGPU.Program([], [buf1.shape],
    `
    float ix = _webcl_index[0];
    float iy = _webcl_index[1];
    float iz = _webcl_index[2];
    float seed = fract(gen_seed(gen_seed(ix*iy*(iz+1.))));
    float op = step(0.5, seed);
    _webcl_commitOut0(op);
    `,`
    #define gen_seed(val) (sin(val) * 43758.5453123)
    `
);
init_prog.exec([], [buf1]);
let matProg = new myGPU.Program([buf1.shape], [buf2.shape], 
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
    float me_dead = step(me_alive, 0.5);
    float birth_state = step(2.5, alive_count) * step(alive_count, 3.5);
    float op = (me_alive * neighbour_state) + (me_dead * birth_state);
    _webcl_commitOut0((op*is_ca) + (is_not_ca));
    `
);
let frameCount = 0;
let in_buf  = buf1;
let out_buf = buf2;
let prevtimestamp = 0;
function frame(timestamp){
    matProg.exec([in_buf], [out_buf]);
    frameCount++;
    if(frameCount > 10000){
        console.log('done');
        out_buf.read();
        console.log(out_buf.getShapedData());
        console.log(in_buf.getShapedData());
        console.log(in_buf, out_buf);
        return;
    }
    let temp = in_buf;
    in_buf  = out_buf;
    out_buf = temp;
    let delta = timestamp - prevtimestamp;
    if(delta >= 50){
        requestAnimationFrame(frame);
    }else{
        setTimeout(() => requestAnimationFrame(frame), 50-delta);
    }
    // requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


// console.log(matBuf1, matBuf2, matSq);
// matSq.read();
// console.log(matSq.data);