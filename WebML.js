function Neuron(weights){
	this.weights = new Array(weights).fill(0).map(function(){
		return(Math.random()*2-1);
	});
	// this.dw = [...weights];
	this.initWeights = [...this.weights];
	let r = 0.1;
	this.activate = function(inp, upd = false, inhibit=1){
		let activation = this.weights.reduce((function(acc, current, index, weights){
			let val = inp[index] ? inp[index]:0;
			let na =  (acc + val*current);
			if(upd){
				// let cdw = this.dw[index];
				// let rk = (1-cdw)/(1+cdw);
				// let ek = Math.exp(-r*val);
				// this.dw[index] = (1 - rk*ek)/(1+rk*ek);
				// weights[index] -= this.dw[index]/Math.exp(current*current);
				let rk = (1-current)/(1+current);
				let ek = Math.exp(inhibit*r*val);
				weights[index] = (1 - rk*ek)/(1+rk*ek);
				// this.dw[index] = weights[index]-current;
				// weights[index] += r*val/(weights[index]*Math.exp(weights[index]*weights[index]));
			}
			return na;
		}).bind(this), 0);
		activation = activation>0.01 ? 1 : activation < 0.01 ? -1 : 0;
		return activation;
	}
	this.activateInternal = function(inp, upd = false, inhibit=1){
		let activation = this.weights.reduce((function(acc, current, index, weights){
			let val = inp[index] ? inp[index]:0;
			let na =  (acc + val*current);
			if(upd){
				// let cdw = this.dw[index];
				// let rk = (1-cdw)/(1+cdw);
				// let ek = Math.exp(-r*val);
				// this.dw[index] = (1 - rk*ek)/(1+rk*ek);
				// weights[index] -= this.dw[index]/Math.exp(current*current);
				let rk = (1-current)/(1+current);
				let ek = Math.exp(inhibit*r*val);
				weights[index] = (1 - rk*ek)/(1+rk*ek);
				// this.dw[index] = weights[index]-current;
				// weights[index] += r*val/(weights[index]*Math.exp(weights[index]*weights[index]));
			}
			return na;
		}).bind(this), 0);
		// activation = activation>0.01 ? 1 : activation < 0.01 ? -1 : 0;
		return activation;
	}
}
function Network(shape){
	let layers = [];
	console.log(shape);
	for(let i=0;i<shape.length;i++){
		let n = shape[i];
		if(i < shape.length-1){
			let nn = shape[i+1];
			layers.push((new Array(nn)).fill(0).map(function(){
				return new Neuron(n);
			}));
		}
	}
	console.log(JSON.stringify(layers));
	this.activate = function(inp, upd = false, bias=1){
		for(let i in layers){
			let layerOp = [];
			for(let j in layers[i]){
				let nur = layers[i][j];
				layerOp.push(nur.activate(inp, upd, bias));
			}
			inp = [...layerOp];
		}
		return inp[0];
	}
}
let net = new Network([5,2,1]);

let N = 10000000;
let cc = 0;
let ww = 0;
for(let i=0;i<N;i++){
	let inp = [Math.random()*2 - 1, Math.random()*2 - 1];
	inp.push(inp[0]*inp[0]);
	inp.push(inp[1]*inp[1]);
	inp.push(inp[0]*inp[1]);
	let op = inp[4]>0 ? 1 : -1;
	let val = net.activate(inp, false);
	if(val == op){
		net.activate(inp, true);
		// net.activate([-inp[0],-inp[1]], true);
		cc++;
	}else if(val !== 0){
		// inp = [inp[1],inp[0]];
		// net.activate(inp, true, -1);
		ww--;
	}
}
console.log(cc,ww);
cc = 0;
ww = 0;
for(let i=0;i<100;i++){
	let inp = [Math.random()*2 - 1, Math.random()*2 - 1];
	inp.push(inp[0]*inp[0]);
	inp.push(inp[1]*inp[1]);
	inp.push(inp[0]*inp[1]);
	let op = inp[4]>0 ? 1 : -1;
	let val = net.activate(inp, false);
	if(val == op){
		cc++;
	}else if(val !== 0){
		ww--;
	}
}
console.log(cc,ww);
// let n = 10;
// let neurons = new Array(n).fill().map(function(){
// 	return ({
// 		err: 0,
// 		correct: 0,
// 		incorrect: 0,
// 		dontknow: 0,
// 		neuron: new Neuron(2)//[Math.random()*2-1,Math.random()*2-1]
// 	}); 
// });
// let track = neurons[0];
// let N = 10000000;
// let cc=0;
// let ww = 0;
// for(let i=0;i<N;i++){
// 	let inp = [Math.random()*2 - 1, Math.random()*2 - 1];
// 	let op = inp[0]>inp[1] ? 1 : -1;
// 	neurons.map(function(cur){
// 		// if(cur === track){
// 		// 	console.log(cur.neuron.weights);
// 		// }
// 		// console.log(cur.neuron.weights);
		// let val = cur.neuron.activate(inp, false);
		// let i =0;
		// if(val == op){
		// 	cur.neuron.activate(inp, true);
		// 	cc++;
		// }else if(val !== 0){
		// 	ww--;
		// 	inp = [-inp[0],-inp[1]];
		// 	cur.neuron.activate(inp, true);
		// }
// 	});	
// }
// console.log(cc,ww);
// N = 1000;
// for(let i=0;i<N;i++){
// 	let inp = [Math.random()*2 - 1, Math.random()*2 - 1];
// 	let op = inp[0]>inp[1] ? 1 : -1;
// 	neurons.map(function(cur, i){
// 		let v = cur.neuron.activate(inp);
// 		// console.log(inp,op,v);
// 		// cur.err += (v-op)*(v-op)/2;
// 		if(v == op){
// 			cur.correct++;
// 		}else if(v !== 0){
// 			// console.log(inp,v, op);
// 			cur.incorrect++;
// 		}else{
// 			cur.dontknow++;
// 		}
// 		let err = cur.correct/cur.incorrect;
// 		if(cur.err > err){
// 			throwr(cur);
// 		}
// 	});
// }
// neurons = neurons.sort(function(n1,n2){
// 	return n2.err-n1.err;
// })
// console.log(neurons.map(function(cur){
// 	return [cur.neuron.initWeights, ...cur.neuron.weights, cur.correct, cur.incorrect, cur.dontknow, cur.err];
// }));
