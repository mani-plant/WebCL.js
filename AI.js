function binarySearch(x, cmp){
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

function stepUniformPositive(a, k){
	let p = Math.random();
	let n = binarySearch(p, function(x, n){
		let tn = (1 - Math.pow(1-k, n));
		if(x === tn) return 0;
		if(x < tn) return -1;
		if(x > tn) return 1;
	});
	return(uniformRandom(n*a, a));
	// return n;
}

//chromosome - object
//	mutate()
//	cross(chromosome)
//

// population(of chromosomes) -> mutation -> crossover ---genome to phenome---> individuals -> fitness -> probability -> next generation population

function Chromosome(length){
	this.data = new Array(length);
	this.length = length;
	this.data.fill(0);
	this.data = this.data.map(x => Math.random()*2-1);
	this.mutate = function(p, scope, cap = false){
		this.data = this.data.map(function(x){
			if(Math.random() < p){
				if(cap){
					return Math.max(Math.min(x + (Math.random()*2 - 1)*scope, 1.0),-1.0);
				}else{
					return (x + (Math.random()*2 - 1));
				}
			}else{
				return x;
			}
		});
	}
}
function crossChromosomes(ch1, ch2, split){
	let k  = {ch1, ch2};
	let c = new Chromosome(ch1.length);
	c.data.map(function(x, i){
		let ch1 = this.ch1;
		let ch2 = this.ch2;
		if(i<split){
			return ch1.data[i]
		}else{
			return ch2.data[i];
		}
	}.bind(k));
	return c;
}

function generatePopulation(size, len){
	let population = [];
	for(let i=0;i<size;i++)
		population.push(new Chromosome(len));
	return population;
}


function Population(chromosomeLength, populationSize, chromosomeToIndividual, fitnessFn, probabilityFn, chromosomes = null){
	this.data = new Array(populationSize);
	this.data.fill(0);
	this.sumChromosome = new Chromosome(chromosomeLength);
	this.sumChromosome.data.fill(0);
	this.data = this.data.map(function(x, i){
		let ch;
		if(chromosomes){
			ch = chromosomes[i];
		}else{
			ch = new Chromosome(chromosomeLength);
		}
		let ret = {
			chromosome: ch,
			individual: null,
			fitness: null,
			probability: null
		};
		this.sumChromosome.data = this.sumChromosome.data.map(function(x,i){
			return(x + ret.chromosome[i]);
		});
		return ret;
	}.bind(this));
	this.avgChromosome = new Chromosome(chromosomeLength);
	this.avgChromosome.data = this.avgChromosome.data.map(function(x){
		return(x/populationSize);
	});
	this.initIndividuals = function(){
		this.data.map(function(x){
			x.individual = chromosomeToIndividual(x.chromosome);
			return x;
		});
	}

	this.calculateFitness = function(){
		this.totalFitness = 0;
		this.maxFitness = 0;
		this.data.map(function(x){
			x.fitness = fitnessFn(x.individual);
			this.totalFitness += x.fitness;
			this.maxFitness = Math.max(this.maxFitness, x.fitness);
			return x;
		}.bind(this));
		this.avgFitness = this.totalFitness/populationSize;
	}

	this.calculateProbability = function(){
		this.sumProbability = 0;
		this.data.map(function(x){
			x.probability = probabilityFn(x.chromosome, x.individual, x.fitness, this.avgChromosome, this.totalFitness);
			this.sumProbability += x.probability;
			return x;
		}.bind(this));
	}

	this.produceNextGeneration = function(split, mutation, step){
		// 1. select surviving genes
		// 2. cross over
		// 3. mutate
		let survivors = [];
		let nextGen = [];
		// let sms = {
		// 	split, mutation, step, nextGen, survivors
		// };
		// this.data.map(function(x){
		// 	let r= Math.random();
		// 	console.log(x.probability, r);
		// 	if(r <= x.probability){
		// 		this.survivors.push(x);
		// 		console.log("t");
		// 	}else{
		// 		console.log("f");
		// 	}
		// 	return x;
		// }.bind(sms));
		// console.log(survivors);
		// survivors.map(function(x){
		// 	this.survivors.map(function(y){
		// 		let x = this.x;
		// 		let ch = crossChromosomes(x,y,this.split);
		// 		ch.mutate(this.mutation, this.step);
		// 		this.nextGen.push(ch);
		// 		return y;
		// 	}.bind({...this, x}));
		// 	return x;
		// }.bind(sms));
		/*
		n2 - n - 2 = 0
		*/
		// let numSurvivors = Math.floor((1 + Math.sqrt(1 + 8*populationSize))/2);
		let numSurvivors = Math.ceil(Math.sqrt(populationSize));
		let sortedData = this.data.sort(function(a,b){
			return(b.probability - a.probability);
		});
		for(let i=0;i<numSurvivors;i++){
			survivors.push(sortedData[i]);
		}
		// console.log(survivors);
		for(let i in survivors){
			let x = survivors[i];
			for(let j in survivors){
				let y = survivors[j];
				let ch = crossChromosomes(x.chromosome,y.chromosome,split);
				ch.mutate(mutation, step);
				nextGen.push(ch);
			}
		}
		let ret = new Population(chromosomeLength, nextGen.length, chromosomeToIndividual, fitnessFn, probabilityFn, nextGen);
		return ret;
	}
}


/////////////////////////////////


let chromosomeToIndividual = function(ch){
	return {
		x: ch.data[0],
		y: ch.data[1]
	};
}

let individualFitness = function(indi){
	let x = indi.x;
	let y = indi.y;
	if(x > 10 || y > 10 || x < -10 || y < -10) return 0;
	return(Math.sin(x)*Math.sin(x)*Math.cos(y)*Math.cos(y)*Math.exp(x+y));
}

let indiprobability = function(chromosome, individual, fitness, avgChromosome, totalFitness){
	return (fitness/totalFitness);
}

let pop = new Population(2, 1000, chromosomeToIndividual, individualFitness, indiprobability);


for(let i=0;i<1000;i++){
	pop.initIndividuals();
	pop.calculateFitness();
	pop.calculateProbability();
	console.log(pop.avgFitness, pop.maxFitness);
	pop = pop.produceNextGeneration(1, 0.5, 5.0);
	// console.log(pop);
}