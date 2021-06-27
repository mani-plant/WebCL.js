//==========================================================================================//
//==========================================================================================//

// generic binary search

function binarySearch(x, cmp){
	// console.log('bs',x,n);
	// let c = compare(x,n);
	// if(c === 0){
	// 	return n;
	// }else if(c < 0){
	// 	let nn = Math.floor((n+pn)/2);
	// 	if(nn === n){
	// 		return false;
	// 	}
	// 	return binarySearch(x, compare, nn, n);
	// }else if(c > 0){
	// 	let nn;
	// 	if(pn === 0){
	// 		nn = Math.floor(n*2);
	// 	}else{
	// 		nn = Math.floor((n+pn)/2);
	// 	}
	// 	if(nn === n){
	// 		return false
	// 	}
	// 	return binarySearch(x, compare, nn);
	// }
	// return false;
	let ln = 1;
	while(cmp(x, ln) < 0){
		let nln = Math.floor(ln/2);
		if(nln === ln) return false;
		ln = nln;
	}
	let un = 1;
	while(cmp(x, un) > 0){
		un *= 2;
	}
	while(ln !== un){
		let n = Math.floor((ln+un)/2);
		if(cmp(x,n) > 0){
			if(ln === n) return n;
			ln = n;
		}else if(cmp(x,n) < 0){
			un = n;
			// if(un === n) return n;
		}else{
			return n;
		}
	}
	return ln;
}

//==========================================================================================//
//==========================================================================================//

// random number generators

// 1. uniform between 0 and 1 -> Math.random()

// 2. uniform between a and a+w

function uniformRandom(a = 0, w = 1){
	return(Math.random()*w + a);
}

// 3. uniform k between (0,a) , (1-k)k between (a, 2a) , (1-(1-k)k)k between (2a,3a)....
// => k , k - k2 , k-k2+k3 .... between (0,a),(a,2a),(2a,3a) ... respectively

function stepUniformPositiveRandom(a, k){
	let p = Math.random();
	// let n = binarySearch(p, function(x, n){
	// 	let tn = Math.pow(1-k, n);
	// 	let tn1 = tn * (1-k);
	// 	tn = 1-tn;
	// 	tn1 = 1-tn1;
	// 	if(x >= tn && x < tn1) return 0;
	// 	else if(x >= tn1) return 1;
	// 	else if(x < tn) return -1;
	// 	return false;
	// }, 1);
	let n = binarySearch(p, function(x, n){
		let tn = (1 - Math.pow(1-k, n));
		if(x === tn) return 0;
		if(x < tn) return -1;
		if(x > tn) return 1;
	});
	return(uniformRandom(n*a, a));
	// return n;
}

//test 
// let td = {};
// for(let i=0;i<1000000;i++){
// 	let n = stepUniformPositive(1, 0.5);
// 	if(!td[n]) td[n] = 0;
// 	td[n]+=1/10000;
// }
// console.log(td);


function stepUniformRandom(a, k){
	let r = stepUniformPositiveRandom(a,k);
	let m = Math.random() > 0.5 ? 1 : -1;
	return r*m;
}


//==========================================================================================//
//==========================================================================================//

// 

// function Gene(length, mutate, init = function(){return new Array(length).fill(0).map(x => Math.random())}) {
// 	this.data = new Array(length).fill(0);

// }

// function GenePool(size, length, mutate, cross, init = function(i){
// 	return (new Array(length).fill(0).map(x => Math.random()));
// }){
// 	this.size = size;
// 	this.length = length;
// 	this.data = [];
// 	for(let i=0;i<size;i++){
// 		c = init(i);
// 		this.data.push(c);
// 	}
// 	this.mutate = function(){
// 		let n = [];
// 		for(let i=0;i<this.data.length;i++){
// 			n.push(mutate(this.data[i]));
// 		}
// 		let k = new GenePool(n.length, n[0].length, mutate, cross, function(i){
// 			return n[i];
// 		});
// 		return k;
// 	}
// 	this.cross = function(selected){
// 		let gen = [];
// 		for(let i=0;i<selected.length;i++){
// 			for(let j=0;j<selected.length;j++){
// 				gen.push(cross(this.data[selected[i]], this.data[selected[j]]));
// 			}
// 		}
// 		let k = new GenePool(gen.length, gen[0].length, mutate, cross, function(i){
// 			return gen[i];
// 		});
// 		return k;
// 	}
// }

// function Population(genePool, materalize, evaluate, sortEval){
// 	this.genePool = genePool;
// 	this.individuals = [];
// 	for(let i=0;i<genePool.size; i++){
// 		this.individuals.push(materalize(genePool.data[i]));
// 	}
// 	this.evaluation = [];
// 	this.evaluate = function(){
// 		for(let i=0;i<this.individuals.length;i++){
// 			this.evaluation.push(evaluate(this.individuals[i]))
// 		}
// 	}
// 	this.nextGen = function(){
// 		let sortedEval = individuals.sort(sortEval);
// 		let lenSelected = Math.ceil(Math.sqrt(this.genePool.size));
// 		let selected = [];
// 		for(let i=0;i<lenSelected;i++){
// 			selected.push(sortEval[i]);
// 		}
// 		let ngp = genePool.cross(selected).mutate();
// 		let np = new Population(ngp, materalize, evaluate, sortEval);
// 		return np;
// 	}
// }

// let t = new GenePool(4, 2, function(x){return x.map(t=>t+0.1);}, function(x,y){return [x[0],y[1]];}, function(i){return [2*i, 2*i+1]});

/*
gene{
	mutate
	materalize
	evaluate
	cross
	compare
}

genePool{
	sort
	generate
}
*/
function Gene(gi, init){
	this.data = init();
	this.interface = gi;
	this.mutate = function(){
		this.interface.mutate(this);
	}
	this.materalize = function(){
		this.individual = this.interface.materalize(this);
		return this.individual;
	}
	this.evaluate = function(){
		this.evaluation = this.interface.evaluate(this);
		return this.evaluation;
	}
	this.cross = function(g2){
		return this.interface.cross(this, g2);
	}
	this.compare = function(g2){
		return this.interface.compare(this, g2);
	}
}
function GenePool(gi, size, init){
	this.data = [];
	this.interface = gi;
	for(let i=0;i<size;i++){
		this.data.push( init(i) );
	}
	this.mutate = function(){
		for(let i=0;i<this.data.length;i++){
			this.data[i].mutate();
		}
		return this;
	}
	this.materalize = function(){
		for(let i=0;i<this.data.length;i++){
			this.data[i].materalize();
		}
		return this;
	}
	this.evaluate = function(){
		for(let i=0;i<this.data.length;i++){
			this.data[i].evaluate();
		}
		return this;
	}
	this.sort = function(){
		this.data = this.data.sort(function(a,b){
			return b.compare(a);
		});
		return this;
	}
	this.cross = function(siz = this.data.length){
		let n = Math.ceil(Math.sqrt(siz));
		let x = [];
		for(let i=0;i<n;i++){
			let a = this.data[i];
			for(let j=0;j<n;j++){
				let b = this.data[j];
				x.push(a.cross(b));
			}
		}
		return(new GenePool(this.interface, x.length, function(i){return x[i];}));
	}
}
function GeneInterface(length, mutate, materalize, evaluate, cross, compare, init = function(){return new Array(length).fill(0).map(x => uniformRandom(-1,2))}){
	this.length = length;
	this.mutate = mutate;
	this.materalize = materalize;
	this.evaluate = evaluate;
	this.cross = cross;
	this.compare = compare;
	this.init = init;
	this.initPool = function(i){
		return this.newGene();
	}
	
	this.newGene = function(init = this.init){
		return new Gene(this, init);
	}
	this.copyGene = function(gene){
		if(gene.interface !== this) throw "Invalid pool";
		ini = gene.data.map(x => x);
		let ng = newGene(this, ()=>ini);
	}
	this.newGenePool = function(size, init = this.initPool.bind(this)){
		return new GenePool(this, size, init);
	}
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// example

/*
gene [0,1]
*/
let example1 = function(){
	let gi;

	function mutate(gene){
		for(let i=0;i<gene.data.length-1;i++){
			gene.data[i] += stepUniformRandom(1, gene.data[2]);
		}
	}

	function materalize(gene){
		return {
			x: gene.data[0],
			y: gene.data[1]
		};
	}

	function evaluate(gene){
		let a = 0;
		let b = 40;
		let c = 10;
		let d = 30;
		let x = gene.individual.x;
	    let y = gene.individual.y;
	    if(x<a || y<a) return 0;
	    if(x >b || y>b) return 0;
	    if((x > d && y > d) || (x < c || y < c)){
	        let w = 0.4;
	        let s = 2/Math.sqrt((x+y));
	        return(Math.min(Math.sin(w*x)*Math.sin(w*x)*Math.cos(w*y)*Math.cos(w*y)*(x+y), 1000));
	    }
	    return 0;
	}

	function cross(g1, g2){
		let x = (g1.data[2]+g2.data[2])/2.00001;
		x = Math.sqrt(1-x*x);
		// let x = Math.sqrt(1 - g1.data[2]*g2.data[2]);
		// let x = Math.max(g1.data[])
		let d = [g1.data[0], g2.data[1], x];
		return new Gene(gi, function(){return d;});
	}

	function compare(g1,g2){
		return (g1.evaluation - g2.evaluation);
	}

	gi = new GeneInterface(2, mutate, materalize, evaluate, cross, compare, function(){
		return [uniformRandom(-1,2), uniformRandom(-1,2), uniformRandom(0,0.5)];
	});

	let pool = gi.newGenePool(100);

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	//draw graph
	let N = 100;
	let b = 40;
	let a = 0;
	var step = (b - a) / N;
	let x = [];
	let y = [];

	for(var i = a; i < b; i+=step){
	    for(var j=a;j<b;j+=step){
	        let z = evaluate({individual: {x:i,y:j}});
	        // if(z>=1) console.log(i,j,z);
	        // z = Math.min(Math.sin(w*_x)*Math.sin(w*_x)*Math.cos(w*_y)*Math.cos(w*_y)*Math.exp(s*(_x+_y)), 100);
	        // console.log(z);
	        for(let k=0;k<z;k++){
	            x.push(i);
	            y.push(j);
	        }
	    }
	}
	var trace2 = {
	  x: x,
	  y: y,
	  name: 'density',
	  ncontours: 30,
	  colorscale: 'Hot',
	  reversescale: true,
	  showscale: false,
	  type: 'histogram2dcontour'
	};
	// let pool2;
	async function ex(){
		for(let i=0;i<1000;i++){
			pool.materalize();
			pool.evaluate();
			pool.sort();
			if(i%10 == 0){
				let popX = [];
				let popY = [];
				for(let j in pool.data){
					let g = pool.data[j];
					popX.push(g.data[0]);
					popY.push(g.data[1]);
				}
		        var trace1 = {
		            x: popX,
		            y: popY,
		          mode: 'markers',
		          name: 'points',
		          marker: {
		            color: 'rgb(0,0,255)',
		            size: 5,
		            opacity: 0.8
		          },
		          type: 'scatter'
		        };
		        var data = [trace1, trace2];
		        var layout = {
		          showlegend: false,
		          autosize: false,
		          width: 1200,
		          height: 1100,
		          margin: {t: 50},
		          hovermode: 'closest',
		          bargap: 0,
		          // xaxis: {
		          //   domain: [0, 0.85],
		          //   showgrid: false,
		          //   zeroline: false
		          // },
		          // yaxis: {
		          //   domain: [0, 0.85],
		          //   showgrid: false,
		          //   zeroline: false
		          // },
		          // xaxis2: {
		          //   domain: [0.85, 1],
		          //   showgrid: false,
		          //   zeroline: false
		          // },
		          // yaxis2: {
		          //   domain: [0.85, 1],
		          //   showgrid: false,
		          //   zeroline: false
		          // }
		        };
		        Plotly.newPlot('plot', data, layout);
		        // console.log(pop);
		        await new Promise(r => setTimeout(r, 500));
		    }
		    pool = pool.cross();
		    pool.mutate();
	    }
	}
	ex();
}

let example2 = function(){
	let gi;

	function mutate(gene){
		for(let i=0;i<gene.data.length-1;i++){
			gene.data[i] += stepUniformRandom(1, gene.data[2]);
		}
	}

	function materalize(gene){
		return {
			m: gene.data[0],
			c: gene.data[1]
		};
	}

	function evaluate(gene){
		// let a = 0;
		// let b = 40;
		// let c = 10;
		// let d = 30;
		// let x = gene.individual.x;
	 //    let y = gene.individual.y;
	 //    if(x<a || y<a) return 0;
	 //    if(x >b || y>b) return 0;
	 //    if((x > d && y > d) || (x < c || y < c)){
	 //        let w = 0.4;
	 //        let s = 2/Math.sqrt((x+y));
	 //        return(Math.min(Math.sin(w*x)*Math.sin(w*x)*Math.cos(w*y)*Math.cos(w*y)*(x+y), 1000));
	 //    }
	 //    return 0;
	 	let m = gene.individual.m;
	 	let c = gene.individual.c;
	 	let error = 0;
	 	for(let i=0;i<100;i++){
	 		let x = uniformRandom(-5,10);
	 		let y = m*x + c;
	 		let s = 200*x + 100;
	 		let err = s-y;
	 		error += err*err;
	 	}
	 	return error;
	}

	function cross(g1, g2){
		let x = (g1.data[2]+g2.data[2])/2.00001;
		x = Math.sqrt(1-x*x);
		// let x = Math.sqrt(1 - g1.data[2]*g2.data[2]);
		// let x = Math.max(g1.data[])
		let d = [g1.data[0], g2.data[1], x];
		return new Gene(gi, function(){return d;});
	}

	function compare(g1,g2){
		return (g2.evaluation - g1.evaluation);
	}

	gi = new GeneInterface(2, mutate, materalize, evaluate, cross, compare, function(){
		return [uniformRandom(-1,2), uniformRandom(-1,2), 0.5];
	});

	let pool = gi.newGenePool(100);
	async function ex(){
		ne = [];
		xe = [];
		ae = [];
		x = [];
		for(let i=0;i<1000;i++){
			pool.materalize();
			pool.evaluate();
			pool.sort();
			let minerr = Infinity;
			let maxerr = 0;
			let avgerr = 0;
			if(i%10){
				for(let i=0;i<pool.data.length;i++){
					let g = pool.data[i].evaluation;
					avgerr += g;
					maxerr = Math.max(maxerr, g);
					minerr = Math.min(minerr, g);
				}
				avgerr /= pool.data.length;
				ne.push(minerr);
				xe.push(maxerr);
				ae.push(avgerr);
				x.push(i);
			}
			pool = pool.cross();
			pool.mutate();
		}
		var trace1 = {
		  x: x,
		  y: ne,
		  type: 'scatter'
		};

		var trace2 = {
		  x: x,
		  y: xe,
		  type: 'scatter'
		};

		var trace3 = {
		  x: x,
		  y: ae,
		  type: 'scatter'
		};


		var data = [trace3, trace2, trace1];

		Plotly.newPlot('plot', data);
	}
	ex();
	return pool;
}






let example3 = function(){
	let gi;

	function mutate(gene){
		for(let i=0;i<gene.data.length-1;i++){
			gene.data[i] += stepUniformRandom(0.1, gene.data[gene.length-1]);
		}
	}

	function materalize(gene){
		return {
			m: gene.data[0],
			c: gene.data[1]
		};
	}

	function evaluate(gene){
		// let a = 0;
		// let b = 40;
		// let c = 10;
		// let d = 30;
		// let x = gene.individual.x;
	 //    let y = gene.individual.y;
	 //    if(x<a || y<a) return 0;
	 //    if(x >b || y>b) return 0;
	 //    if((x > d && y > d) || (x < c || y < c)){
	 //        let w = 0.4;
	 //        let s = 2/Math.sqrt((x+y));
	 //        return(Math.min(Math.sin(w*x)*Math.sin(w*x)*Math.cos(w*y)*Math.cos(w*y)*(x+y), 1000));
	 //    }
	 //    return 0;
	 	let m = gene.individual.m;
	 	let c = gene.individual.c;
	 	let correct = 0;
	 	let incorrect = 0;
	 	let error = 0;
	 	for(let i=0;i<1000;i++){
	 		let x = uniformRandom(-500,1000);
	 		let y = uniformRandom(-500,1000);
	 		let s = m*x + c;
	 		let r = 2*x + 100;
	 		let err = (s-r);
	 		error+=err*err;
	 		// if(s*r > 0){
	 		// 	correct++;
	 		// }else if(s*r < 0){
	 		// 	incorrect++;
	 		// }else if(s == r){
	 		// 	correct++;
	 		// }else{
	 		// 	incorrect++;
	 		// }
	 	}
	 	return error;
	 	// return incorrect/(correct+incorrect);
	}

	function cross(g1, g2){
		let x = (g1.data[2]+g2.data[2])/2;
		x = Math.sqrt(1-x*x);
		// let x = Math.sqrt(1 - g1.data[2]*g2.data[2]);
		// let x = Math.max(g1.data[])
		let d = [g1.data[0], g2.data[1], x];
		return new Gene(gi, function(){return d;});
	}

	function compare(g1,g2){
		return (g2.evaluation - g1.evaluation);
	}

	gi = new GeneInterface(2, mutate, materalize, evaluate, cross, compare, function(){
		return [uniformRandom(-1,2), uniformRandom(-1,2), 0.5];
	});

	let pool = gi.newGenePool(100);
	async function ex(){
		ne = [];
		xe = [];
		ae = [];
		x = [];
		for(let i=0;i<10000;i++){
			pool.materalize();
			pool.evaluate();
			pool.sort();
			let minerr = Infinity;
			let maxerr = 0;
			let avgerr = 0;
			if(i%10){
				for(let i=0;i<pool.data.length;i++){
					let g = pool.data[i].evaluation;
					avgerr += g;
					maxerr = Math.max(maxerr, g);
					minerr = Math.min(minerr, g);
				}
				avgerr /= pool.data.length;
				ne.push(minerr);
				xe.push(maxerr);
				ae.push(avgerr);
				x.push(i);
			}
			pool = pool.cross();
			pool.mutate();
		}
		var trace1 = {
		  x: x,
		  y: ne,
		  type: 'scatter'
		};

		var trace2 = {
		  x: x,
		  y: xe,
		  type: 'scatter'
		};

		var trace3 = {
		  x: x,
		  y: ae,
		  type: 'scatter'
		};


		var data = [trace3, trace2, trace1];

		Plotly.newPlot('plot', data);
	}
	ex();
	return pool;
}


let example4 = function(){

	function neuron(n, a){
		this.weights = new Array(n).fill(0).map(x=>uniformRandom(-1,2));
		this.bias = uniformRandom(-1,2);
		this.activationFn = a;
		this.activate = function(inp){
			let act = 0;
			for(let i in this.weights){
				act += inp[i]*this.weights[i];
			}
			act += this.bias;
			return this.activationFn(act);
		}
	}

	function network(shape, a){
		this.activationFn = a;
		this.layers = [];
		for(let i=1;i<shape.length;i++){
			let cur = [];
			let n = shape[i];
			let w = shape[i-1];
			for(let j=0;j<n;j++){
				cur.push(new neuron(w, this.activationFn));
			}
			this.layers.push(cur);
		}
		this.activate = function(inp){
			for(let i in layers){
				let l = layers[i];
				let o = [];
				for(let j in l){
					let neuron = l[j];
					o.push(neuron.activate(inp));
				}
				inp = o;
			}
			return o;
		}
	}


	let gi;

	function mutate(gene){
		// for(let i=0;i<gene.data.length-1;i++){
		// 	gene.data[i] += stepUniformRandom(0.25, gene.data[gene.length-1]);
		// }
		let s = Math.floor(uniformRandom(0,19));
		// gene.data[s] += stepUniformRandom(0.25, gene.data[gene.length-1]);
		gene.data[s] = uniformRandom(-2,4);
	}

	function materalize(gene){
		return gene.data;
	}

	function evaluate(gene){
	 	let correct = 0;
	 	let incorrect = 0;
	 	let err = 0;
	 	let w = gene.data;
	 	for(let i=0;i<1000;i++){
	 		let x = uniformRandom(-25,50);
	 		let y = uniformRandom(-25,50);
	 		let s = 25 - x*x - y*y;
	 		let a1 = w[0]*x + w[1]*y;
	 		let a2 = w[2]*x + w[3]*y;
	 		let a3 = w[4]*x + w[5]*y;
	 		let a4 = w[6]*x + w[7]*y;
	 		let b1 = a1*w[8]+a2*w[9]+a3*w[10]+a4*w[11];
	 		let b2 = a1*w[12]+a2*w[13]+a3*w[14]+a4*w[15];
	 		let a = b1*w[16] + b2*w[17];
	 		// if(s-a > 0){
	 		// 	correct++;
	 		// }else{
	 		// 	incorrect++;
	 		// }
	 		err += (s-a)*(s-a);
	 	}
	 	return err;
	}

	function cross(g1, g2){
		let d = [];
		let s = Math.ceil(uniformRandom(0,19));
		for(let i=0;i<s;i++){
			d.push(g1.data[i]);
		}
		for(let i=s;i<19;i++){
			d.push(g2.data[i]);
		}
		return new Gene(gi, function(){return d;});
	}

	function compare(g1,g2){
		return (g2.evaluation - g1.evaluation);
	}

	gi = new GeneInterface(19, mutate, materalize, evaluate, cross, compare, function(){
		let x = new Array(18).fill(0).map(x => uniformRandom(-2,4));
		x.push(0.1);
		return x;
	});

	let pool = gi.newGenePool(100);
	async function ex(){
		ne = [];
		xe = [];
		ae = [];
		x = [];
		for(let i=0;i<1000;i++){
			pool.materalize();
			pool.evaluate();
			pool.sort();
			let minerr = Infinity;
			let maxerr = 0;
			let avgerr = 0;
			if(i%10){
				for(let i=0;i<pool.data.length;i++){
					let g = pool.data[i].evaluation;
					avgerr += g;
					maxerr = Math.max(maxerr, g);
					minerr = Math.min(minerr, g);
				}
				avgerr /= pool.data.length;
				ne.push(minerr);
				xe.push(maxerr);
				ae.push(avgerr);
				x.push(i);
			}
			pool = pool.cross();
			pool.mutate();
		}
		var trace1 = {
		  x: x,
		  y: ne,
		  type: 'scatter'
		};

		var trace2 = {
		  x: x,
		  y: xe,
		  type: 'scatter'
		};

		var trace3 = {
		  x: x,
		  y: ae,
		  type: 'scatter'
		};


		var data = [trace3, trace2, trace1];

		Plotly.newPlot('plot', data);
	}
	ex();
	return pool;
}